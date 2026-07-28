import type { SupabaseClient } from '@supabase/supabase-js'
import generatePayload from 'promptpay-qr'
import qrcode from 'qrcode'
import type { AgentToolName } from './salesAgentEngine'

const QR_BUCKET = 'qr-codes'

export interface ToolExecutionContext {
  shopId: string
  userId: string
  conversationId: string
  shop: any
  /** Anon-key client — same RLS-scoped instance the webhook already uses for DB reads/writes. */
  supabase: SupabaseClient
  /** Service-role client — only needed for Supabase Storage (QR upload). */
  supabaseAdmin: SupabaseClient
}

export interface CustomerMessage {
  type: 'text' | 'image'
  content: string
}

export interface ToolExecutionResult {
  /** Fed back to the AI as the tool's result on the next planning-loop turn. */
  resultForAi: string
  /** Messages to push to the customer right away (e.g. send_payment_qr needs an image push AND a caption push). */
  immediateMessages: CustomerMessage[]
  /** Only schedule_followup uses this — the caller (webhook route) is responsible for the actual setTimeout + LINE push, since this module has no channel/push capability of its own. */
  scheduledMessage?: { delayMs: number; message: CustomerMessage }
}

/** Function shape of executeTool() — lets a caller (e.g. the Chat Playground) supply a different implementation, such as a safe-preview version that never actually mutates orders/bookings/etc. */
export type ToolExecutor = (
  toolName: AgentToolName,
  args: Record<string, any>,
  ctx: ToolExecutionContext
) => Promise<ToolExecutionResult>

const NO_OP: ToolExecutionResult = { resultForAi: 'ดำเนินการเรียบร้อยแล้ว', immediateMessages: [] }

const GENERIC_PRODUCT_SEARCH_WORDS = [
  'สินค้า',
  'รายการสินค้า',
  'สินค้าทั้งหมด',
  'ทั้งหมด',
  'ทุกอย่าง',
  'อะไรบ้าง',
  'มีอะไร',
  'ของขาย',
  'ของ',
  'products',
  'product',
  'all',
]


const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type BookingRecord = {
  id: string
  booking_no: string
  customer_name: string | null
  phone: string | null
  service_name: string | null
  booking_date: string
  booking_time: string | null
  status: string | null
  note?: string | null
  resource_label?: string | null
  guest_count?: number | null
}

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
}

function formatIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function normalizeBookingDate(dateValue: unknown) {
  const text = String(dateValue || '').trim().toLowerCase()
  if (!text) return ''

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return text

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`

  const today = bangkokToday()
  const offset = text.includes('มะรืน') ? 2 : text.includes('พรุ่งนี้') ? 1 : text.includes('วันนี้') ? 0 : null
  if (offset !== null) {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() + offset)
    return formatIsoDate(date)
  }

  return text
}

export function parseBookingDateDayKey(dateValue: unknown) {
  const text = normalizeBookingDate(dateValue)
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return null

  const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
  return DAY_KEYS[date.getUTCDay()]
}

function normalizeBookingTime(timeValue: unknown) {
  const text = String(timeValue || '').trim()
  const match = text.match(/(\d{1,2})(?::|\.)(\d{2})|^(\d{1,2})$/)
  if (!match) return text
  const hours = Number(match[1] || match[3])
  const minutes = Number(match[2] || 0)
  if (!Number.isFinite(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return text
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

async function findBookingForAction(supabase: SupabaseClient, shopId: string, args: Record<string, any>, userId: string) {
  const lookup = String(args.booking_id || args.booking_no || args.query || '').trim()
  const phone = String(args.phone || '').trim()
  const customerName = String(args.customer_name || args.name || '').trim()
  const date = normalizeBookingDate(args.date || args.booking_date || args.old_date)
  const time = normalizeBookingTime(args.time || args.booking_time || args.old_time)
  const baseSelect = 'id,booking_no,customer_name,phone,service_name,booking_date,booking_time,status,note,resource_label,guest_count'

  let query = supabase
    .from('bookings')
    .select(baseSelect)
    .eq('shop_id', shopId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(5)

  if (lookup) {
    query = UUID_RE.test(lookup) ? query.eq('id', lookup) : query.ilike('booking_no', `%${lookup}%`)
  } else if (phone || customerName || date || time) {
    if (phone) query = query.ilike('phone', `%${phone}%`)
    if (customerName) query = query.ilike('customer_name', `%${customerName}%`)
    if (date) query = query.eq('booking_date', date)
    if (time) query = query.eq('booking_time', time)
  } else {
    query = query.contains('metadata', { line_user_id: userId })
  }

  const { data, error } = await query
  if (error) return { error: error.message, booking: null as BookingRecord | null, matches: [] as BookingRecord[] }

  const matches = (data || []) as BookingRecord[]
  return { error: '', booking: matches.length === 1 ? matches[0] : null, matches }
}

function timeToMinutes(value: unknown) {
  const [hours, minutes] = String(value || '00:00').slice(0, 5).split(':').map(Number)
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, '0')
  const minutes = (value % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function getSlotIntervalMinutes(durationMinutes: unknown, bufferMinutes: unknown) {
  const duration = Math.max(Number(durationMinutes) || 60, 5)
  const buffer = Math.max(Number(bufferMinutes) || 0, 0)
  return Math.max(duration + buffer, 15)
}

export function buildAvailabilitySlots(startTime: unknown, endTime: unknown, durationMinutes: unknown, bufferMinutes: unknown) {
  const start = timeToMinutes(startTime || '09:00')
  const end = timeToMinutes(endTime || '18:00')
  const duration = Math.max(Number(durationMinutes) || 60, 5)
  const step = getSlotIntervalMinutes(durationMinutes, bufferMinutes)
  const slots: string[] = []

  for (let current = start; current + duration <= end; current += step) {
    slots.push(minutesToTime(current))
  }

  return slots
}

function formatSlotList(slots: string[]) {
  return slots.length > 0 ? slots.map((slot) => `${slot} น.`).join(', ') : '-'
}

function getNearestSlots(targetTime: string, slots: string[], limit = 2) {
  const target = timeToMinutes(targetTime)
  return [...slots]
    .sort((a, b) => Math.abs(timeToMinutes(a) - target) - Math.abs(timeToMinutes(b) - target))
    .slice(0, limit)
}

function formatSlotCadence(intervalMinutes: number) {
  return `ระบบเปิดรอบจองทุก ${intervalMinutes} นาทีตามเวลาที่ร้านตั้งไว้`
}
export function normalizeProductSearchKeyword(rawKeyword: unknown): string {
  if (typeof rawKeyword !== 'string') return ''

  let keyword = rawKeyword
    .toLowerCase()
    .replace(/["'`“”‘’!?？,，.。:;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const word of [...GENERIC_PRODUCT_SEARCH_WORDS].sort((a, b) => b.length - a.length)) {
    keyword = keyword.replaceAll(word, ' ')
  }

  keyword = keyword
    .replace(/\b(please|show|list|what|do|you|have)\b/g, ' ')
    .replace(/(ครับ|ค่ะ|คะ|จ้า|หน่อย|ขอ|ช่วย|แนะนำ|ดู|ให้|มี)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return keyword.length >= 2 ? keyword : ''
}

