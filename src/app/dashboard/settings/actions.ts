'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { processSalesAgentChat, getQuotaStatus, QUOTA_EXCEEDED_MESSAGE_TH } from '@/lib/ai/salesAgentEngine'
import { applyProductSearchFilters, buildAvailabilitySlots, formatOrderCloseSummary, formatPaymentInstructions, normalizeBookingDate, parseBookingDateDayKey } from '@/lib/ai/toolDispatcher'
import type { ToolExecutor, ToolExecutionContext, ToolExecutionResult } from '@/lib/ai/toolDispatcher'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { buildAutoGreeting } from '@/lib/businessGreeting'
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


export async function getPlaygroundGreeting() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { greeting: 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return { greeting: 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' }

  const { data: templates } = await supabase
    .from('services')
    .select('name, booking_type, resource_label, staff_name')
    .eq('shop_id', shop.id)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })
    .limit(8)

  return {
    greeting: buildAutoGreeting(shop, templates || []),
    hasTableBooking: (templates || []).some((item: any) => item.booking_type === 'table'),
  }
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
      toolExecutor: previewToolExecutor,
      supabaseClient: supabase,
    })

    // The Planning Layer already ran (possibly several) tool calls internally
    // via previewToolExecutor above, so response.text is the AI's final reply
    // after seeing every tool's (preview) result. immediateMessages carries
    // the preview lines those tool calls produced, appended for visibility.
    const previewLines = response.immediateMessages
      .map((msg) => (msg.type === 'image' ? `[รูปภาพ: ${msg.content}]` : msg.content))
      .join('\n\n')
    const text = previewLines ? `${response.text}\n\n${previewLines}` : response.text

    return { response: text, quotaExceeded: response.quotaExceeded === true }
  } catch (err: any) {
    return { response: `เกิดข้อผิดพลาด: ${err.message}` }
  }
}

/**
 * Chat Playground's ToolExecutor — never runs the real executeTool() dispatcher
 * since it must never create real orders/bookings/etc. Read-only lookups run
 * the same query live so a tester can confirm search actually returns real
 * data. update_customer_note/add_customer_tag also run for real — they're
 * low-risk appends to the tester's own Customer Memory Graph profile, not
 * fake business records, and actually exercising them is the only way to
 * prove memory persists across a fresh Playground session. Anything else
 * (take_order, book_appointment, send_payment_qr, save_lead, ...) is preview-only:
 * the AI is told it "succeeded" via resultForAi so multi-step planning can
 * continue, but no real side effect happens and no message is delivered.
 */
