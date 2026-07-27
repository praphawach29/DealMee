'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { processSalesAgentChat, getQuotaStatus, QUOTA_EXCEEDED_MESSAGE_TH } from '@/lib/ai/salesAgentEngine'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { upsertCustomerProfile, appendCustomerNote, addCustomerTagUnique } from '@/lib/customerMemory'

export async function updateBotSettings(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่สามารถสร้างหรือค้นหาข้อมูลร้านค้าได้' }
  }

  const updateData = {
    name: formData.get('name') as string,
    bot_name: formData.get('bot_name') as string,
    description: formData.get('description') as string,
    personality: formData.get('personality') as string,
    greeting_message: formData.get('greeting_message') as string,
    system_prompt: formData.get('system_prompt') as string,
    line_token: formData.get('line_token') as string,
    line_secret: formData.get('line_secret') as string,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shops')
    .update(updateData)
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/settings')
  return { success: 'บันทึกการตั้งค่าบอทเรียบร้อยแล้ว!' }
}

export async function updatePaymentShippingSettings(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const freeShippingStr = formData.get('free_shipping_threshold') as string
  const free_shipping_threshold = freeShippingStr ? Number(freeShippingStr) : null

  const updateData = {
    promptpay_number: formData.get('promptpay_number') as string,
    promptpay_name: formData.get('promptpay_name') as string,
    bank_name: formData.get('bank_name') as string,
    bank_account_number: formData.get('bank_account_number') as string,
    bank_account_name: formData.get('bank_account_name') as string,
    shipping_provider: formData.get('shipping_provider') as string,
    shipping_fee_type: formData.get('shipping_fee_type') as string,
    shipping_fee_amount: Number(formData.get('shipping_fee_amount') || 0),
    free_shipping_threshold,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('shops')
    .update(updateData)
    .eq('id', shop.id)

  if (error) {
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/settings')
  return { success: 'บันทึกข้อมูลชำระเงินและการจัดส่งเรียบร้อยแล้ว!' }
}

export async function testPlaygroundChat(
  userQuery: string,
  customBotName?: string,
  customPersonality?: string,
  simulateQuotaExceeded?: boolean,
  conversationHistory?: { sender: 'user' | 'bot'; text: string }[]
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { response: 'กรุณาล็อกอินก่อนใช้งานระบบทดสอบแชท' }

  let shop = await getOrCreateShopForUser(supabase, user)

  if (!shop) {
    shop = { id: 'test-shop', name: 'ร้านค้าทดสอบ', bot_name: 'น้อง Botify' }
  }

  const customShop = {
    ...shop,
    bot_name: customBotName || shop.bot_name || 'น้อง Botify',
    personality: customPersonality || shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ',
  }

  // Lets a shop owner preview the exact message customers see once quota runs
  // out, without spending any of the shop's real message quota to trigger it.
  if (simulateQuotaExceeded) {
    return { response: QUOTA_EXCEEDED_MESSAGE_TH, quotaExceeded: true }
  }

  // Customer Memory Graph: mirror the webhook's upsert so the tester's
  // pseudo-customer profile exists before any note/tag tool call needs it,
  // and so the auto-injected profile context works in the Playground too.
  await upsertCustomerProfile(shop.id, user.id, 'ผู้ทดสอบ (Chat Playground)')

  try {
    const response = await processSalesAgentChat({
      shop: customShop,
      userQuery,
      userId: user.id,
      conversationId: `playground-${user.id}`,
      conversationHistory,
    })

    let text = response.text

    // The Playground never runs the real Tool Call Dispatcher (unlike the
    // LINE webhook) since it must never create real orders/bookings/etc. For
    // the read-only lookup tools we run the same query live so a tester can
    // confirm search actually returns real data; for anything else we show a
    // clear preview line instead of silently returning blank/generic text.
    if (response.toolCall) {
      const preview = await previewToolCall(supabase, shop.id, user.id, response.toolCall)
      text = text ? `${text}\n\n${preview}` : preview
    }

    return { response: text, quotaExceeded: response.quotaExceeded === true }
  } catch (err: any) {
    return { response: `เกิดข้อผิดพลาด: ${err.message}` }
  }
}

/**
 * Preview of a tool the AI chose to call, for the Chat Playground only.
 * Read-only lookups run live so a tester can confirm they return real data.
 * update_customer_note/add_customer_tag also run for real — they're
 * low-risk appends to the tester's own Customer Memory Graph profile, not
 * fake business records, and actually exercising them is the only way to
 * prove memory persists across a fresh Playground session. Anything that
 * would create a real order/booking/etc. stays preview-only.
 */
async function previewToolCall(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  userId: string,
  toolCall: { name: string; args: Record<string, any> }
): Promise<string> {
  const { name, args } = toolCall

  if (name === 'update_customer_note') {
    await appendCustomerNote(shopId, userId, args.note)
    return `[ทดสอบ] เรียกใช้เครื่องมือ update_customer_note: บันทึกแล้ว — "${args.note}" (จะจำได้ในบทสนทนาถัดไป)`
  }

  if (name === 'add_customer_tag') {
    await addCustomerTagUnique(shopId, userId, args.tag)
    return `[ทดสอบ] เรียกใช้เครื่องมือ add_customer_tag: เพิ่ม Tag "${args.tag}" แล้ว (จะจำได้ในบทสนทนาถัดไป)`
  }

  if (name === 'search_products') {
    const limit = Math.min(Number(args.limit) || 5, 10)
    let q = supabase.from('products').select('name,price,stock,description').eq('shop_id', shopId).limit(limit)
    if (args.keyword) q = q.ilike('name', `%${args.keyword}%`)
    if (args.category) q = q.eq('category', args.category)
    if (args.max_price) q = q.lte('price', Number(args.max_price))
    const { data: prods } = await q
    if (!prods || prods.length === 0) return `[ทดสอบ] เรียกใช้เครื่องมือ search_products แต่ไม่พบสินค้าที่ตรงกับ "${args.keyword || ''}"`
    const list = prods.map((p: any, i: number) => `${i + 1}. ${p.name} - ${Number(p.price).toLocaleString()} บาท ${p.stock > 0 ? `(${p.stock} ชิ้น)` : '(หมดสต๊อก)'}`).join('\n')
    return `[ทดสอบ] เรียกใช้เครื่องมือ search_products:\n${list}`
  }

  if (name === 'check_stock') {
    const { data: prods } = await supabase.from('products').select('name,stock,price').eq('shop_id', shopId).ilike('name', `%${args.product_name || ''}%`).limit(3)
    if (!prods || prods.length === 0) return `[ทดสอบ] เรียกใช้เครื่องมือ check_stock แต่ไม่พบสินค้า "${args.product_name || ''}"`
    const info = prods.map((p: any) => `• ${p.name}: ${p.stock > 0 ? `${p.stock} ชิ้น | ${Number(p.price).toLocaleString()} บาท` : 'หมดสต๊อก'}`).join('\n')
    return `[ทดสอบ] เรียกใช้เครื่องมือ check_stock:\n${info}`
  }

  if (name === 'get_active_promotions') {
    const today = new Date().toISOString().split('T')[0]
    const { data: promos } = await supabase.from('promotions').select('name,discount_type,discount_value,end_date,code').eq('shop_id', shopId).eq('status', 'active').or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false }).limit(5)
    if (!promos || promos.length === 0) return `[ทดสอบ] เรียกใช้เครื่องมือ get_active_promotions แต่ไม่พบโปรโมชั่นที่ใช้งานอยู่`
    const list = promos.map((p: any) => {
      const d = p.discount_type === 'percent' ? `ลด ${p.discount_value}%` : `ลด ${Number(p.discount_value).toLocaleString()} บาท`
      return `• ${p.name} - ${d}${p.code ? ` (โค้ด: ${p.code})` : ''}`
    }).join('\n')
    return `[ทดสอบ] เรียกใช้เครื่องมือ get_active_promotions:\n${list}`
  }

  // Any other tool (take_order, book_appointment, send_payment_qr, save_lead, ...)
  // is a real side effect on the live LINE webhook — never execute it here.
  return `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ "${name}" (${JSON.stringify(args)}) — ในโหมดทดสอบจะไม่มีการบันทึกข้อมูลจริง`
}

/** Current-period usage vs. plan limit, for display in the Chat Playground so a shop owner can see real quota state while testing. */
export async function getPlaygroundQuotaStatus() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) return null

  try {
    const status = await getQuotaStatus(shop)
    return status
  } catch (err) {
    console.error('[getPlaygroundQuotaStatus] Exception:', err)
    return null
  }
}