export function applyProductSearchFilters(query: any, args: Record<string, any>) {
  const keyword = normalizeProductSearchKeyword(args.keyword || args.query)
  const category = normalizeProductSearchKeyword(args.category)

  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,category.ilike.%${keyword}%`)
  }
  if (category) query = query.ilike('category', `%${category}%`)
  if (args.max_price) query = query.lte('price', Number(args.max_price))

  return { query, keyword }
}
function cleanLineValue(value: unknown, fallback = '-'): string {
  const text = String(value || '').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

export function formatPaymentInstructions(shop: any, amount?: number): string {
  const lines: string[] = []
  const promptpayId = cleanLineValue(shop.promptpay_id || shop.promptpay_number, '')
  const promptpayName = cleanLineValue(shop.promptpay_name || shop.name)
  const bankName = cleanLineValue(shop.bank_name, '')
  const bankAccountNumber = cleanLineValue(shop.bank_account_number, '')
  const bankAccountName = cleanLineValue(shop.bank_account_name || shop.name)

  if (typeof amount === 'number' && Number.isFinite(amount)) {
    lines.push(`ยอดที่ต้องชำระ: ${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`)
  }

  if (promptpayId) {
    lines.push(`พร้อมเพย์: ${promptpayId}`)
    lines.push(`ชื่อบัญชี: ${promptpayName}`)
  }

  if (bankAccountNumber) {
    if (lines.length > 0) lines.push('')
    lines.push(`ธนาคาร: ${bankName || '-'}`)
    lines.push(`เลขบัญชี: ${bankAccountNumber}`)
    lines.push(`ชื่อบัญชี: ${bankAccountName}`)
  }

  if ((shop.shipping_fee_type || '').toLowerCase().includes('cod')) {
    if (lines.length > 0) lines.push('')
    lines.push('เก็บเงินปลายทาง: แจ้งแอดมินเพื่อยืนยันพื้นที่จัดส่ง')
  }

  if (lines.length === 0) return 'ร้านยังไม่ได้ตั้งค่าช่องทางชำระเงิน กรุณารอแอดมินยืนยันช่องทางชำระเงิน'

  return `${lines.join('\n')}\n\nโอนแล้วส่งสลิปกลับมาในแชทนี้ได้เลยนะคะ`
}

export function formatOrderCloseSummary(shop: any, args: Record<string, any>): string {
  const total = Number(args.total_price) || 0
  const paymentInstructions = formatPaymentInstructions(shop, total)
  return [
    'สรุปออเดอร์เรียบร้อยค่ะ',
    '',
    `สินค้า: ${cleanLineValue(args.product)} x${cleanLineValue(args.qty)}`,
    `ยอดสุทธิ: ${total.toLocaleString('th-TH')} บาท`,
    '',
    'ข้อมูลจัดส่ง',
    `ชื่อผู้รับ: ${cleanLineValue(args.name)}`,
    `เบอร์โทร: ${cleanLineValue(args.phone)}`,
    `ที่อยู่: ${cleanLineValue(args.address)}`,
    `วิธีชำระเงิน: ${cleanLineValue(args.payment_method || 'โอนเงิน')}`,
    '',
    'ช่องทางชำระเงิน',
    paymentInstructions,
  ].join('\n')
}

/**
 * Executes a single AI tool call against the database and returns what
 * happened — channel-agnostic (knows nothing about LINE/webhooks). The
 * caller decides how to actually deliver `immediateMessages`/`scheduledMessage`
 * to the customer. This is what used to be a 17-branch if/else chain living
 * directly in the LINE webhook route; extracted so the same tool logic can
 * be reused by the Planning Layer's multi-step loop (which calls this
 * repeatedly per message) without duplicating it per channel.
 */
export async function executeTool(
  toolName: AgentToolName,
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { shopId, userId, conversationId, shop, supabase, supabaseAdmin } = ctx

  // ── 💳 PAYMENT TOOLS ─────────────────────────────────────────────────
  if (toolName === 'send_payment_qr') {
    const { amount, order_summary } = args
    const promptpayId = shop.promptpay_id || shop.promptpay_number
    if (!promptpayId) {
      return { resultForAi: 'ร้านยังไม่ได้ตั้งค่าพร้อมเพย์', immediateMessages: [] }
    }
    const qrPublicUrl = await generateAndUploadQR(supabaseAdmin, amount, promptpayId, shopId)
    if (qrPublicUrl) {
      const caption = `📋 ยอดชำระ: *${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท*${order_summary ? `\n${order_summary}` : ''}\n\n✅ บันทึกรูป QR แล้วเปิดแอปธนาคารสแกนได้เลยค่ะ\n📲 โอนเสร็จกรุณาส่งสลิปกลับมาในแชทนะคะ`
      return {
        resultForAi: `ส่ง QR PromptPay ให้ลูกค้าแล้ว ยอด ${amount} บาท`,
        immediateMessages: [
          { type: 'image', content: qrPublicUrl },
          { type: 'text', content: caption },
        ],
      }
    }
    const fallback = `💳 ช่องทางชำระเงิน:\n- พร้อมเพย์: ${promptpayId}\n- ชื่อ: ${shop.promptpay_name || shop.name}\n- ยอด: ${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`
    return { resultForAi: 'สร้าง QR ไม่สำเร็จ ส่งข้อมูลบัญชีแทน', immediateMessages: [{ type: 'text', content: fallback }] }
  }

  if (toolName === 'take_order') {
    await supabase.from('orders').insert({
      shop_id: shopId,
      conversation_id: conversationId,
      customer_name: args.name,
      customer_phone: args.phone,
      product_name: args.product,
      quantity: args.qty,
      variants: args.variants,
      address: args.address,
      payment_method: args.payment_method,
      total_amount: args.total_price,
      tax_invoice: args.tax_invoice,
      status: 'pending',
    })
    // Customer Memory Graph: roll up order stats automatically — no
    // dedicated AI tool call needed for this. Imported lazily to avoid a
    // circular import at module-load time (customerMemory <-> engine).
    const { recordCustomerOrder } = await import('@/lib/customerMemory')
    await recordCustomerOrder(shopId, userId, Number(args.total_price) || 0)
    const confirmMsg = formatOrderCloseSummary(shop, args)
    return { resultForAi: `สร้างออเดอร์แล้วและส่งข้อมูลชำระเงินให้ลูกค้าแล้ว:\n${confirmMsg}`, immediateMessages: [{ type: 'text', content: confirmMsg }] }
  }

  if (toolName === 'request_human_agent') {
    await supabase.from('conversations').update({ status: 'human' }).eq('id', conversationId)
    const handoffMsg = `🙋 กำลังเรียกแอดมินเข้ามาดูแลค่ะ กรุณารอสักครู่นะคะ...\n(เหตุผล: ${args.reason})`
    return { resultForAi: 'โอนสายให้แอดมินแล้ว', immediateMessages: [{ type: 'text', content: handoffMsg }] }
  }

  if (toolName === 'transfer_to_agent') {
    await supabase.from('conversations').update({
      status: 'ai',
      last_message: `[โอนสายไป ${args.target_agent}] ${args.reason}`,
    }).eq('id', conversationId)
    return {
      resultForAi: `โอนสายไป ${args.target_agent} แล้ว`,
      immediateMessages: [{ type: 'text', content: `🔄 กำลังส่งต่อให้แผนก ${args.target_agent} ค่ะ...` }],
    }
  }

  if (toolName === 'update_customer_note') {
    // Kept for backward compatibility — nothing currently reads this field,
    // but zero cost to keep it in sync. The Customer Memory Graph's
    // append-only history is what the AI actually uses for cross-session memory.
    await supabase.from('conversations').update({ customer_note: args.note }).eq('id', conversationId)
    const { appendCustomerNote } = await import('@/lib/customerMemory')
    await appendCustomerNote(shopId, userId, args.note)
    return NO_OP
  }

  if (toolName === 'add_customer_tag') {
    await supabase.from('conversations').update({ customer_tag: args.tag }).eq('id', conversationId)
    const { addCustomerTagUnique } = await import('@/lib/customerMemory')
    await addCustomerTagUnique(shopId, userId, args.tag)
    return NO_OP
  }

  if (toolName === 'save_lead') {
    await supabase.from('leads').upsert({
      shop_id: shopId,
      user_id: userId,
      product_name: args.product_name,
      customer_name: args.customer_name || args.name || `LINE-${userId.substring(0, 6)}`,
      source: 'LINE',
      status: 'new',
    }, { onConflict: 'shop_id,user_id' })
    return { resultForAi: `บันทึก lead: ${args.product_name}`, immediateMessages: [] }
  }

  if (toolName === 'schedule_followup') {
    const delayMs = Math.min((args.delay_minutes || 60) * 60 * 1000, 3600000) // cap at 1 hour for safety
    const followupMsg = `👋 สวัสดีค่ะ ไม่ทราบว่าตัดสินใจได้แล้วหรือยังคะ? มีอะไรให้ช่วยแนะนำเพิ่มเติมได้เลยนะคะ 😊`
    return {
      resultForAi: 'ตั้งเวลาส่งข้อความติดตามแล้ว',
      immediateMessages: [],
      scheduledMessage: { delayMs, message: { type: 'text', content: followupMsg } },
    }
  }

  // ── 📦 PRODUCT TOOLS ─────────────────────────────────────────────
  if (toolName === 'search_products') {
    const limit = Math.min(Number(args.limit) || 5, 10)
    const baseQuery = supabase.from('products').select('name,price,stock,description,category').eq('shop_id', shopId).limit(limit)
    const { query, keyword } = applyProductSearchFilters(baseQuery, args)
    const { data: prods } = await query
    if (!prods || prods.length === 0) {
      return { resultForAi: `ไม่พบสินค้าที่ตรงกับ "${keyword || args.keyword || ''}"`, immediateMessages: [{ type: 'text', content: '❌ ไม่พบสินค้าที่ค้นหาค่ะ ลองคำอื่นดูนะคะ' }] }
    }
    const list = prods.map((p: any, i: number) => `${i + 1}. ${p.name}\n   💰 ${Number(p.price).toLocaleString()} บาท ${p.stock > 0 ? `| ${p.stock} ชิ้น` : '| หมดสต๊อก'}`).join('\n\n')
    return {
      resultForAi: prods.map((p: any) => `${p.name}: ${p.price} บาท, สต็อก ${p.stock}`).join('; '),
      immediateMessages: [{ type: 'text', content: `🛍️ สินค้าที่ค้นพบ:\n\n${list}\n\nสนใจสินค้าไหนบอกได้เลยนะคะ 😊` }],
    }
  }

  if (toolName === 'check_stock') {
    const { data: prods } = await supabase.from('products').select('name,stock,price').eq('shop_id', shopId).ilike('name', `%${args.product_name}%`).limit(3)
    if (!prods || prods.length === 0) {
      return { resultForAi: `ไม่พบสินค้า "${args.product_name}"`, immediateMessages: [{ type: 'text', content: `❌ ไม่พบสินค้า "${args.product_name}" ค่ะ` }] }
    }
    const info = prods.map((p: any) => `• ${p.name}: ${p.stock > 0 ? `${p.stock} ชิ้น | ${Number(p.price).toLocaleString()} บาท` : '❌ หมดสต๊อก'}`).join('\n')
    return {
      resultForAi: prods.map((p: any) => `${p.name}: สต็อก ${p.stock}, ราคา ${p.price} บาท`).join('; '),
      immediateMessages: [{ type: 'text', content: `📦 สต๊อกสินค้า:\n\n${info}` }],
    }
  }

  if (toolName === 'check_order_status') {
    const oid = args.order_id
    const { data: ord } = await supabase.from('orders').select('order_no,status,payment_status,tracking_no,product_name,total_amount').eq('shop_id', shopId).or(`id.eq.${oid},order_no.ilike.%${oid}%`).single()
    if (!ord) {
      return { resultForAi: 'ไม่พบข้อมูลออเดอร์', immediateMessages: [{ type: 'text', content: '❌ ไม่พบข้อมูลออเดอร์ค่ะ' }] }
    }
    const sMap: Record<string, string> = { pending: '⏳ รอดำเนินการ', confirmed: '✅ ยืนยันแล้ว', processing: '🔄 กำลังดำเนินการ', shipped: '🚚 จัดส่งแล้ว', delivered: '✅ ส่งถึงแล้ว', cancelled: '❌ ยกเลิก' }
    const pMap: Record<string, string> = { pending: '⏳ รอชำระ', paid: '✅ ชำระแล้ว', failed: '❌ ล้มเหลว' }
    const text = `📦 ออเดอร์ ${ord.order_no}\nสินค้า: ${ord.product_name}\nยอด: ${Number(ord.total_amount).toLocaleString()} บาท\nสถานะ: ${sMap[ord.status] ?? ord.status}\nชำระเงิน: ${pMap[ord.payment_status] ?? ord.payment_status}${ord.tracking_no ? `\nพัสดุ: ${ord.tracking_no}` : ''}`
    return { resultForAi: `ออเดอร์ ${ord.order_no}: สถานะ ${ord.status}, ชำระเงิน ${ord.payment_status}`, immediateMessages: [{ type: 'text', content: text }] }
  }

  // ── 📅 BOOKING TOOLS ──────────────────────────────────────────────
  if (toolName === 'check_available_slots') {
    const bookingDate = normalizeBookingDate(args.date)
    const serviceQuery = String(args.service || args.service_name || '').trim()
    const { data: service } = serviceQuery
      ? await supabase
          .from('services')
          .select('id,name,booking_type,staff_name,resource_label,duration_minutes,available_days,start_time,end_time,buffer_minutes,capacity_per_slot,deposit_amount,required_fields,status')
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
      return {
        resultForAi: `${serviceName} ไม่ได้เปิดให้บริการวันที่ ${bookingDate}`,
        immediateMessages: [{ type: 'text', content: `${serviceName} ไม่ได้เปิดให้บริการวันที่ ${bookingDate} ค่ะ รบกวนเลือกวันอื่นนะคะ` }],
      }
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
    const slotInterval = service
      ? getSlotIntervalMinutes((service as any).duration_minutes, (service as any).buffer_minutes)
      : 60
    const free = allSlots.filter((slot) => (bookedCounts.get(slot) || 0) < capacityPerSlot)

    if (free.length > 0) {
      const serviceLine = serviceName ? `สำหรับ ${serviceName}${((service as any)?.resource_label || (service as any)?.staff_name) ? ` (${(service as any).resource_label || (service as any).staff_name})` : ''}` : ''
      const cadence = formatSlotCadence(slotInterval)
      return {
        resultForAi: `${cadence}. เวลาว่างวันที่ ${bookingDate}${serviceLine ? ` ${serviceLine}` : ''}: ${free.join(', ')}. ใช้ได้เฉพาะเวลาที่อยู่ในรายการนี้เท่านั้น`,
        immediateMessages: [{ type: 'text', content: `ช่วงเวลาว่างวันที่ ${bookingDate}${serviceLine ? ` ${serviceLine}` : ''}
${cadence}

${free.map((slot) => `- ${slot} น.`).join('\n')}

ต้องการจองรอบไหนคะ?` }],
      }
    }

    return {
      resultForAi: `ไม่มีเวลาว่างวันที่ ${bookingDate}`,
      immediateMessages: [{ type: 'text', content: `ไม่มีเวลาว่างวันที่ ${bookingDate} ค่ะ กรุณาเลือกวันอื่นนะคะ` }],
    }
  }

  if (toolName === 'book_appointment') {
    const serviceName = args.service || args.service_name
    const bookingDate = normalizeBookingDate(args.date)
    const bookingTime = normalizeBookingTime(args.time)
    const guestCount = Number(args.guest_count || args.party_size || args.people) || null
    const { data: service } = serviceName
      ? await supabase
          .from('services')
          .select('id,name,booking_type,resource_label,staff_name,deposit_amount,capacity_per_slot,duration_minutes,available_days,start_time,end_time,buffer_minutes')
          .eq('shop_id', shopId)
          .neq('status', 'inactive')
          .ilike('name', `%${serviceName}%`)
          .limit(1)
          .maybeSingle()
      : { data: null }

    const serviceRecord = service as any
    const serviceDays = serviceRecord?.available_days as string[] | null | undefined
    const dayKey = parseBookingDateDayKey(bookingDate)
    if (serviceRecord && dayKey && serviceDays?.length && !serviceDays.includes(dayKey)) {
      return {
        resultForAi: `${serviceRecord.name || serviceName} ไม่ได้เปิดให้จองวันที่ ${bookingDate}`,
        immediateMessages: [{ type: 'text', content: `${serviceRecord.name || serviceName} ไม่ได้เปิดให้จองวันที่ ${bookingDate} ค่ะ รบกวนเลือกวันอื่นนะคะ` }],
      }
    }

    if (serviceRecord) {
      const validSlots = buildAvailabilitySlots(serviceRecord.start_time, serviceRecord.end_time, serviceRecord.duration_minutes, serviceRecord.buffer_minutes)
      const slotInterval = getSlotIntervalMinutes(serviceRecord.duration_minutes, serviceRecord.buffer_minutes)
      if (validSlots.length > 0 && !validSlots.includes(bookingTime)) {
        const nearest = getNearestSlots(bookingTime, validSlots)
        const cadence = formatSlotCadence(slotInterval)
        return {
          resultForAi: `${bookingTime} ไม่ใช่รอบจองที่เปิดไว้สำหรับ ${serviceRecord.name || serviceName}. ${cadence}. รอบที่จองได้: ${validSlots.join(', ')}. รอบใกล้เคียง: ${nearest.join(', ')}`,
          immediateMessages: [{ type: 'text', content: `รอบ ${bookingTime} น. ยังไม่ใช่รอบที่เปิดจองค่ะ
${cadence}

รอบที่จองได้คือ ${formatSlotList(validSlots)}
${nearest.length ? `รอบที่ใกล้ที่สุดคือ ${formatSlotList(nearest)}` : ''}

ต้องการให้จองรอบไหนคะ?` }],
        }
      }
    }

    const capacityPerSlot = Math.max(Number(serviceRecord?.capacity_per_slot) || 1, 1)
    let sameSlotQuery = supabase
      .from('bookings')
      .select('guest_count')
      .eq('shop_id', shopId)
      .eq('booking_date', bookingDate)
      .eq('booking_time', bookingTime)
      .neq('status', 'cancelled')
    if (serviceRecord?.id) sameSlotQuery = sameSlotQuery.eq('service_id', serviceRecord.id)
    else if (serviceName) sameSlotQuery = sameSlotQuery.ilike('service_name', `%${serviceName}%`)
    const { data: sameSlotBookings } = await sameSlotQuery
    const reserved = (sameSlotBookings || []).reduce((sum: number, row: any) => sum + (Number(row.guest_count) || 1), 0)
    const requestedSeats = guestCount || 1
    if (reserved + requestedSeats > capacityPerSlot) {
      return {
        resultForAi: `เวลา ${bookingTime} วันที่ ${bookingDate} เต็มแล้ว`,
        immediateMessages: [{ type: 'text', content: `ขออภัยค่ะ เวลา ${bookingTime} วันที่ ${bookingDate} เต็มแล้ว รบกวนเลือกเวลาอื่นนะคะ` }],
      }
    }

    const bookingNo = `BK-${Date.now().toString().slice(-6)}`
    const customerName = args.customer_name || args.name || `LINE-${userId.substring(0, 6)}`
    const customerPhone = args.phone || '-'
    await supabase.from('bookings').insert({
      shop_id: shopId,
      booking_no: bookingNo,
      customer_name: customerName,
      phone: args.phone,
      service_name: serviceRecord?.name || serviceName,
      service_id: serviceRecord?.id || null,
      booking_type: serviceRecord?.booking_type || args.booking_type || 'service',
      resource_label: args.resource_label || args.resource || serviceRecord?.resource_label || serviceRecord?.staff_name || null,
      guest_count: guestCount,
      deposit_amount: serviceRecord?.deposit_amount || args.deposit_amount || 0,
      booking_date: bookingDate,
      booking_time: bookingTime,
      status: 'confirmed',
      note: args.note,
      metadata: { raw_args: args, line_user_id: userId, conversation_id: conversationId },
    })
    return {
      resultForAi: `จองคิว ${bookingNo}: ${serviceRecord?.name || serviceName} วันที่ ${bookingDate} เวลา ${bookingTime}`,
      immediateMessages: [{ type: 'text', content: `✅ จองเรียบร้อยค่ะ
เลขที่การจอง: ${bookingNo}
บริการ: ${serviceRecord?.name || serviceName}
${guestCount ? `จำนวน: ${guestCount} ท่าน\n` : ''}${args.resource || args.resource_label || serviceRecord?.resource_label ? `พื้นที่/ผู้ให้บริการ: ${args.resource || args.resource_label || serviceRecord?.resource_label}\n` : ''}วันที่: ${bookingDate}
เวลา: ${bookingTime} น.
ชื่อผู้จอง: ${customerName}
เบอร์โทร: ${customerPhone}` }],
    }
  }

  if (toolName === 'check_booking') {
    const lookup = await findBookingForAction(supabase, shopId, args, userId)
    if (lookup.error) {
      return { resultForAi: `ตรวจสอบการจองไม่สำเร็จ: ${lookup.error}`, immediateMessages: [{ type: 'text', content: 'ขออภัยค่ะ ตรวจสอบการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้งนะคะ' }] }
    }
    if (lookup.matches.length > 1) {
      const list = lookup.matches.map((bk) => `${bk.booking_no}: ${bk.customer_name || '-'} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`).join('\n')
      return { resultForAi: `พบหลายรายการ ต้องให้ลูกค้าเลือกเลขที่การจอง:\n${list}`, immediateMessages: [{ type: 'text', content: `พบหลายรายการค่ะ รบกวนเลือกเลขที่การจองที่ต้องการนะคะ\n${list}` }] }
    }
    const bk = lookup.booking
    if (!bk) {
      return { resultForAi: 'ไม่พบข้อมูลการจอง', immediateMessages: [{ type: 'text', content: 'ไม่พบข้อมูลการจองค่ะ รบกวนแจ้งเลขที่การจอง หรือชื่อและเบอร์โทรที่ใช้จองอีกครั้งนะคะ' }] }
    }

    const info = [
      `เลขที่การจอง: ${bk.booking_no}`,
      `ลูกค้า: ${bk.customer_name}${bk.phone ? ` (${bk.phone})` : ''}`,
      `บริการ: ${bk.service_name || '-'}`,
      bk.resource_label ? `พื้นที่/ผู้ให้บริการ: ${bk.resource_label}` : '',
      bk.guest_count ? `จำนวน: ${bk.guest_count}` : '',
      `วันเวลา: ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`,
      `สถานะ: ${bk.status}`,
      bk.note ? `หมายเหตุ: ${bk.note}` : '',
    ].filter(Boolean).join('\n')

    return { resultForAi: info, immediateMessages: [{ type: 'text', content: `ข้อมูลการจองค่ะ\n${info}` }] }
  }

  if (toolName === 'reschedule_booking') {
    const newDate = normalizeBookingDate(args.new_date || args.date)
    const newTime = normalizeBookingTime(args.new_time || args.time)
    if (!newDate || !newTime) {
      return {
        resultForAi: 'ยังไม่มีวันหรือเวลาใหม่ครบถ้วน จึงเลื่อนการจองไม่ได้',
        immediateMessages: [{ type: 'text', content: 'รบกวนแจ้งวันและเวลาใหม่ที่ต้องการเลื่อนด้วยนะคะ' }],
      }
    }

    const lookup = await findBookingForAction(supabase, shopId, args, userId)
    if (lookup.error) {
      return { resultForAi: `ค้นหาการจองไม่สำเร็จ: ${lookup.error}`, immediateMessages: [{ type: 'text', content: 'ขออภัยค่ะ ค้นหาการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้งนะคะ' }] }
    }
    if (lookup.matches.length > 1) {
      const list = lookup.matches.map((bk) => `${bk.booking_no}: ${bk.customer_name || '-'} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`).join('\n')
      return { resultForAi: `พบหลายรายการ ต้องให้ลูกค้าเลือกเลขที่การจองก่อนเลื่อน:\n${list}`, immediateMessages: [{ type: 'text', content: `พบหลายรายการค่ะ รบกวนแจ้งเลขที่การจองที่ต้องการเลื่อนนะคะ\n${list}` }] }
    }
    const bk = lookup.booking
    if (!bk) {
      return { resultForAi: 'ไม่พบข้อมูลการจองสำหรับเลื่อน', immediateMessages: [{ type: 'text', content: 'ยังไม่พบรายการจองค่ะ รบกวนแจ้งเลขที่การจอง หรือชื่อ เบอร์โทร วันและเวลาเดิมอีกครั้งนะคะ' }] }
    }

    const { data: serviceForReschedule } = bk.service_name
      ? await supabase
          .from('services')
          .select('id,name,duration_minutes,start_time,end_time,buffer_minutes,capacity_per_slot,available_days')
          .eq('shop_id', shopId)
          .neq('status', 'inactive')
          .ilike('name', `%${bk.service_name}%`)
          .limit(1)
          .maybeSingle()
      : { data: null }

    const rescheduleService = serviceForReschedule as any
    if (rescheduleService) {
      const dayKey = parseBookingDateDayKey(newDate)
      const serviceDays = rescheduleService.available_days as string[] | null | undefined
      if (dayKey && serviceDays?.length && !serviceDays.includes(dayKey)) {
        return {
          resultForAi: `${rescheduleService.name || bk.service_name} ไม่ได้เปิดให้จองวันที่ ${newDate}`,
          immediateMessages: [{ type: 'text', content: `${rescheduleService.name || bk.service_name} ไม่ได้เปิดให้จองวันที่ ${newDate} ค่ะ รบกวนเลือกวันอื่นนะคะ` }],
        }
      }

      const validSlots = buildAvailabilitySlots(rescheduleService.start_time, rescheduleService.end_time, rescheduleService.duration_minutes, rescheduleService.buffer_minutes)
      const slotInterval = getSlotIntervalMinutes(rescheduleService.duration_minutes, rescheduleService.buffer_minutes)
      if (validSlots.length > 0 && !validSlots.includes(newTime)) {
        const nearest = getNearestSlots(newTime, validSlots)
        const cadence = formatSlotCadence(slotInterval)
        return {
          resultForAi: `${newTime} ไม่ใช่รอบจองที่เปิดไว้สำหรับ ${rescheduleService.name || bk.service_name}. ${cadence}. รอบที่จองได้: ${validSlots.join(', ')}. รอบใกล้เคียง: ${nearest.join(', ')}`,
          immediateMessages: [{ type: 'text', content: `รอบ ${newTime} น. ยังไม่ใช่รอบที่เปิดจองค่ะ
${cadence}

รอบที่จองได้คือ ${formatSlotList(validSlots)}
${nearest.length ? `รอบที่ใกล้ที่สุดคือ ${formatSlotList(nearest)}` : ''}

ต้องการให้เลื่อนไปเป็นรอบไหนคะ?` }],
        }
      }

      const capacityPerSlot = Math.max(Number(rescheduleService.capacity_per_slot) || 1, 1)
      const { data: sameSlotBookings } = await supabase
        .from('bookings')
        .select('guest_count')
        .eq('shop_id', shopId)
        .eq('booking_date', newDate)
        .eq('booking_time', newTime)
        .neq('status', 'cancelled')
        .neq('id', bk.id)
        .eq('service_id', rescheduleService.id)
      const reserved = (sameSlotBookings || []).reduce((sum: number, row: any) => sum + (Number(row.guest_count) || 1), 0)
      const requestedSeats = Number(bk.guest_count) || 1
      if (reserved + requestedSeats > capacityPerSlot) {
        return {
          resultForAi: `เวลา ${newTime} วันที่ ${newDate} เต็มแล้ว`,
          immediateMessages: [{ type: 'text', content: `ขออภัยค่ะ เวลา ${newTime} วันที่ ${newDate} เต็มแล้ว รบกวนเลือกเวลาอื่นนะคะ` }],
        }
      }
    }

    await supabase
      .from('bookings')
      .update({ booking_date: newDate, booking_time: newTime, status: 'confirmed' })
      .eq('shop_id', shopId)
      .eq('id', bk.id)

    return {
      resultForAi: `เลื่อนคิว ${bk.booking_no} เป็นวันที่ ${newDate} เวลา ${newTime} แล้ว`,
      immediateMessages: [{ type: 'text', content: `เลื่อนการจองเรียบร้อยค่ะ
เลขที่การจอง: ${bk.booking_no}
บริการ: ${bk.service_name || '-'}
วันเวลาใหม่: ${newDate} ${newTime} น.` }],
    }
  }

  if (toolName === 'cancel_booking') {
    const lookup = await findBookingForAction(supabase, shopId, args, userId)
    if (lookup.error) {
      return { resultForAi: `ค้นหาการจองไม่สำเร็จ: ${lookup.error}`, immediateMessages: [{ type: 'text', content: 'ขออภัยค่ะ ค้นหาการจองไม่สำเร็จ กรุณาลองใหม่อีกครั้งนะคะ' }] }
    }
    if (lookup.matches.length > 1) {
      const list = lookup.matches.map((bk) => `${bk.booking_no}: ${bk.customer_name || '-'} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`).join('\n')
      return { resultForAi: `พบหลายรายการ ต้องให้ลูกค้าเลือกเลขที่การจองก่อนยกเลิก:\n${list}`, immediateMessages: [{ type: 'text', content: `พบหลายรายการค่ะ รบกวนแจ้งเลขที่การจองที่ต้องการยกเลิกนะคะ\n${list}` }] }
    }
    const bk = lookup.booking
    if (!bk) {
      return { resultForAi: 'ไม่พบข้อมูลการจองสำหรับยกเลิก', immediateMessages: [{ type: 'text', content: 'ยังไม่พบรายการจองค่ะ รบกวนแจ้งเลขที่การจอง หรือชื่อ เบอร์โทร วันและเวลาเดิมอีกครั้งนะคะ' }] }
    }

    await supabase.from('bookings').update({ status: 'cancelled' }).eq('shop_id', shopId).eq('id', bk.id)
    return {
      resultForAi: `ยกเลิกการจอง ${bk.booking_no} แล้ว`,
      immediateMessages: [{ type: 'text', content: `✅ ยกเลิกการจอง ${bk.booking_no} (${bk.service_name || '-'} วันที่ ${bk.booking_date}) เรียบร้อยค่ะ` }],
    }
  }
  if (toolName === 'get_customer_history') {
    const { data: ords } = await supabase.from('orders').select('order_no,product_name,total_amount,status,created_at').eq('shop_id', shopId).eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(5)
    if (!ords || ords.length === 0) {
      return { resultForAi: 'ไม่มีประวัติการสั่งซื้อ', immediateMessages: [{ type: 'text', content: '📋 ยังไม่มีประวัติการสั่งซื้อค่ะ' }] }
    }
    const hist = ords.map((o: any) => `• ${o.order_no} - ${o.product_name}\n  ${Number(o.total_amount).toLocaleString()} บาท | ${o.status}`).join('\n\n')
    return {
      resultForAi: ords.map((o: any) => `${o.order_no}: ${o.product_name}, ${o.total_amount} บาท, ${o.status}`).join('; '),
      immediateMessages: [{ type: 'text', content: `📋 ประวัติการสั่งซื้อ:\n\n${hist}` }],
    }
  }

  if (toolName === 'check_loyalty_points') {
    const { data: paidOrds } = await supabase.from('orders').select('total_amount').eq('shop_id', shopId).eq('conversation_id', conversationId).eq('payment_status', 'paid')
    const total = paidOrds?.reduce((s: number, o: any) => s + Number(o.total_amount), 0) ?? 0
    const pts = Math.floor(total / 100)
    return {
      resultForAi: `ยอดซื้อสะสม ${total} บาท, แต้มสะสม ${pts}`,
      immediateMessages: [{ type: 'text', content: `⭐ แต้มสะสมของคุณ\n💰 ยอดซื้อทั้งหมด: ${total.toLocaleString()} บาท\n🎁 แต้มสะสม: ${pts.toLocaleString()} แต้ม\n(ทุก 100 บาท = 1 แต้ม)` }],
    }
  }

  // ── 🎁 PROMOTIONS ─────────────────────────────────────────────────
  if (toolName === 'get_active_promotions') {
    const today = new Date().toISOString().split('T')[0]
    const { data: promos } = await supabase.from('promotions').select('name,description,discount_type,discount_value,end_date,code').eq('shop_id', shopId).eq('status', 'active').or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false }).limit(5)
    if (!promos || promos.length === 0) {
      return { resultForAi: 'ไม่มีโปรโมชั่นที่ใช้งานอยู่', immediateMessages: [{ type: 'text', content: '❌ ยังไม่มีโปรโมชั่นในขณะนี้ค่ะ' }] }
    }
    const list = promos.map((p: any) => {
      const d = p.discount_type === 'percent' ? `ลด ${p.discount_value}%` : `ลด ${Number(p.discount_value).toLocaleString()} บาท`
      return `🎁 ${p.name}\n   ${d}${p.end_date ? ` | ถึง ${p.end_date}` : ''}${p.code ? `\n   โค้ด: ${p.code}` : ''}`
    }).join('\n\n')
    return {
      resultForAi: promos.map((p: any) => `${p.name}: ${p.discount_type} ${p.discount_value}`).join('; '),
      immediateMessages: [{ type: 'text', content: `🔥 โปรโมชั่นพิเศษ:\n\n${list}` }],
    }
  }

  // Any tool without a live DB-backed implementation (get_product_image,
  // get_upsell_products, calculate_installment, etc.) — the AI is expected
  // to answer from context/text alone; dispatch is a no-op.
  return NO_OP
}

// ─── QR Code: Generate & Upload to Supabase Storage ──────────────────────────

/**
 * Generates a PromptPay QR Code image and uploads it to Supabase Storage.
 * Returns the public URL of the uploaded image, or null on failure.
 */
async function generateAndUploadQR(
  supabaseAdmin: SupabaseClient,
  amount: number,
  promptpayId: string,
  shopId: string
): Promise<string | null> {
  try {
    const payload = generatePayload(promptpayId, { amount })

    const qrBuffer = await qrcode.toBuffer(payload, {
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === QR_BUCKET)
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(QR_BUCKET, { public: true })
    }

    const fileName = `${shopId}/${Date.now()}_${amount}thb.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(QR_BUCKET)
      .upload(fileName, qrBuffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error('[QR Upload Error]:', uploadError.message)
      return null
    }

    const { data: urlData } = supabaseAdmin.storage.from(QR_BUCKET).getPublicUrl(fileName)
    return urlData.publicUrl || null
  } catch (err) {
    console.error('[generateAndUploadQR Exception]:', err)
    return null
  }
}