const previewToolExecutor: ToolExecutor = async (name, args, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
  const { supabase, shopId, userId } = ctx

  if (name === 'update_customer_note') {
    await appendCustomerNote(shopId, userId, args.note)
    const line = `[ทดสอบ] เรียกใช้เครื่องมือ update_customer_note: บันทึกแล้ว — "${args.note}" (จะจำได้ในบทสนทนาถัดไป)`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  if (name === 'add_customer_tag') {
    await addCustomerTagUnique(shopId, userId, args.tag)
    const line = `[ทดสอบ] เรียกใช้เครื่องมือ add_customer_tag: เพิ่ม Tag "${args.tag}" แล้ว (จะจำได้ในบทสนทนาถัดไป)`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  if (name === 'search_products') {
    const limit = Math.min(Number(args.limit) || 5, 10)
    const baseQuery = supabase.from('products').select('name,price,stock,description,category').eq('shop_id', shopId).limit(limit)
    const { query, keyword } = applyProductSearchFilters(baseQuery, args)
    const { data: prods } = await query
    if (!prods || prods.length === 0) {
      const line = `[ทดสอบ] เรียกใช้เครื่องมือ search_products แต่ไม่พบสินค้าที่ตรงกับ "${keyword || args.keyword || ''}"`
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }
    const list = prods.map((p: any, i: number) => `${i + 1}. ${p.name} - ${Number(p.price).toLocaleString()} บาท ${p.stock > 0 ? `(${p.stock} ชิ้น)` : '(หมดสต๊อก)'}`).join('\n')
    const line = `[ทดสอบ] เรียกใช้เครื่องมือ search_products:\n${list}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  if (name === 'check_stock') {
    const { data: prods } = await supabase.from('products').select('name,stock,price').eq('shop_id', shopId).ilike('name', `%${args.product_name || ''}%`).limit(3)
    if (!prods || prods.length === 0) {
      const line = `[ทดสอบ] เรียกใช้เครื่องมือ check_stock แต่ไม่พบสินค้า "${args.product_name || ''}"`
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }
    const info = prods.map((p: any) => `• ${p.name}: ${p.stock > 0 ? `${p.stock} ชิ้น | ${Number(p.price).toLocaleString()} บาท` : 'หมดสต๊อก'}`).join('\n')
    const line = `[ทดสอบ] เรียกใช้เครื่องมือ check_stock:\n${info}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  if (name === 'take_order') {
    const line = `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ take_order:\n${formatOrderCloseSummary(ctx.shop, args)}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  if (name === 'send_payment_qr') {
    const amount = Number(args.amount) || undefined
    const line = `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ send_payment_qr:\n${formatPaymentInstructions(ctx.shop, amount)}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }
  if (name === 'check_available_slots') {
    const bookingDate = normalizeBookingDate(args.date)
    const serviceQuery = String(args.service || args.service_name || '').trim()
    const { data: service } = serviceQuery
      ? await supabase
          .from('services')
          .select('id,name,booking_type,staff_name,resource_label,duration_minutes,available_days,start_time,end_time,buffer_minutes,capacity_per_slot,status')
          .eq('shop_id', shopId)
          .neq('status', 'inactive')
          .ilike('name', `%${serviceQuery}%`)
          .limit(1)
          .maybeSingle()
      : { data: null }

    const dayKey = parseBookingDateDayKey(bookingDate)
    const serviceDays = (service as any)?.available_days as string[] | null | undefined
    const serviceName = (service as any)?.name || serviceQuery
    const serviceId = (service as any)?.id
    const capacityPerSlot = Math.max(Number((service as any)?.capacity_per_slot) || 1, 1)

    if (service && dayKey && serviceDays?.length && !serviceDays.includes(dayKey)) {
      const line = `[ทดสอบ] เรียกใช้เครื่องมือ check_available_slots: ${serviceName} ไม่เปิดให้จองวันที่ ${bookingDate}`
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }

    let bookingQuery = supabase
      .from('bookings')
      .select('booking_time,guest_count')
      .eq('shop_id', shopId)
      .eq('booking_date', bookingDate)
      .neq('status', 'cancelled')

    if (serviceId) bookingQuery = bookingQuery.eq('service_id', serviceId)
    else if (serviceName) bookingQuery = bookingQuery.ilike('service_name', `%${serviceName}%`)

    const { data: booked } = await bookingQuery
    const bookedCounts = new Map<string, number>()
    for (const booking of booked || []) {
      const slot = String((booking as any).booking_time || '').slice(0, 5)
      const seats = Number((booking as any).guest_count) || 1
      bookedCounts.set(slot, (bookedCounts.get(slot) || 0) + seats)
    }

    const allSlots = service
      ? buildAvailabilitySlots((service as any).start_time, (service as any).end_time, (service as any).duration_minutes, (service as any).buffer_minutes)
      : ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
    const free = allSlots.filter((slot) => (bookedCounts.get(slot) || 0) < capacityPerSlot)
    const resource = (service as any)?.resource_label || (service as any)?.staff_name
    const scope = serviceName ? `สำหรับ ${serviceName}${resource ? ` (${resource})` : ''}` : ''
    const line = `[ทดสอบ] เรียกใช้เครื่องมือ check_available_slots ${scope} วันที่ ${bookingDate}: ${free.length ? free.join(', ') : 'ไม่มีเวลาว่าง'}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }
  if (name === 'check_booking') {
    const bid = args.booking_id || args.query
    if (!bid) {
      const line = '[ทดสอบ] ยังตรวจสอบการจองไม่ได้ เพราะยังไม่มีเลขที่การจองหรือคำค้นหา'
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }
    const { data: bk } = await supabase.from('bookings').select('booking_no,customer_name,phone,service_name,booking_date,booking_time,status').eq('shop_id', shopId).or(`id.eq.${bid},booking_no.ilike.%${bid}%`).maybeSingle()
    const line = bk
      ? `[ทดสอบ] เรียกใช้เครื่องมือ check_booking:\n${bk.booking_no} - ${bk.customer_name} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} (${bk.status})`
      : `[ทดสอบ] เรียกใช้เครื่องมือ check_booking แต่ไม่พบเลขที่การจอง ${bid}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  if (name === 'book_appointment') {
    const line = `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ book_appointment:
เลขจองตัวอย่าง: BK-TEST
บริการ: ${args.service || args.service_name}
วันที่: ${normalizeBookingDate(args.date)}
เวลา: ${args.time}
ลูกค้า: ${args.customer_name || args.name || '-'}
เบอร์: ${args.phone || '-'}${args.guest_count || args.people || args.party_size ? `
จำนวน: ${args.guest_count || args.people || args.party_size}` : ''}${args.resource || args.resource_label ? `
พื้นที่/ผู้ให้บริการ: ${args.resource || args.resource_label}` : ''}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }
  if (name === 'reschedule_booking') {
    if (!args.booking_id && !args.query) {
      const line = '[ทดสอบ] ยังเลื่อนการจองไม่ได้ เพราะยังไม่มีเลขที่การจองหรือข้อมูลเดิมสำหรับค้นหา'
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }
    const line = `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ reschedule_booking: ${args.booking_id || args.query} -> ${args.new_date} ${args.new_time}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }
  if (name === 'cancel_booking') {
    if (!args.booking_id && !args.query) {
      const line = '[ทดสอบ] ยังยกเลิกการจองไม่ได้ เพราะยังไม่มีเลขที่การจองหรือข้อมูลเดิมสำหรับค้นหา'
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }
    const line = `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ cancel_booking: ${args.booking_id || args.query}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }
  if (name === 'get_active_promotions') {
    const today = new Date().toISOString().split('T')[0]
    const { data: promos } = await supabase.from('promotions').select('name,discount_type,discount_value,end_date,code').eq('shop_id', shopId).eq('status', 'active').or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false }).limit(5)
    if (!promos || promos.length === 0) {
      const line = `[ทดสอบ] เรียกใช้เครื่องมือ get_active_promotions แต่ไม่พบโปรโมชั่นที่ใช้งานอยู่`
      return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
    }
    const list = promos.map((p: any) => {
      const d = p.discount_type === 'percent' ? `ลด ${p.discount_value}%` : `ลด ${Number(p.discount_value).toLocaleString()} บาท`
      return `• ${p.name} - ${d}${p.code ? ` (โค้ด: ${p.code})` : ''}`
    }).join('\n')
    const line = `[ทดสอบ] เรียกใช้เครื่องมือ get_active_promotions:\n${list}`
    return { resultForAi: line, immediateMessages: [{ type: 'text', content: line }] }
  }

  // Any other tool (take_order, book_appointment, send_payment_qr, save_lead, ...)
  // is a real side effect on the live LINE webhook — never execute it here.
  const line = `[ทดสอบ] บอทต้องการเรียกใช้เครื่องมือ "${name}" (${JSON.stringify(args)}) — ในโหมดทดสอบจะไม่มีการบันทึกข้อมูลจริง`
  return { resultForAi: 'ดำเนินการเรียบร้อยแล้ว (โหมดทดสอบ)', immediateMessages: [{ type: 'text', content: line }] }
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
