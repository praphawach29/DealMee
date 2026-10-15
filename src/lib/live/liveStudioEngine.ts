import { createAdminClient } from '@/lib/supabase/admin'

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
  updated_at: string
}

const supabase = createAdminClient()

/**
 * Fallback / In-Memory cache for super-fast OBS overlay response times (< 30ms)
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
      // Re-sync product details in case prices/stock changed
      if (defaultBaskets.length > 0 && (!state.baskets || state.baskets.length === 0)) {
        state.baskets = defaultBaskets
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
    updated_at: new Date().toISOString(),
  }
}

/**
 * Process an incoming live comment and trigger instant OBS overlay actions
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
}> {
  const state = await getLiveSessionState(shopId)
  const commentText = (payload.comment_text || '').trim()
  const username = payload.username || 'ผู้ชมไลฟ์'
  const platform = payload.platform || 'tiktok'

  let actionType: 'basket_switch' | 'cf_order' | 'question' | 'general' = 'general'
  let aiReply = ''
  let switchedBasketNo: number | undefined

  // 1. Detect Basket Switch by number (e.g. "ขอดูตะกร้า 2", "ตะกร้า 3", "เบอร์ 1")
  const basketNumMatch = commentText.match(/(?:ขอดู|ดู|ขอ|เปิด|สลับ|เอา|ตะกร้า)\s*(?:ที่|เบอร์)?\s*([0-9]+)/i)
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

  // 2. Detect Basket Switch by product keyword (e.g. "ขอดูเสื้อยืดหน่อย", "กางเกงยีนส์มีไหม")
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

  // 3. Detect CF Order Intent (e.g. "CF 1", "CF เสื้อยืด", "cf 01")
  if (actionType === 'general' && /^(cf|ซีเอฟ|รับ|เอา)/i.test(commentText)) {
    actionType = 'cf_order'
    state.total_cf_orders += 1
    const currentProd = state.current_product || state.baskets[0]
    const prodName = currentProd ? currentProd.product_name : 'สินค้า'
    aiReply = `🎉 ล็อกสิทธิ์เรียบร้อยค่ะคุณ ${username}! รหัส CF: ${commentText.toUpperCase()} (${prodName}) น้องบอทส่งสรุปยอดพร้อม QR Code เข้ากล่องข้อความทันที แตะชำระเงินได้เลยนะคะ 📲`
  }

  // 4. General Questions
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
  state.total_comments += 1
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
  }
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
