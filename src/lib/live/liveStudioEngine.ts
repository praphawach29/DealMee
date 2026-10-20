import { createAdminClient } from '@/lib/supabase/admin'
import { generatePromptPayQRImage } from '@/lib/billing/manualBilling'
import { platformSecret } from '@/lib/platformSecrets'

export interface LiveBasketItem {
  basket_no: number
  product_id: string
  product_name: string
  regular_price: number
  live_price: number
  stock: number
  image_url: string
  highlight_tag?: string
}

export interface LiveCommentItem {
  id: string
  username: string
  platform: 'tiktok' | 'facebook' | 'shopee'
  comment_text: string
  action_type: 'basket_switch' | 'cf_order' | 'question' | 'general'
  basket_no_triggered?: number
  ai_reply_text?: string
  created_at: string
}

export interface LiveOrderSummary {
  id: string
  order_no: string
  username: string
  product_name: string
  product_id?: string
  basket_no: number
  quantity: number
  unit_price: number
  total_amount: number
  qr_data_url?: string
  promptpay_payload?: string
  checkout_url?: string
  created_at: string
}

export interface LiveSessionState {
  shop_id: string
  title: string
  status: 'active' | 'idle' | 'ended'
  platform: string
  current_basket_no: number
  current_product: LiveBasketItem | null
  baskets: LiveBasketItem[]
  recent_comments: LiveCommentItem[]
  total_comments: number
  total_cf_orders: number
  total_cf_revenue: number
  latest_cf_order?: LiveOrderSummary | null
  updated_at: string
}

export interface LiveHostPitch {
  hook15s: string
  sellingPoints: string[]
  urgencyClosing: string
  faqAnswers: { question: string; answer: string }[]
}

const supabase = createAdminClient()

/**
 * In-Memory cache for super-fast OBS overlay response times (< 30ms)
 */
const liveStateCache = new Map<string, LiveSessionState>()

/**
 * Initialize or retrieve the active live session for a shop
 */
export async function getLiveSessionState(shopId: string): Promise<LiveSessionState> {
  // Check memory cache first for high-frequency OBS polling
  const cached = liveStateCache.get(shopId)
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < 1500) {
    return cached
  }

  // 1. Fetch shop products to ensure baskets have real product data
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, stock, image_url, description')
    .eq('shop_id', shopId)
    .limit(10)

  const defaultBaskets: LiveBasketItem[] = (products || []).map((p: any, idx: number) => ({
    basket_no: idx + 1,
    product_id: p.id,
    product_name: p.name,
    regular_price: Math.round(Number(p.price || 0) * 1.25),
    live_price: Number(p.price || 0),
    stock: Number(p.stock || 0),
    image_url: p.image_url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
    highlight_tag: idx === 0 ? '🔥 สินค้าขายดีประจำวัน' : idx === 1 ? '⚡ ลดพิเศษเฉพาะในไลฟ์' : '✨ พร้อมส่งด่วน',
  }))

  // 2. Fetch live settings or state
  const settingKey = `live_session_${shopId}`
  const { data: settingData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', settingKey)
    .maybeSingle()

  let state: LiveSessionState
  if (settingData?.value) {
    try {
      state = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value
      if (defaultBaskets.length > 0 && (!state.baskets || state.baskets.length === 0)) {
        state.baskets = defaultBaskets
      }
      if (typeof state.total_cf_revenue !== 'number') {
        state.total_cf_revenue = 0
      }
    } catch {
      state = createDefaultState(shopId, defaultBaskets)
    }
  } else {
    state = createDefaultState(shopId, defaultBaskets)
  }

  // Set current product
  const foundCurrent = state.baskets.find((b) => b.basket_no === state.current_basket_no) || state.baskets[0] || null
  state.current_product = foundCurrent

  liveStateCache.set(shopId, state)
  return state
}

function createDefaultState(shopId: string, baskets: LiveBasketItem[]): LiveSessionState {
  const current = baskets[0] || null
  return {
    shop_id: shopId,
    title: 'DealMee 24/7 AI Live Stream',
    status: 'active',
    platform: 'tiktok',
    current_basket_no: 1,
    current_product: current,
    baskets,
    recent_comments: [
      {
        id: 'c1',
        username: 'คุณน้องฟ้าใส',
        platform: 'tiktok',
        comment_text: 'สวัสดีค่ะ เสื้อยืดผ้านิ่มไหมคะ',
        action_type: 'question',
        ai_reply_text: 'ผ้านุ่มคอตตอน 100% ระบายอากาศดีเยี่ยมเลยค่ะคุณฟ้าใส',
        created_at: new Date(Date.now() - 60000).toISOString(),
      },
    ],
    total_comments: 1,
    total_cf_orders: 0,
    total_cf_revenue: 0,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Process an incoming live comment and trigger instant OBS overlay actions & orders
 */
export async function processLiveComment(
  shopId: string,
  payload: {
    username: string
    comment_text: string
    platform?: 'tiktok' | 'facebook' | 'shopee'
  }
): Promise<{
  state: LiveSessionState
  action_type: 'basket_switch' | 'cf_order' | 'question' | 'general'
  ai_reply: string
  switched_to_basket?: number
  order?: LiveOrderSummary | null
}> {
  const state = await getLiveSessionState(shopId)
  const commentText = (payload.comment_text || '').trim()
  const username = payload.username || 'ผู้ชมไลฟ์'
  const platform = payload.platform || 'tiktok'

  let actionType: 'basket_switch' | 'cf_order' | 'question' | 'general' = 'general'
  let aiReply = ''
  let switchedBasketNo: number | undefined
  let generatedOrder: LiveOrderSummary | null = null

  // 1. Detect CF Order Intent First (e.g. "CF 1", "CF 2 3 ตัว", "CF เสื้อยืด", "รับ 2 ชิ้น", "เอา 1 ตัว")
  const isCfIntent =
    /^(?:cf|ซีเอฟ|รับ|เอา|จอง)\b/i.test(commentText) ||
    /\b(?:cf|ซีเอฟ)\b/i.test(commentText) ||
    /^(?:รับ|เอา)\s*\d+/i.test(commentText)

  if (isCfIntent) {
    actionType = 'cf_order'
    state.total_cf_orders = (state.total_cf_orders || 0) + 1

    let targetBasket: LiveBasketItem | undefined
    let quantity = 1

    // Extract numbers from comment
    const numbersMatch = commentText.match(/\d+/g)
    if (numbersMatch && numbersMatch.length > 0) {
      const firstNum = parseInt(numbersMatch[0], 10)
      const foundBasket = state.baskets.find((b) => b.basket_no === firstNum)
      if (foundBasket) {
        targetBasket = foundBasket
        if (numbersMatch.length > 1) {
          quantity = Math.max(1, parseInt(numbersMatch[1], 10))
        }
      } else {
        // If first number is not a basket number, check if it's quantity with units (e.g. "CF 2 ตัว")
        if (/ตัว|ชิ้น|อัน|ชุด|ใบ|กล่อง|ขวด|ea|pack/i.test(commentText)) {
          quantity = Math.max(1, firstNum)
          targetBasket = state.current_product || state.baskets[0]
        }
      }
    }

    // Match by product name keyword if basket was not found by number
    if (!targetBasket) {
      const lower = commentText.toLowerCase()
      targetBasket = state.baskets.find((b) => {
        const pName = b.product_name.toLowerCase()
        return lower.includes(pName) || pName.split(' ').some((part) => part.length >= 3 && lower.includes(part))
      })
    }

    // Fallback to currently pinned basket or first basket
    if (!targetBasket) {
      targetBasket = state.current_product || state.baskets[0]
    }

    // Extract unit quantity e.g. "3 ตัว", "2 ชิ้น" if not already set
    const qtyUnitMatch = commentText.match(/(\d+)\s*(?:ตัว|ชิ้น|อัน|ชุด|ใบ|กล่อง|ขวด)/i)
    if (qtyUnitMatch) {
      quantity = Math.max(1, parseInt(qtyUnitMatch[1], 10))
    }

    const unitPrice = Number(targetBasket?.live_price || 0)
    const totalAmount = unitPrice * quantity
    state.total_cf_revenue = (state.total_cf_revenue || 0) + totalAmount

    // Switch current product to the CF'd product
    if (targetBasket) {
      state.current_basket_no = targetBasket.basket_no
      state.current_product = targetBasket
      switchedBasketNo = targetBasket.basket_no
    }

    // Generate Order No & Record in Supabase orders table
    const orderNo = `CF-${Date.now().toString().slice(-6)}`
    let insertedId = `cf-${Date.now()}`
    try {
      const { data: ordRow, error: ordErr } = await supabase.from('orders').insert({
        shop_id: shopId,
        order_no: orderNo,
        customer_name: username,
        product_name: targetBasket?.product_name || 'สินค้าไลฟ์สด',
        quantity: quantity,
        total_amount: totalAmount,
        status: 'pending',
        payment_method: 'promptpay',
        items_summary: `${targetBasket?.product_name || 'สินค้า'} (x${quantity}) - ตะกร้า #${targetBasket?.basket_no || 1}`,
      }).select('id').maybeSingle()

      if (ordRow?.id) {
        insertedId = ordRow.id
      }
      if (ordErr) {
        console.warn('[Live Studio Order Insert Warning]:', ordErr.message)
      }
    } catch (dbErr) {
      console.warn('[Live Studio DB Insert Warning]:', dbErr)
    }

    // Generate PromptPay QR
    let qrDataUrl = ''
    let ppPayload = ''
    try {
      const { data: shopRow } = await supabase
        .from('shops')
        .select('promptpay_number, promptpay_name, name')
        .eq('id', shopId)
        .maybeSingle()

      // Only ever build a QR for the shop's own PromptPay number. Without one, skip the QR
      // rather than fall back to a placeholder that would route the buyer's money elsewhere.
      const ppId = (shopRow?.promptpay_number || '').trim()
      if (ppId) {
        const qrRes = await generatePromptPayQRImage(ppId, totalAmount)
        qrDataUrl = qrRes.qrDataUrl
        ppPayload = qrRes.payload
      } else {
        console.warn('[Live Studio] Shop has no PromptPay number; CF order created without a payment QR')
      }
    } catch (qrErr) {
      console.warn('[Live Studio QR Generation Warning]:', qrErr)
    }

    generatedOrder = {
      id: insertedId,
      order_no: orderNo,
      username,
      product_name: targetBasket?.product_name || 'สินค้าไลฟ์สด',
      product_id: targetBasket?.product_id,
      basket_no: targetBasket?.basket_no || 1,
      quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      qr_data_url: qrDataUrl,
      promptpay_payload: ppPayload,
      checkout_url: `/checkout/${orderNo}`,
      created_at: new Date().toISOString(),
    }

    state.latest_cf_order = generatedOrder
    aiReply = `🎉 ล็อกสิทธิ์เรียบร้อยค่ะคุณ ${username}! ได้รับ ${targetBasket?.product_name} (ตะกร้า #${targetBasket?.basket_no}) x${quantity} ชิ้น ยอดรวม ฿${totalAmount.toLocaleString()} สรุปบิลและ QR พร้อมเพย์ส่งเข้า DM แล้วนะคะ 📲`
  }

  // 2. Detect Basket Switch by number (e.g. "ขอดูตะกร้า 2", "ตะกร้า 3", "เบอร์ 1")
  if (actionType === 'general') {
    const basketNumMatch = commentText.match(/(?:ขอดู|ดู|ขอ|เปิด|สลับ|ตะกร้า)\s*(?:ที่|เบอร์)?\s*([0-9]+)/i)
    if (basketNumMatch) {
      const targetNo = parseInt(basketNumMatch[1], 10)
      const matchedBasket = state.baskets.find((b) => b.basket_no === targetNo)
      if (matchedBasket) {
        state.current_basket_no = targetNo
        state.current_product = matchedBasket
        actionType = 'basket_switch'
        switchedBasketNo = targetNo
        aiReply = `ได้เลยค่ะคุณ ${username}! สลับขึ้นภาพ ${matchedBasket.product_name} (ตะกร้า #${targetNo}) ให้ชมแล้วนะคะ ตอนนี้เหลือเพียง ${matchedBasket.stock} ชิ้นเท่านั้นค่ะ 💖`
      }
    }
  }

  // 3. Detect Basket Switch by product keyword (e.g. "ขอดูเสื้อยืดหน่อย", "กางเกงยีนส์มีไหม")
  if (actionType === 'general') {
    const lowerComment = commentText.toLowerCase()
    const matchedByProd = state.baskets.find((b) => {
      const pName = b.product_name.toLowerCase()
      return (
        lowerComment.includes(pName) ||
        pName.split(' ').some((part) => part.length >= 3 && lowerComment.includes(part))
      )
    })

    if (matchedByProd) {
      state.current_basket_no = matchedByProd.basket_no
      state.current_product = matchedByProd
      actionType = 'basket_switch'
      switchedBasketNo = matchedByProd.basket_no
      aiReply = `จัดให้เลยค่ะคุณ ${username}! นำ ${matchedByProd.product_name} (ตะกร้า #${matchedByProd.basket_no}) ขึ้นจอให้แล้วนะคะ ราคาพิเศษเพียง ฿${matchedByProd.live_price.toLocaleString()} ค่ะ ✨`
    }
  }

  // 4. General Questions & Shipping
  if (actionType === 'general') {
    if (/(ส่งฟรี|ค่าส่ง|ส่งกี่บาท)/i.test(commentText)) {
      actionType = 'question'
      aiReply = `โปรโมชั่นวันนี้ในไลฟ์ส่งฟรีทันทีเมื่อสั่งครบ 2 ชิ้นค่ะคุณ ${username} 🚚`
    } else if (/(เก็บปลายทาง|ปลายทาง)/i.test(commentText)) {
      actionType = 'question'
      aiReply = `มีเก็บเงินปลายทาง (COD) ทั่วประเทศค่ะ สั่งซื้อพิมพ์ CF ได้เลยนะคะคุณ ${username} 😊`
    } else {
      aiReply = `ยินดีต้อนรับคุณ ${username} สู่ไลฟ์สดค่ะ! สนใจชิ้นไหนพิมพ์ "ขอดูตะกร้า X" ได้เลย น้องบอทสลับให้ดูอัตโนมัติค่ะ 🛒✨`
    }
  }

  // Record comment
  const newComment: LiveCommentItem = {
    id: `c-${Date.now()}`,
    username,
    platform,
    comment_text: commentText,
    action_type: actionType,
    basket_no_triggered: switchedBasketNo,
    ai_reply_text: aiReply,
    created_at: new Date().toISOString(),
  }

  state.recent_comments = [newComment, ...(state.recent_comments || []).slice(0, 19)]
  state.total_comments = (state.total_comments || 0) + 1
  state.updated_at = new Date().toISOString()

  // Save to memory cache & persistent store
  liveStateCache.set(shopId, state)
  const settingKey = `live_session_${shopId}`
  try {
    await supabase.from('settings').upsert({
      key: settingKey,
      value: JSON.stringify(state),
    }, { onConflict: 'key' })
  } catch (err) {
    console.error('[Live State Upsert Error]:', err)
  }

  return {
    state,
    action_type: actionType,
    ai_reply: aiReply,
    switched_to_basket: switchedBasketNo,
    order: generatedOrder,
  }
}

/**
 * AI Live Host Teleprompter & Sales Pitch Generator
 * Uses Gemini API with fallback to high-conversion Thai live sales templates
 */
export async function generateHostPitch(
  product: LiveBasketItem,
  shopName: string = 'DealMee Live Shop'
): Promise<LiveHostPitch> {
  const apiKey = await platformSecret('GEMINI_API_KEY')

  const savings = Math.max(0, product.regular_price - product.live_price)

  // Fallback template
  const fallbackPitch: LiveHostPitch = {
    hook15s: `สวัสดีค่ะทุกคนในไลฟ์! ใครที่เล็ง "${product.product_name}" อยู่ ฟังทางนี้ด่วนเลยนะคะ! รอบนี้จัดราคาพิเศษเฉพาะไลฟ์สดเหลือเพียง ฿${product.live_price.toLocaleString()} เท่านั้น จากปกติ ฿${product.regular_price.toLocaleString()} ช็อตนี้ใครไม่รีบคว้าบอกเลยว่าหมดแน่นอนค่ะ!`,
    sellingPoints: [
      `เกรดคุณภาพพรีเมียม สั่งผลิตและคัดสรรมาอย่างดี การันตีของแท้ 100%`,
      `ประหยัดทันที ฿${savings.toLocaleString()} เฉพาะคนที่ดูไลฟ์ตอนนี้เท่านั้น`,
      `สินค้ามีพร้อมส่งด่วนรอบวันนี้ สั่งตอนนี้ได้รับของก่อนใคร ไม่ต้องรอนาน`,
    ],
    urgencyClosing: `ในระบบสต็อกแจ้งเตือนว่าเหลือเพียง ${product.stock} ชิ้นสุดท้ายแล้วนะคะ! ใครพิมพ์ CF เข้ามาตอนนี้ ระบบดูดออเดอร์ส่ง QR พร้อมเพย์ล็อกสิทธิ์ให้ทันที ช้าอดหมดโปรนี้นะคะทุกคน!`,
    faqAnswers: [
      {
        question: 'ส่งฟรีกี่วันถึงคะ?',
        answer: 'จัดส่งด่วนรอบวันนี้เลยค่ะ กทม. 1 วัน ตจว. 1-2 วันได้รับสินค้าถึงหน้าบ้านค่ะ',
      },
      {
        question: 'มีเก็บเงินปลายทางไหมคะ?',
        answer: 'มีบริการ COD เก็บเงินปลายทางทั่วประเทศค่ะ พิมพ์ CF แล้วแจ้งปลายทางในแชทได้เลยค่ะ',
      },
    ],
  }

  if (!apiKey) {
    return fallbackPitch
  }

  const prompt = `คุณคือสุดยอด AI สตรีมเมอร์ไลฟ์สดขายของ (Live Shopping Host) มืออาชีพอับดับ 1 ของไทย สำหรับร้าน "${shopName}"
จงสร้างสคริปต์พูดสด (Teleprompter Pitch) สำหรับสินค้าบนหน้าจอไลฟ์สด:
- ชื่อสินค้า: "${product.product_name}"
- ตะกร้าที่: #${product.basket_no}
- ราคาปกติ: ฿${product.regular_price}
- ราคาพิเศษเฉพาะในไลฟ์: ฿${product.live_price} (ประหยัด ฿${savings})
- สต็อกคงเหลือ: ${product.stock} ชิ้น
- จุดเด่น: ${product.highlight_tag || 'สินค้าขายดี'}

โปรดส่งออกข้อมูลเฉพาะ JSON ที่มีฟิลด์ดังนี้ (ห้ามใส่ Markdown code block อื่นใดนอกเหนือจาก JSON):
{
  "hook15s": "คำพูดเปิดใจ 15 วินาทีแรกที่ดึงดูดคนดูที่กำลังปัดผ่านให้หยุดดู ด้วยน้ำเสียงสนุกสนาน ตื่นเต้น เร่งเร้า",
  "sellingPoints": ["จุดขายหมัดฮุกข้อ 1", "จุดขายหมัดฮุกข้อ 2", "จุดขายหมัดฮุกข้อ 3"],
  "urgencyClosing": "ประโยคปิดการขายกระตุ้นให้รีบพิมพ์ CF เดี๋ยวนี้ สร้าง FOMO ก่อนของหมด",
  "faqAnswers": [
    { "question": "คำถามที่คนมักถามเกี่ยวกับสินค้านี้", "answer": "คำตอบสั้นกระชับน่าประทับใจ" },
    { "question": "คำถามเรื่องการจัดส่ง/การชำระเงิน", "answer": "คำตอบชวนให้กดสั่ง" }
  ]
}`

  const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-flash-latest']

  for (const model of candidateModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        }
      )

      if (response.ok) {
        const json = await response.json()
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (rawText) {
          const parsed = JSON.parse(rawText)
          if (parsed.hook15s && Array.isArray(parsed.sellingPoints)) {
            return {
              hook15s: parsed.hook15s,
              sellingPoints: parsed.sellingPoints,
              urgencyClosing: parsed.urgencyClosing || fallbackPitch.urgencyClosing,
              faqAnswers: Array.isArray(parsed.faqAnswers) ? parsed.faqAnswers : fallbackPitch.faqAnswers,
            }
          }
        }
      }
    } catch (_err) {
      // Continue to next model or fallback
    }
  }

  return fallbackPitch
}

/**
 * Update basket lineup and live special pricing from Dashboard
 */
export async function updateLiveBaskets(
  shopId: string,
  baskets: LiveBasketItem[],
  sessionTitle?: string
): Promise<LiveSessionState> {
  const state = await getLiveSessionState(shopId)
  state.baskets = baskets
  if (sessionTitle) state.title = sessionTitle

  // Ensure current product points to updated basket
  state.current_product = state.baskets.find((b) => b.basket_no === state.current_basket_no) || state.baskets[0] || null
  state.updated_at = new Date().toISOString()

  liveStateCache.set(shopId, state)
  const settingKey = `live_session_${shopId}`
  await supabase.from('settings').upsert({
    key: settingKey,
    value: JSON.stringify(state),
  }, { onConflict: 'key' })

  return state
}
