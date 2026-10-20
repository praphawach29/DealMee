import type { SupabaseClient } from '@supabase/supabase-js'
import generatePayload from 'promptpay-qr'
import qrcode from 'qrcode'
import type { AgentToolName } from './salesAgentEngine'
import { t, type CustomerLanguage } from '@/lib/i18n/customerMessages'
import { scheduleQrFollowUp, scheduleBookingReminder } from '@/lib/ai/proactiveFollowUp'
import { buildLineFlexQuotationMessage, buildLineFlexOfficialLetterMessage } from '@/lib/line/flexHelper'
import { resolveCatalogProduct, describeUnresolved, parseQuantity, computeShippingFee, type CatalogProduct } from '@/lib/ai/catalogPricing'
import { highValueThreshold, highValueRefusal } from '@/lib/ai/salesModes'
import { notifyShopAdmin } from '@/lib/billing/ownerAlerts'

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
  /** Language of the customer's message, for the few blocks this module writes itself rather than leaving to the model. Defaults to Thai. */
  language?: CustomerLanguage
}

export interface CustomerMessage {
  type: 'text' | 'image' | 'flex'
  content: string
  flexData?: Record<string, any>
  /**
   * The card's buttons in a channel-neutral form, so channels without LINE Flex
   * (Messenger, Instagram) can still give the customer the document links.
   */
  links?: Array<{ label: string; url: string }>
}

export interface ToolExecutionResult {
  /** Fed back to the AI as the tool's result on the next planning-loop turn. */
  resultForAi: string
  /**
   * Extra messages the customer receives *in addition to* the bot's own
   * reply. Reserve this for things the model cannot produce itself — an
   * image — or must not paraphrase, like a PromptPay number or an order
   * total, where a reworded digit is a real loss.
   *
   * Everything else belongs in `resultForAi` only. A lookup tool that also
   * pushed its findings here would have the customer read the same product
   * list or slot list twice: once from this push and once from the reply the
   * model writes after reading `resultForAi`.
   *
   * When a tool does push here, say so inside `resultForAi` so the model
   * knows not to repeat what the customer already has.
   */
  immediateMessages: CustomerMessage[]
  /** Only schedule_followup uses this — the caller (webhook route) is responsible for the actual setTimeout + LINE push, since this module has no channel/push capability of its own. */
  scheduledMessage?: { delayMs: number; message: CustomerMessage }
  /** Optional product items returned by search_products, used to render LINE Flex Carousel product cards. */
  productsData?: Array<{
    id: string
    name: string
    price: number
    stock?: number | null
    description?: string | null
    image_url?: string | null
  }>
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

/** Current wall-clock time in the shop's timezone as "HH:MM". Vercel runs in UTC, so this must never be derived from the server's local clock. */
function bangkokNowTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

/**
 * Slots earlier than right now can't be booked, but only matters when the
 * requested date is today — "11:00 tomorrow" is fine at 18:00 today. Compares
 * "HH:MM" strings, which sort correctly because they're zero-padded.
 */
function dropPastSlots(slots: string[], bookingDate: string) {
  if (bookingDate !== formatIsoDate(bangkokToday())) return slots
  const now = bangkokNowTime()
  return slots.filter((slot) => slot > now)
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


type BookingServiceRecord = {
  id: string
  name: string | null
  booking_type?: string | null
  staff_name?: string | null
  resource_label?: string | null
  duration_minutes?: number | null
  available_days?: string[] | null
  start_time?: string | null
  end_time?: string | null
  buffer_minutes?: number | null
  capacity_per_slot?: number | null
  deposit_amount?: number | null
  required_fields?: string[] | null
  status?: string | null
}

const BOOKING_SERVICE_SELECT = 'id,name,booking_type,staff_name,resource_label,duration_minutes,available_days,start_time,end_time,buffer_minutes,capacity_per_slot,deposit_amount,required_fields,status'

function normalizeSearchText(value: unknown) {
  return String(value || '').toLowerCase().replace(/[()\[\]{}"'`*_~]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreBookingServiceCandidate(service: BookingServiceRecord, args: Record<string, any>) {
  const queryText = normalizeSearchText([
    args.service,
    args.service_name,
    args.resource,
    args.resource_label,
    args.zone,
    args.booking_type,
  ].filter(Boolean).join(' '))
  const name = normalizeSearchText(service.name)
  const resource = normalizeSearchText(service.resource_label)
  const staff = normalizeSearchText(service.staff_name)
  const type = normalizeSearchText(service.booking_type)
  let score = 0

  if (service.status === 'active' || !service.status) score += 2
  if (type === 'table') score += 18
  if (type === 'service') score += 6
  if (name.includes('จองโต๊ะ') || name.includes('โต๊ะ')) score += 12
  if (resource) score += 2

  if (queryText) {
    for (const token of queryText.split(' ').filter((part) => part.length >= 2)) {
      if (name.includes(token)) score += 18
      if (resource.includes(token)) score += 24
      if (staff.includes(token)) score += 20
      if (type.includes(token)) score += 8
    }
  }

  return score
}

export async function resolveBookingService(supabase: SupabaseClient, shopId: string, args: Record<string, any>) {
  const explicitService = String(args.service || args.service_name || '').trim()
  const explicitResource = String(args.resource || args.resource_label || args.zone || '').trim()
  const requestedType = String(args.booking_type || '').trim()

  const { data } = await supabase
    .from('services')
    .select(BOOKING_SERVICE_SELECT)
    .eq('shop_id', shopId)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })
    .limit(30)

  const services = ((data || []) as BookingServiceRecord[]).filter(Boolean)
  if (services.length === 0) return null

  if (explicitService || explicitResource || requestedType) {
    return [...services].sort((a, b) => scoreBookingServiceCandidate(b, args) - scoreBookingServiceCandidate(a, args))[0] || null
  }

  return services.find((service) => service.booking_type === 'table') || services[0]
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
    // Always scoped to the person asking. Without this, the identifiers below
    // are the only thing standing between a customer and someone else's
    // booking: a guessed booking number or a phone number would let anyone
    // cancel or move a stranger's table. Bookings the shop entered by hand
    // are deliberately out of reach here — staff change those from the
    // dashboard, not by asking the bot.
    .contains('metadata', { line_user_id: userId })
    .order('created_at', { ascending: false })
    .limit(5)

  // These only narrow within the customer's own bookings — with no
  // identifier at all, the scope above already limits it to theirs.
  if (lookup) {
    query = UUID_RE.test(lookup) ? query.eq('id', lookup) : query.ilike('booking_no', `%${lookup}%`)
  } else {
    if (phone) query = query.ilike('phone', `%${phone}%`)
    if (customerName) query = query.ilike('customer_name', `%${customerName}%`)
    if (date) query = query.eq('booking_date', date)
    if (time) query = query.eq('booking_time', time)
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

export function formatPaymentInstructions(shop: any, amount?: number, lang: CustomerLanguage = 'th'): string {
  const lines: string[] = []
  const promptpayId = cleanLineValue(shop.promptpay_id || shop.promptpay_number, '')
  const promptpayName = cleanLineValue(shop.promptpay_name || shop.name)
  const bankName = cleanLineValue(shop.bank_name, '')
  const bankAccountNumber = cleanLineValue(shop.bank_account_number, '')
  const bankAccountName = cleanLineValue(shop.bank_account_name || shop.name)

  if (typeof amount === 'number' && Number.isFinite(amount)) {
    lines.push(`${t('paymentAmountDue', lang)}: ${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${t('currencyBaht', lang)}`)
  }

  if (promptpayId) {
    lines.push(`${t('paymentPromptPay', lang)}: ${promptpayId}`)
    lines.push(`${t('paymentAccountName', lang)}: ${promptpayName}`)
  }

  if (bankAccountNumber) {
    if (lines.length > 0) lines.push('')
    lines.push(`${t('paymentBank', lang)}: ${bankName || '-'}`)
    lines.push(`${t('paymentAccountNo', lang)}: ${bankAccountNumber}`)
    lines.push(`${t('paymentAccountName', lang)}: ${bankAccountName}`)
  }

  if ((shop.shipping_fee_type || '').toLowerCase().includes('cod')) {
    if (lines.length > 0) lines.push('')
    lines.push(t('paymentCod', lang))
  }

  if (lines.length === 0) return t('paymentNotSetUp', lang)

  return `${lines.join('\n')}\n\n${t('paymentSendSlip', lang)}`
}

export function formatOrderCloseSummary(
  shop: any,
  args: Record<string, any>,
  orderNo: string,
  lang: CustomerLanguage = 'th'
): string {
  const total = Number(args.total_price) || 0
  const paymentInstructions = formatPaymentInstructions(shop, total, lang)
  return [
    t('orderSummaryTitle', lang),
    '',
    `${t('orderNo', lang)}: ${orderNo}`,
    `${t('orderItem', lang)}: ${args.items_text ? cleanLineValue(args.items_text) : `${cleanLineValue(args.product)} x${cleanLineValue(args.qty)}`}`,
    `${t('orderTotal', lang)}: ${total.toLocaleString('th-TH')} ${t('currencyBaht', lang)}`,
    '',
    t('orderDeliveryHeading', lang),
    `${t('orderRecipient', lang)}: ${cleanLineValue(args.name)}`,
    `${t('orderPhone', lang)}: ${cleanLineValue(args.phone)}`,
    `${t('orderAddress', lang)}: ${cleanLineValue(args.address)}`,
    `${t('orderPaymentMethod', lang)}: ${cleanLineValue(args.payment_method || t('orderTransferDefault', lang))}`,
    '',
    t('orderPaymentHeading', lang),
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
  const { shopId: rawShopId, userId, conversationId, shop, supabase, supabaseAdmin, language: lang = 'th' } = ctx
  const shopId = rawShopId || shop?.id

  // The tool set offered to the model is the same for every shop (prompt caching),
  // so the shop's switches on /dashboard/modules are enforced here
  const shopFeatures = (shop?.features || {}) as Record<string, any>
  const bookingOn = shopFeatures.booking_system ?? ['booking', 'service'].includes(String(shop?.business_type || ''))
  if (!bookingOn && (toolName === 'check_available_slots' || toolName === 'book_appointment')) {
    return {
      resultForAi: 'ร้านนี้ไม่ได้เปิดระบบจองคิวผ่านแชท แจ้งลูกค้าอย่างสุภาพว่าแอดมินจะติดต่อกลับเพื่อนัดหมายให้',
      immediateMessages: [],
    }
  }
  if (toolName === 'create_official_letter' && shopFeatures.official_letters !== true) {
    return {
      resultForAi: 'ร้านนี้ไม่ได้เปิดระบบร่างหนังสือราชการ แจ้งลูกค้าอย่างสุภาพว่าบริการนี้ยังไม่เปิดให้ใช้งาน',
      immediateMessages: [],
    }
  }

  // High-value products are closed by the admin (src/lib/ai/salesModes.ts). The prompt
  // says so; this stops an order or quotation that slips through anyway.
  if (toolName === 'take_order' || toolName === 'create_quotation') {
    const threshold = highValueThreshold(shopFeatures)
    const requestedNames: string[] = (
      Array.isArray(args.items) && args.items.length > 0
        ? args.items.map((it: any) => String(it?.product || it?.name || it?.product_name || ''))
        : [String(args.product || '')]
    ).map((n: string) => n.trim().toLowerCase()).filter(Boolean)
    if (threshold > 0 && requestedNames.length > 0) {
      const { data: pricey } = await supabaseAdmin
        .from('products')
        .select('name, price')
        .eq('shop_id', shopId)
        .gte('price', threshold)
      const hits = (pricey || []).filter((p: any) => {
        const name = String(p.name || '').toLowerCase()
        return requestedNames.some((req) => req.includes(name) || name.includes(req))
      })
      if (hits.length > 0) {
        return { resultForAi: highValueRefusal(hits.map((p: any) => p.name)), immediateMessages: [] }
      }
    }
  }

  // ── 💳 PAYMENT TOOLS ─────────────────────────────────────────────────
  if (toolName === 'send_payment_qr') {
    const promptpayId = shop.promptpay_id || shop.promptpay_number
    if (!promptpayId) {
      return { resultForAi: 'ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ ยังส่ง QR ไม่ได้ ให้เสนอช่องทางโอนธนาคารแทน', immediateMessages: [] }
    }

    // The QR amount always comes from a record the system created (this customer's pending
    // order, or the deposit of their booking) — never from the model's `amount` argument.
    let amount = 0
    let effectiveOrderNo = ''
    let summary = ''
    if (conversationId) {
      let orderQuery = supabaseAdmin
        .from('orders')
        .select('order_no, total_amount, product_name, quantity')
        .eq('shop_id', shopId)
        .eq('conversation_id', conversationId)
        .eq('status', 'pending')
      if (args.order_id) orderQuery = orderQuery.eq('order_no', String(args.order_id).trim())
      const { data: orders } = await orderQuery.order('created_at', { ascending: false }).limit(1)
      const order = orders?.[0]
      if (order) {
        amount = Number(order.total_amount) || 0
        effectiveOrderNo = order.order_no
        summary = `${order.product_name || ''} x${order.quantity || 1} (${order.order_no})`
      } else {
        const { data: bookings } = await supabaseAdmin
          .from('bookings')
          .select('booking_no, deposit_amount, service_name')
          .eq('shop_id', shopId)
          .eq('metadata->>conversation_id', conversationId)
          .gt('deposit_amount', 0)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
        const booking = bookings?.[0]
        if (booking) {
          amount = Number(booking.deposit_amount) || 0
          effectiveOrderNo = booking.booking_no
          summary = `มัดจำ ${booking.service_name || ''} (${booking.booking_no})`
        }
      }
    }

    if (amount <= 0) {
      return {
        resultForAi: 'ยังไม่มีออเดอร์ที่รอชำระของลูกค้ารายนี้ จึงยังส่ง QR ไม่ได้ ให้เก็บข้อมูลให้ครบแล้วเรียก take_order ก่อน ห้ามบอกยอดชำระเอง',
        immediateMessages: [],
      }
    }
    if (args.amount !== undefined && Math.abs(Number(args.amount) - amount) > 1) {
      console.warn(`[send_payment_qr] Model asked for ${args.amount}, using recorded amount ${amount} for ${effectiveOrderNo}`)
    }

    // The QR image and the amount beside it are pushed verbatim: the model
    // can't produce an image, and a paraphrased total or account number is a
    // payment sent to the wrong place.
    const qrPublicUrl = await generateAndUploadQR(supabaseAdmin, amount, promptpayId, shopId)
    scheduleQrFollowUp({
      shopId,
      conversationId,
      userId,
      orderNumber: effectiveOrderNo,
      amount,
      customerName: args.name || args.customer_name,
    }).catch((err) => console.error('[scheduleQrFollowUp Error]:', err))

    if (qrPublicUrl) {
      const caption = `📋 ${t('qrAmount', lang)}: ${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${t('currencyBaht', lang)}${summary ? `\n${summary}` : ''}\n\n✅ ${t('qrScanHint', lang)}\n📲 ${t('qrSlipHint', lang)}`
      return {
        resultForAi: `ส่งรูป QR PromptPay พร้อมยอด ${amount} บาท (ตามระบบ เลขที่ ${effectiveOrderNo}) และวิธีชำระให้ลูกค้าไปแล้ว ห้ามพิมพ์ยอดหรือวิธีชำระซ้ำ ให้ตอบสั้นๆ เช่น ชวนสแกนแล้วส่งสลิปกลับมา`,
        immediateMessages: [
          { type: 'image', content: qrPublicUrl },
          { type: 'text', content: caption },
        ],
      }
    }
    const fallback = `💳 ${t('orderPaymentHeading', lang)}\n${formatPaymentInstructions(shop, amount, lang)}`
    return { resultForAi: 'สร้าง QR ไม่สำเร็จ ส่งเลขพร้อมเพย์และยอดให้ลูกค้าไปแล้ว ห้ามพิมพ์เลขบัญชีหรือยอดซ้ำ ให้ตอบสั้นๆ ต่อท้ายพอ', immediateMessages: [{ type: 'text', content: fallback }] }
  }

  if (toolName === 'take_order') {
    // Price, stock and shipping come from the shop's catalog and settings. The
    // model's total_price is only compared, never trusted.
    // One order may hold several products (`items`); older calls send a single product/qty
    const requested: Array<{ product: string; qty: unknown; variants?: string }> =
      Array.isArray(args.items) && args.items.length > 0
        ? args.items.map((it: any) => ({ product: String(it?.product || it?.name || ''), qty: it?.qty, variants: it?.variants }))
        : [{ product: String(args.product || ''), qty: args.qty, variants: args.variants }]
    if (requested.length > 20) {
      return { resultForAi: 'รายการสินค้ามากเกินไปสำหรับออเดอร์เดียว ให้เรียก request_human_agent', immediateMessages: [] }
    }

    const lines: Array<{ product: CatalogProduct; qty: number; variants?: string }> = []
    const problems: string[] = []
    for (const req of requested) {
      const qty = parseQuantity(req.qty)
      if (!qty) {
        problems.push(`จำนวนของ "${req.product || 'สินค้า'}" ไม่ถูกต้อง ให้ถามลูกค้าว่าต้องการกี่ชิ้น`)
        continue
      }
      const resolution = await resolveCatalogProduct(supabaseAdmin || supabase, shopId, req.product)
      if (resolution.status !== 'found') {
        problems.push(describeUnresolved(req.product, resolution))
        continue
      }
      const variants = req.variants && req.variants !== '-' ? req.variants : undefined
      const same = lines.find((l) => l.product.id === resolution.product.id && l.variants === variants)
      if (same) same.qty += qty
      else lines.push({ product: resolution.product, qty, variants })
    }

    // Stock is per product, whatever the variant
    const qtyByProduct = new Map<string, { product: CatalogProduct; qty: number }>()
    for (const l of lines) {
      const cur = qtyByProduct.get(l.product.id)
      qtyByProduct.set(l.product.id, { product: l.product, qty: (cur?.qty || 0) + l.qty })
    }
    for (const { product, qty } of qtyByProduct.values()) {
      if (product.stock !== null && product.stock < qty) {
        problems.push(product.stock <= 0
          ? `${product.name} หมดสต๊อก ให้แจ้งลูกค้าและเสนอสินค้าอื่น`
          : `${product.name} เหลือเพียง ${product.stock} ชิ้น แต่ลูกค้าสั่ง ${qty} ชิ้น ให้ถามลูกค้าว่าจะรับ ${product.stock} ชิ้นไหม`)
      }
    }
    if (problems.length > 0 || lines.length === 0) {
      return { resultForAi: `ยังสร้างออเดอร์ไม่ได้: ${problems.join(' / ') || 'ไม่มีรายการสินค้า'} แล้วเรียก take_order ใหม่พร้อมสินค้าทุกรายการ`, immediateMessages: [] }
    }

    const lineLabel = (l: { product: CatalogProduct; qty: number; variants?: string }) =>
      `${l.product.name}${l.variants ? ` (${l.variants})` : ''} x${l.qty}`
    const itemsText = lines.map(lineLabel).join(', ')
    const totalQty = lines.reduce((sum, l) => sum + l.qty, 0)
    const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0)
    const isCod = /ปลายทาง|cod/i.test(String(args.payment_method || ''))
    const { fee: shippingFee } = computeShippingFee(shop, String(args.address || ''), subtotal)
    const totalAmount = subtotal + shippingFee
    const modelTotal = Number(args.total_price)
    const priceNote = Number.isFinite(modelTotal) && Math.abs(modelTotal - totalAmount) > 1
      ? ` [หมายเหตุ: ยอดที่คุณคำนวณ ${modelTotal} บาทไม่ตรงกับระบบ ให้ใช้ยอดตามระบบเท่านั้น ห้ามบอกยอดอื่น]`
      : ''
    const pricedArgs = { ...args, product: itemsText, qty: totalQty, items_text: itemsText, total_price: totalAmount }

    // orders.order_no defaults to 'ORD-000' and nothing was overriding it, so
    // every order the bot took shared one number: indistinguishable in the
    // dashboard, and check_order_status had nothing real to look up. Same
    // shape as the booking side's BK- number, which did generate one.
    const orderNo = `ORD-${Date.now().toString().slice(-6)}`
    const { error: orderError } = await supabase.from('orders').insert({
      shop_id: shopId,
      order_no: orderNo,
      conversation_id: conversationId,
      customer_name: args.name,
      customer_phone: args.phone,
      product_name: itemsText.slice(0, 200),
      quantity: String(totalQty),
      variants: lines.map((l) => l.variants).filter(Boolean).join(', ') || args.variants,
      address: args.address,
      payment_method: args.payment_method,
      total_amount: totalAmount,
      tax_invoice: args.tax_invoice,
      items_summary: `${lines.map((l) => `${lineLabel(l)} @ ${l.product.price}`).join(', ')} + ค่าส่ง ${shippingFee}${isCod ? ' (COD)' : ''}`,
      status: 'pending',
    })
    if (orderError) {
      console.error('[take_order Error]:', orderError)
      return {
        resultForAi: 'บันทึกออเดอร์ไม่สำเร็จเพราะระบบขัดข้อง ห้ามบอกลูกค้าว่าสั่งซื้อสำเร็จ ให้ขออภัยและเรียก request_human_agent',
        immediateMessages: [],
      }
    }
    // Schedule proactive QR/Payment follow-up task
    scheduleQrFollowUp({
      shopId,
      conversationId,
      userId,
      orderNumber: orderNo,
      amount: totalAmount,
      customerName: args.name,
    }).catch((err) => console.error('[scheduleQrFollowUp Error]:', err))

    // Customer Memory Graph: roll up order stats automatically — no
    // dedicated AI tool call needed for this. Imported lazily to avoid a
    // circular import at module-load time (customerMemory <-> engine).
    const { recordCustomerOrder } = await import('@/lib/customerMemory')
    await recordCustomerOrder(shopId, userId, totalAmount)

    // Central Stock Deduction: Deduct from central pooled inventory across channels
    try {
      const { deductCentralStockOnOrder } = await import('@/lib/marketplace/inventoryManager')
      // By id: deducting by name matched the first product whose name merely contained it
      for (const { product, qty } of qtyByProduct.values()) {
        await deductCentralStockOnOrder(shopId, product.id, qty, 'line', orderNo)
      }
    } catch (stockErr) {
      console.error('[Central Stock Deduction Error]:', stockErr)
    }

    await updateSalesStage(ctx, 'post_sale')
    // Pushed verbatim rather than left to the model: this block carries the
    // order total and the shop's account number, and a reworded digit here
    // sends the customer's money somewhere it shouldn't go.
    // Push LINE notification to shop admin if admin_notify is enabled
    if (shop?.line_token && shop?.features?.admin_notify !== false) {
      const targetAdmin = shop.admin_line_user_id || shop.owner_line_id || shop.features?.admin_line_user_id || shop.features?.admin_notify_user_id
      if (targetAdmin) {
        const orderTotal = totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })
        const adminMsg = `🛒 มีออเดอร์ใหม่เข้ามา!\nเลขที่: ${orderNo}\nลูกค้า: ${args.name || 'ลูกค้า'}\nสินค้า: ${itemsText}\nยอดรวม: ฿${orderTotal} บาท`
        fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${shop.line_token}`,
          },
          body: JSON.stringify({
            to: targetAdmin,
            messages: [{ type: 'text', text: adminMsg }],
          }),
        }).catch((e) => console.warn('[Admin Order Notify Error]:', e))
      }
    }

    const confirmMsg = formatOrderCloseSummary(shop, pricedArgs, orderNo, lang)
    return {
      resultForAi: `สร้างออเดอร์สำเร็จแล้วจริง เลขที่ออเดอร์: ${orderNo} ยอดรวมตามระบบ ${totalAmount.toLocaleString('th-TH')} บาท (สินค้า ${subtotal.toLocaleString('th-TH')} + ค่าส่ง ${shippingFee.toLocaleString('th-TH')})${priceNote} และส่งสรุปออเดอร์พร้อมข้อมูลชำระเงินให้ลูกค้าไปแล้วครบถ้วน ห้ามพิมพ์สรุปหรือเลขบัญชีซ้ำ ให้ตอบสั้นๆ เช่น ขอบคุณ ย้ำเลขที่ออเดอร์ และชวนส่งสลิปกลับมา`,
      immediateMessages: [{ type: 'text', content: confirmMsg }],
    }
  }

  if (toolName === 'request_human_agent') {
    // Paused for an hour like the customer's own "/admin" command. Without paused_until the
    // webhooks measure the pause from the previous message, so a customer who kept writing
    // within the hour kept the bot silent for good (Messenger, 20 Oct 2026).
    await supabase
      .from('conversations')
      .update({ status: 'human', paused_until: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
      .eq('id', conversationId)

    const customerName = String(args.customer_name || '').trim()
    const phone = String(args.phone || '').trim()
    const interest = String(args.interest || '').trim()

    // A customer who left contact details is a lead the admin should call back
    if (phone || interest) {
      await supabaseAdmin.from('leads').upsert({
        shop_id: shopId,
        user_id: userId,
        product_name: interest || null,
        customer_name: customerName || `ลูกค้า-${userId.substring(0, 6)}`,
        source: /^U[0-9a-f]{32}$/.test(userId) ? 'LINE' : 'Messenger',
        status: 'new',
        note: [phone && `ติดต่อ: ${phone}`, args.reason && `เหตุผล: ${args.reason}`].filter(Boolean).join(' | ') || null,
      }, { onConflict: 'shop_id,user_id' })
    }

    // Straight to the admin's LINE, so a hot lead isn't left waiting for someone to open the inbox
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'
    const notifyText = [
      phone || interest ? '🔔 มีลูกค้าสนใจ รอแอดมินติดต่อกลับ' : '🔔 มีลูกค้าขอคุยกับแอดมินคนจริง',
      customerName && `ชื่อ: ${customerName}`,
      phone && `ติดต่อ: ${phone}`,
      interest && `สนใจ: ${interest}`,
      `เหตุผล: ${args.reason || 'ต้องการคุยกับคน'}`,
      `ตอบลูกค้า: ${baseUrl}/dashboard/inbox`,
    ].filter(Boolean).join('\n')
    await notifyShopAdmin(shop, notifyText).catch((e) => console.warn('[Admin Handover Notify Error]:', e))

    return { resultForAi: 'เรียกแอดมินให้เข้ามาดูแลแล้ว ให้บอกลูกค้าว่าส่งเรื่องให้แอดมินแล้ว แอดมินจะติดต่อกลับโดยเร็ว', immediateMessages: [] }
  }

  if (toolName === 'transfer_to_agent') {
    await supabase.from('conversations').update({
      status: 'ai',
      last_message: `[โอนสายไป ${args.target_agent}] ${args.reason}`,
    }).eq('id', conversationId)
    return {
      resultForAi: `ส่งต่อให้แผนก ${args.target_agent} แล้ว ให้แจ้งลูกค้าตามนี้`,
      immediateMessages: [],
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
    // Durable now (queued in follow_up_tasks), so allow up to a day
    const delayMs = Math.min(Math.max(Number(args.delay_minutes) || 60, 5), 24 * 60) * 60 * 1000
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
      return { resultForAi: `ไม่พบสินค้าที่ตรงกับ "${keyword || args.keyword || ''}" ให้แจ้งลูกค้าและชวนลองคำค้นอื่น`, immediateMessages: [] }
    }
    return {
      resultForAi: `สินค้าที่พบ: ${prods.map((p: any) => `${p.name} ราคา ${Number(p.price).toLocaleString()} บาท ${p.stock > 0 ? `เหลือ ${p.stock} ชิ้น` : 'หมดสต๊อก'}`).join('; ')}`,
      immediateMessages: [],
    }
  }

  if (toolName === 'check_stock') {
    const { data: prods } = await supabase
      .from('products')
      .select('name,stock,price,master_sku,source_platform')
      .eq('shop_id', shopId)
      .or(`name.ilike.%${args.product_name}%,master_sku.ilike.%${args.product_name}%`)
      .limit(3)
    if (!prods || prods.length === 0) {
      return { resultForAi: `ไม่พบสินค้า "${args.product_name}" ให้แจ้งลูกค้าตามนี้`, immediateMessages: [] }
    }
    return {
      resultForAi: prods.map((p: any) => `${p.name} (รหัส SKU: ${p.master_sku || 'กลาง'}): ${p.stock > 0 ? `มีสินค้าพร้อมส่งในคลังกลาง ${p.stock} ชิ้น (ซิงค์ข้ามช่องทาง Shopee & TikTok Shop)` : 'สินค้าหมดสต๊อกชั่วคราว'}, ราคา ${Number(p.price).toLocaleString()} บาท`).join('; '),
      immediateMessages: [],
    }
  }

  if (toolName === 'check_order_status') {
    const oid = String(args.order_id || '').trim()
    if (!oid) {
      return { resultForAi: 'ยังไม่มีเลขที่ออเดอร์ ให้ขอจากลูกค้าก่อน', immediateMessages: [] }
    }
    // Scoped to this conversation as well as the shop. Filtering on shop_id
    // alone let anyone who guessed an order number read another customer's
    // name, phone, total and tracking number — the same ownership gap that
    // was open on bookings. get_customer_history below already did this.
    const { data: ord } = await supabase
      .from('orders')
      .select('order_no,status,payment_status,tracking_no,product_name,total_amount')
      .eq('shop_id', shopId)
      .eq('conversation_id', conversationId)
      .or(`order_no.ilike.%${oid}%${UUID_RE.test(oid) ? `,id.eq.${oid}` : ''}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!ord) {
      return { resultForAi: `ไม่พบออเดอร์ ${oid} ในบทสนทนานี้ ให้ขอเลขที่ออเดอร์อีกครั้ง หรือถ้าลูกค้ายืนยันว่าสั่งไว้จริง ให้เรียก request_human_agent ให้แอดมินตรวจสอบ`, immediateMessages: [] }
    }
    const sMap: Record<string, string> = { pending: 'รอดำเนินการ', confirmed: 'ยืนยันแล้ว', processing: 'กำลังดำเนินการ', shipped: 'จัดส่งแล้ว', delivered: 'ส่งถึงแล้ว', cancelled: 'ยกเลิก' }
    const pMap: Record<string, string> = { pending: 'รอชำระ', paid: 'ชำระแล้ว', failed: 'ล้มเหลว' }
    return {
      resultForAi: `ออเดอร์ ${ord.order_no}: สินค้า ${ord.product_name}, ยอด ${Number(ord.total_amount).toLocaleString()} บาท, สถานะ ${sMap[ord.status] ?? ord.status}, ชำระเงิน ${pMap[ord.payment_status] ?? ord.payment_status}${ord.tracking_no ? `, เลขพัสดุ ${ord.tracking_no}` : ''}`,
      immediateMessages: [],
    }
  }

  // ── 📅 BOOKING TOOLS ──────────────────────────────────────────────
  if (toolName === 'check_available_slots') {
    const bookingDate = normalizeBookingDate(args.date)
    const service = await resolveBookingService(supabase, shopId, args)
    const requestedTime = normalizeBookingTime(args.time || args.requested_time)

    const dayKey = parseBookingDateDayKey(bookingDate)
    const serviceDays = (service as any)?.available_days as string[] | null | undefined
    const serviceName = (service as any)?.name || String(args.service || args.service_name || '').trim()
    const serviceId = (service as any)?.id
    const capacityPerSlot = Math.max(Number((service as any)?.capacity_per_slot) || 1, 1)

    if (service && dayKey && serviceDays?.length && !serviceDays.includes(dayKey)) {
      return {
        resultForAi: `${serviceName} ไม่ได้เปิดให้บริการวันที่ ${bookingDate} ให้แจ้งลูกค้าและชวนเลือกวันอื่น`,
        immediateMessages: [],
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
    const notFull = allSlots.filter((slot) => (bookedCounts.get(slot) || 0) < capacityPerSlot)
    const free = dropPastSlots(notFull, bookingDate)

    if (free.length === 0 && notFull.length > 0) {
      // Every remaining slot today has already started — say so plainly
      // instead of falling through to the generic "fully booked" message,
      // which would wrongly imply the shop is out of capacity.
      return {
        resultForAi: `รอบของวันที่ ${bookingDate} ผ่านเวลาไปหมดแล้ว (ตอนนี้ ${bangkokNowTime()} น.) ต้องให้ลูกค้าเลือกวันถัดไป ห้ามเสนอรอบที่ผ่านมาแล้ว`,
        immediateMessages: [],
      }
    }

    if (free.length > 0) {
      const serviceLine = serviceName ? `สำหรับ ${serviceName}${((service as any)?.resource_label || (service as any)?.staff_name) ? ` (${(service as any).resource_label || (service as any).staff_name})` : ''}` : ''
      const cadence = formatSlotCadence(slotInterval)
      const requestedSlotNote = requestedTime && !allSlots.includes(requestedTime)
        ? ` เวลาที่ลูกค้าถาม ${requestedTime} ไม่ใช่รอบเปิดจริง; รอบใกล้ที่สุดคือ ${getNearestSlots(requestedTime, free.length ? free : allSlots).join(', ') || '-'}.`
        : ''
      return {
        resultForAi: `${cadence}. รอบที่เปิดจริงวันที่ ${bookingDate}${serviceLine ? ` ${serviceLine}` : ''}: ${allSlots.join(', ')}. เวลาว่าง: ${free.join(', ')}.${requestedSlotNote} ใช้ได้เฉพาะเวลาที่อยู่ในรายการว่างเท่านั้น`,
        immediateMessages: [],
      }
    }

    return {
      resultForAi: `ไม่มีเวลาว่างวันที่ ${bookingDate} ทุกรอบเต็มหมดแล้ว ให้ชวนลูกค้าเลือกวันอื่น`,
      immediateMessages: [],
    }
  }

  if (toolName === 'book_appointment') {
    const requestedServiceName = args.service || args.service_name
    const bookingDate = normalizeBookingDate(args.date)
    const bookingTime = normalizeBookingTime(args.time)
    const guestCount = Number(args.guest_count || args.party_size || args.people) || null
    const serviceRecord = await resolveBookingService(supabase, shopId, args) as any
    const serviceName = serviceRecord?.name || requestedServiceName
    const serviceDays = serviceRecord?.available_days as string[] | null | undefined
    const dayKey = parseBookingDateDayKey(bookingDate)
    if (serviceRecord && dayKey && serviceDays?.length && !serviceDays.includes(dayKey)) {
      return {
        resultForAi: `${serviceRecord.name || serviceName} ไม่ได้เปิดให้จองวันที่ ${bookingDate} ยังไม่ได้บันทึกการจอง ให้ชวนลูกค้าเลือกวันอื่น`,
        immediateMessages: [],
      }
    }

    // Last line of defence against writing a booking into a time that has
    // already passed — the slot list the AI saw may be minutes stale by the
    // time it gets around to booking, and a past booking silently rots in the
    // shop's calendar with nobody showing up.
    if (bookingDate < formatIsoDate(bangkokToday()) || dropPastSlots([bookingTime], bookingDate).length === 0) {
      return {
        resultForAi: `เวลา ${bookingDate} ${bookingTime} ผ่านไปแล้ว (ตอนนี้ ${bangkokNowTime()} น.) ยังไม่ได้บันทึกการจอง ต้องให้ลูกค้าเลือกวัน/เวลาข้างหน้า`,
        immediateMessages: [],
      }
    }

    if (serviceRecord) {
      const validSlots = buildAvailabilitySlots(serviceRecord.start_time, serviceRecord.end_time, serviceRecord.duration_minutes, serviceRecord.buffer_minutes)
      const slotInterval = getSlotIntervalMinutes(serviceRecord.duration_minutes, serviceRecord.buffer_minutes)
      if (validSlots.length > 0 && !validSlots.includes(bookingTime)) {
        const nearest = getNearestSlots(bookingTime, validSlots)
        const cadence = formatSlotCadence(slotInterval)
        return {
          resultForAi: `${bookingTime} ไม่ใช่รอบจองที่เปิดไว้สำหรับ ${serviceRecord.name || serviceName} ยังไม่ได้บันทึกการจอง. ${cadence}. รอบที่จองได้: ${validSlots.join(', ')}. รอบใกล้เคียง: ${nearest.join(', ')}`,
          immediateMessages: [],
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
        resultForAi: `เวลา ${bookingTime} วันที่ ${bookingDate} เต็มแล้ว ยังไม่ได้บันทึกการจอง ให้ชวนลูกค้าเลือกเวลาอื่น`,
        immediateMessages: [],
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
      deposit_amount: Number(serviceRecord?.deposit_amount) || 0,
      booking_date: bookingDate,
      booking_time: bookingTime,
      status: 'confirmed',
      note: args.note,
      metadata: { raw_args: args, line_user_id: userId, conversation_id: conversationId },
    })

    // Schedule proactive booking reminders (24h and 3h before)
    scheduleBookingReminder({
      shopId,
      conversationId,
      userId,
      bookingId: bookingNo,
      bookingDate,
      bookingTime,
      serviceName: serviceRecord?.name || serviceName,
      customerName,
    }).catch((err) => console.error('[scheduleBookingReminder Error]:', err))

    await updateSalesStage(ctx, 'post_sale')
    const resource = args.resource || args.resource_label || serviceRecord?.resource_label
    return {
      // Everything the confirmation must contain, so the model can write one
      // complete reply instead of the customer receiving the tool's summary
      // and the model's summary back to back.
      resultForAi: `บันทึกการจองสำเร็จแล้วจริง ให้ยืนยันกับลูกค้าโดยใส่ข้อมูลนี้ให้ครบ — ` +
        `เลขที่การจอง: ${bookingNo}, บริการ: ${serviceRecord?.name || serviceName}, ` +
        `วันที่: ${bookingDate}, เวลา: ${bookingTime} น.` +
        `${guestCount ? `, จำนวน: ${guestCount} ท่าน` : ''}` +
        `${resource ? `, พื้นที่/ผู้ให้บริการ: ${resource}` : ''}` +
        `, ชื่อผู้จอง: ${customerName}, เบอร์โทร: ${customerPhone}`,
      immediateMessages: [],
    }
  }

  if (toolName === 'check_booking') {
    const lookup = await findBookingForAction(supabase, shopId, args, userId)
    if (lookup.error) {
      return { resultForAi: `ตรวจสอบการจองไม่สำเร็จ: ${lookup.error} ให้ขอโทษลูกค้าและชวนลองใหม่`, immediateMessages: [] }
    }
    if (lookup.matches.length > 1) {
      const list = lookup.matches.map((bk) => `${bk.booking_no}: ${bk.customer_name || '-'} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`).join('\n')
      return { resultForAi: `พบหลายรายการ ต้องให้ลูกค้าเลือกเลขที่การจอง:\n${list}`, immediateMessages: [] }
    }
    const bk = lookup.booking
    if (!bk) {
      return { resultForAi: 'ไม่พบข้อมูลการจอง ให้ขอเลขที่การจอง หรือชื่อและเบอร์โทรที่ใช้จองจากลูกค้า', immediateMessages: [] }
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

    return { resultForAi: info, immediateMessages: [] }
  }

  if (toolName === 'reschedule_booking') {
    const newDate = normalizeBookingDate(args.new_date || args.date)
    const newTime = normalizeBookingTime(args.new_time || args.time)
    if (!newDate || !newTime) {
      return {
        resultForAi: 'ยังไม่มีวันหรือเวลาใหม่ครบถ้วน จึงยังไม่ได้เลื่อนการจอง ให้ถามวันและเวลาใหม่จากลูกค้า',
        immediateMessages: [],
      }
    }

    if (newDate < formatIsoDate(bangkokToday()) || dropPastSlots([newTime], newDate).length === 0) {
      return {
        resultForAi: `เวลา ${newDate} ${newTime} ผ่านไปแล้ว (ตอนนี้ ${bangkokNowTime()} น.) ยังไม่ได้เลื่อนการจอง ต้องให้ลูกค้าเลือกวัน/เวลาข้างหน้า`,
        immediateMessages: [],
      }
    }

    const lookup = await findBookingForAction(supabase, shopId, args, userId)
    if (lookup.error) {
      return { resultForAi: `ค้นหาการจองไม่สำเร็จ: ${lookup.error} ยังไม่ได้เลื่อนการจอง`, immediateMessages: [] }
    }
    if (lookup.matches.length > 1) {
      const list = lookup.matches.map((bk) => `${bk.booking_no}: ${bk.customer_name || '-'} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`).join('\n')
      return { resultForAi: `พบหลายรายการ ยังไม่ได้เลื่อน ต้องให้ลูกค้าเลือกเลขที่การจองก่อน:\n${list}`, immediateMessages: [] }
    }
    const bk = lookup.booking
    if (!bk) {
      return { resultForAi: 'ไม่พบข้อมูลการจองสำหรับเลื่อน ให้ขอเลขที่การจอง หรือชื่อ เบอร์โทร วันและเวลาเดิมจากลูกค้า', immediateMessages: [] }
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
          resultForAi: `${rescheduleService.name || bk.service_name} ไม่ได้เปิดให้จองวันที่ ${newDate} ยังไม่ได้เลื่อนการจอง ให้ชวนลูกค้าเลือกวันอื่น`,
          immediateMessages: [],
        }
      }

      const validSlots = buildAvailabilitySlots(rescheduleService.start_time, rescheduleService.end_time, rescheduleService.duration_minutes, rescheduleService.buffer_minutes)
      const slotInterval = getSlotIntervalMinutes(rescheduleService.duration_minutes, rescheduleService.buffer_minutes)
      if (validSlots.length > 0 && !validSlots.includes(newTime)) {
        const nearest = getNearestSlots(newTime, validSlots)
        const cadence = formatSlotCadence(slotInterval)
        return {
          resultForAi: `${newTime} ไม่ใช่รอบจองที่เปิดไว้สำหรับ ${rescheduleService.name || bk.service_name} ยังไม่ได้เลื่อนการจอง. ${cadence}. รอบที่จองได้: ${validSlots.join(', ')}. รอบใกล้เคียง: ${nearest.join(', ')}`,
          immediateMessages: [],
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
          resultForAi: `เวลา ${newTime} วันที่ ${newDate} เต็มแล้ว ยังไม่ได้เลื่อนการจอง ให้ชวนลูกค้าเลือกเวลาอื่น`,
          immediateMessages: [],
        }
      }
    }

    await supabase
      .from('bookings')
      .update({ booking_date: newDate, booking_time: newTime, status: 'confirmed' })
      .eq('shop_id', shopId)
      .eq('id', bk.id)

    return {
      resultForAi: `เลื่อนการจองสำเร็จแล้วจริง ให้ยืนยันกับลูกค้าโดยใส่ข้อมูลนี้ให้ครบ — ` +
        `เลขที่การจอง: ${bk.booking_no}, บริการ: ${bk.service_name || '-'}, วันเวลาใหม่: ${newDate} ${newTime} น.`,
      immediateMessages: [],
    }
  }

  if (toolName === 'cancel_booking') {
    const lookup = await findBookingForAction(supabase, shopId, args, userId)
    if (lookup.error) {
      return { resultForAi: `ค้นหาการจองไม่สำเร็จ: ${lookup.error} ยังไม่ได้ยกเลิกอะไร`, immediateMessages: [] }
    }
    if (lookup.matches.length > 1) {
      const list = lookup.matches.map((bk) => `${bk.booking_no}: ${bk.customer_name || '-'} ${bk.service_name || '-'} ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`).join('\n')
      return { resultForAi: `พบหลายรายการ ยังไม่ได้ยกเลิกอะไร ต้องให้ลูกค้าเลือกเลขที่การจองก่อน:\n${list}`, immediateMessages: [] }
    }
    const bk = lookup.booking
    if (!bk) {
      return { resultForAi: 'ไม่พบข้อมูลการจองสำหรับยกเลิก ยังไม่ได้ยกเลิกอะไร ให้ขอเลขที่การจอง หรือชื่อ เบอร์โทร วันและเวลาเดิมจากลูกค้า', immediateMessages: [] }
    }

    await supabase.from('bookings').update({ status: 'cancelled' }).eq('shop_id', shopId).eq('id', bk.id)
    return {
      resultForAi: `ยกเลิกการจองสำเร็จแล้วจริง ให้ยืนยันกับลูกค้าโดยใส่ข้อมูลนี้ให้ครบ — ` +
        `เลขที่การจอง: ${bk.booking_no}, บริการ: ${bk.service_name || '-'}, วันเดิม: ${bk.booking_date} ${String(bk.booking_time || '').slice(0, 5)} น.`,
      immediateMessages: [],
    }
  }
  if (toolName === 'get_customer_history') {
    const { data: ords } = await supabase.from('orders').select('order_no,product_name,total_amount,status,created_at').eq('shop_id', shopId).eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(5)
    if (!ords || ords.length === 0) {
      return { resultForAi: 'ลูกค้ายังไม่มีประวัติการสั่งซื้อ', immediateMessages: [] }
    }
    return {
      resultForAi: `ประวัติการสั่งซื้อ: ${ords.map((o: any) => `${o.order_no} ${o.product_name} ${Number(o.total_amount).toLocaleString()} บาท (${o.status})`).join('; ')}`,
      immediateMessages: [],
    }
  }

  if (toolName === 'check_loyalty_points') {
    const { data: paidOrds } = await supabase.from('orders').select('total_amount').eq('shop_id', shopId).eq('conversation_id', conversationId).eq('payment_status', 'paid')
    const total = paidOrds?.reduce((s: number, o: any) => s + Number(o.total_amount), 0) ?? 0
    const pts = Math.floor(total / 100)
    return {
      resultForAi: `ยอดซื้อสะสม ${total.toLocaleString()} บาท, แต้มสะสม ${pts.toLocaleString()} แต้ม (ทุก 100 บาท = 1 แต้ม)`,
      immediateMessages: [],
    }
  }

  // ── 📚 KNOWLEDGE BASE ─────────────────────────────────────────────
  // Only part of the knowledge base fits in the system prompt; this reaches
  // the rest. Until now the tool was declared to the model but had no
  // implementation, so calling it silently returned "done" and the bot went
  // on to answer from nothing.
  if (toolName === 'search_knowledge_base') {
    const rawQuery = String(args.query || args.keyword || args.question || '').trim()
    if (!rawQuery) {
      return { resultForAi: 'ยังไม่มีคำค้นหา ให้ถามลูกค้าว่าอยากทราบเรื่องอะไร', immediateMessages: [] }
    }

    // Clean Thai stopwords and conversational particles
    const stopWords = [
      'ครับ', 'ค่ะ', 'คะ', 'นะ', 'นะครับ', 'นะคะ', 'ละครับ', 'ละคะ', 'แล้ว', 'ถ้า',
      'คิด', 'เท่าไหร่', 'เท่าไร', 'ขอ', 'สอบถาม', 'หน่อย', 'จ้า', 'ได้ไหม', 'ได้มั้ย',
      'ไหม', 'มั้ย', 'บ้าง', 'ยังไง', 'อย่างไร', 'ทำยังไง', 'ทำอย่างไร', 'หรือเปล่า', 'หรือยัง',
      'อยากทราบ', 'รบกวน', 'วิธี', 'ขั้นตอน'
    ]
    let cleanQuery = rawQuery
    for (const sw of stopWords) {
      cleanQuery = cleanQuery.split(sw).join(' ')
    }
    const searchTokens = cleanQuery
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0)

    // 1. Fetch available active/unspecified status KB items for this shop
    const { data: allItems } = await supabase
      .from('knowledge_base')
      .select('id, title, content')
      .eq('shop_id', shopId)
      .or('status.eq.active,status.is.null')
      .limit(150)

    let matchedItems: { title: string; content: string; score: number }[] = []

    if (allItems && allItems.length > 0) {
      matchedItems = allItems.map((item: any) => {
        let score = 0
        const titleLower = (item.title || '').toLowerCase()
        const contentLower = (item.content || '').toLowerCase()

        // Exact phrase bonus
        if (titleLower.includes(rawQuery.toLowerCase())) score += 50
        if (contentLower.includes(rawQuery.toLowerCase())) score += 20

        // Token match scoring
        for (const token of searchTokens) {
          if (token.length < 2) continue
          if (titleLower.includes(token)) score += 15
          else if (token.length >= 4 && titleLower.split('').some(() => titleLower.includes(token.slice(0, 4)))) score += 5
          if (contentLower.includes(token)) score += 5
        }

        // Deprioritize meta-guidelines (e.g. "วิธีตอบ", "ห้ามพูด / ห้ามสัญญา", "เมื่อไหร่ต้องส่งต่อให้คน")
        // so actual product/pricing/service answers surface first unless asked specifically
        const isMetaGuideline =
          titleLower.includes('วิธีตอบ') ||
          titleLower.includes('ห้ามพูด') ||
          titleLower.includes('ห้ามสัญญา') ||
          titleLower.includes('เมื่อไหร่ต้องส่งต่อ')
        if (isMetaGuideline && !rawQuery.includes('วิธีตอบ') && !rawQuery.includes('ห้ามพูด')) {
          score -= 15
        }

        return { title: item.title, content: item.content, score }
      })
      .filter((item: any) => item.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5)
    }

    if (matchedItems.length === 0) {
      return {
        resultForAi: `ไม่พบข้อมูลเรื่อง "${rawQuery}" ในคลังความรู้ของร้าน ห้ามเดาคำตอบ ให้บอกลูกค้าว่าจะให้แอดมินช่วยตรวจสอบ หรือเรียก request_human_agent`,
        immediateMessages: [],
      }
    }

    return {
      resultForAi: `ข้อมูลจากคลังความรู้:\n` + matchedItems.map((k: any) => `[หัวข้อ: ${k.title}]\n${k.content}`).join('\n\n'),
      immediateMessages: [],
    }
  }

  // ── 📦 PRODUCT TOOLS ─────────────────────────────────────────────
  const GENERIC_PRODUCT_SEARCH_WORDS = ['สินค้า', 'ทั้งหมด', 'รายการ', 'ของ', 'ดู', 'มีอะไรบ้าง', 'ขอชม', 'ขอดู']

  function normalizeProductSearchKeyword(raw: string): string {
    if (!raw) return ''
    return raw
      .replace(/^(ขอดู|ขอชม|ขอรูป|อยากดู|อยากชม|แนะนำ|มี|ขาย|ขอดูรูปภาพ|ขอดูภาพ|ขอ)/gi, '')
      .replace(/(หน่อย|ครับ|ค่ะ|คะ|นะ|บ้าง|ไหม|มั้ย|ด้วย|จ้า|จ้าา)$/gi, '')
      .trim()
  }

  if ((toolName as string) === 'search_products') {
    const rawKeyword = String(args.keyword || args.query || args.search || '').trim()
    const keyword = normalizeProductSearchKeyword(rawKeyword) || rawKeyword

    let query = supabase
      .from('products')
      .select('id, name, price, stock, category, description, image_url')
      .eq('shop_id', shopId)

    // Apply specific keyword filter only if it's not a generic word like 'สินค้า'
    const isGenericKeyword = !keyword || GENERIC_PRODUCT_SEARCH_WORDS.some((w) => rawKeyword.toLowerCase().includes(w))
    if (!isGenericKeyword && keyword) {
      query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,category.ilike.%${keyword}%`)
    }

    let { data: products } = await query.limit(12)

    // Fallback: If filtered search yielded 0 products, fetch all products of the shop
    if (!products || products.length === 0) {
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, price, stock, category, description, image_url')
        .eq('shop_id', shopId)
        .limit(12)
      products = allProducts
    }

    if (!products || products.length === 0) {
      return {
        resultForAi: `ขณะนี้ทางร้านยังไม่ได้ลงรายการสินค้าในระบบ ให้สอบถามลูกค้าเพิ่มเติมหรือแจ้งแอดมิน`,
        immediateMessages: [],
      }
    }

    const list = products.map((p: any) => {
      const stockStr = p.stock !== null && p.stock !== undefined ? `${p.stock} ชิ้น` : 'มีพร้อมส่ง'
      return `- ${p.name} (ราคา ${Number(p.price || 0).toLocaleString()} บาท, คงเหลือ ${stockStr})${p.description ? `: ${p.description}` : ''}`
    }).join('\n')

    return {
      resultForAi: `รายการสินค้าของทางร้าน:\n${list}`,
      immediateMessages: [],
      productsData: products,
    }
  }

  if ((toolName as string) === 'check_stock') {
    const productName = String(args.product_name || args.product || args.name || '').trim()
    if (!productName) {
      return { resultForAi: 'กรุณาระบุชื่อสินค้าที่ต้องการเช็กสต็อก', immediateMessages: [] }
    }

    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, stock')
      .eq('shop_id', shopId)
      .ilike('name', `%${productName}%`)
      .limit(5)

    if (!products || products.length === 0) {
      return {
        resultForAi: `ไม่พบสินค้าชื่อ "${productName}" ในระบบ`,
        immediateMessages: [],
      }
    }

    const info = products.map((p: any) => {
      const stockStr = p.stock !== null && p.stock !== undefined ? `${p.stock} ชิ้น` : 'มีสินค้าพร้อมส่ง'
      return `${p.name}: คงเหลือ ${stockStr} (ราคา ${Number(p.price || 0).toLocaleString()} บาท)`
    }).join('; ')

    return {
      resultForAi: `ข้อมูลสต็อกสินค้า: ${info}`,
      immediateMessages: [],
    }
  }


  if ((toolName as string) === 'calculate_shipping') {
    const addressInput = String(args.province || args.address || '').trim()
    // Same calculation take_order uses, so the quoted fee and the order total agree
    const { fee: rate, zoneName, freeThreshold } = computeShippingFee(shop, addressInput, 0)
    const freeNote = freeThreshold > 0 ? ` (ส่งฟรีเมื่อซื้อครบ ${freeThreshold.toLocaleString()} บาท)` : ''

    return {
      resultForAi: `ผลการคำนวณค่าจัดส่งปลายทาง (${addressInput || 'ไม่ระบุพื้นที่'}): พื้นที่ "${zoneName}" อัตราค่าจัดส่งคือ ${rate} บาท${freeNote}`,
      immediateMessages: [],
    }
  }

  // ── 🎁 PROMOTIONS ─────────────────────────────────────────────────
  if (toolName === 'get_active_promotions') {
    const today = new Date().toISOString().split('T')[0]
    const { data: promos } = await supabase.from('promotions').select('name,description,discount_type,discount_value,end_date,code').eq('shop_id', shopId).eq('status', 'active').or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false }).limit(5)
    if (!promos || promos.length === 0) {
      return { resultForAi: 'ยังไม่มีโปรโมชั่นที่ใช้งานอยู่ ให้แจ้งลูกค้าตามนี้', immediateMessages: [] }
    }
    return {
      resultForAi: `โปรโมชั่นที่ใช้ได้: ${promos.map((p: Record<string, unknown>) => {
        const d = p.discount_type === 'percent' ? `ลด ${p.discount_value}%` : `ลด ${Number(p.discount_value).toLocaleString()} บาท`
        return `${p.name} ${d}${p.end_date ? ` ถึง ${p.end_date}` : ''}${p.code ? ` โค้ด ${p.code}` : ''}`
      }).join('; ')}`,
      immediateMessages: [],
    }
  }

  if (toolName === 'create_quotation') {
    const customerName = String(args.customer_name || args.name || '').trim() || 'ลูกค้าผู้มีอุปการคุณ'
    const customerPhone = String(args.customer_phone || args.phone || '').trim()
    const customerAddress = String(args.customer_address || args.address || '').trim()
    const rawItems = args.items || []

    let itemsList: Array<{ name: string; price: number; qty: number }> = []
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      itemsList = rawItems.map((i: any) => ({
        name: String(i.name || i.product_name || 'สินค้า').trim(),
        price: Number(i.price || 0),
        qty: Number(i.qty || i.quantity || 1),
      }))
    } else if (args.product_name || args.item_name) {
      itemsList = [{
        name: String(args.product_name || args.item_name || 'สินค้า').trim(),
        price: Number(args.price || 0),
        qty: Number(args.qty || args.quantity || 1),
      }]
    }

    if (itemsList.length === 0) {
      return {
        resultForAi: 'กรุณาระบุรายการสินค้าและจำนวน ที่ต้องการให้ออกใบเสนอราคา',
        immediateMessages: [],
      }
    }

    // Each line's price comes from the catalog; a line that doesn't map to exactly
    // one catalog product stops the quotation instead of using the model's price.
    const pricedItems: Array<{ name: string; price: number; qty: number }> = []
    const problems: string[] = []
    for (const item of itemsList) {
      const qty = parseQuantity(item.qty)
      const res = await resolveCatalogProduct(ctx.supabaseAdmin || supabase, shopId, item.name)
      if (res.status !== 'found') {
        problems.push(describeUnresolved(item.name, res))
      } else if (!qty) {
        problems.push(`จำนวนของ "${item.name}" ไม่ถูกต้อง`)
      } else {
        pricedItems.push({ name: res.product.name, price: res.product.price, qty })
      }
    }
    if (problems.length > 0) {
      return {
        resultForAi: `ยังออกใบเสนอราคาไม่ได้: ${problems.join(' / ')} ถ้าเป็นสินค้าหรือบริการที่ไม่มีในระบบ ให้เรียก request_human_agent ให้แอดมินออกใบเสนอราคาเอง`,
        immediateMessages: [],
      }
    }
    itemsList = pricedItems

    const { data: shopData } = await supabase
      .from('shops')
      .select('name, company_name, company_logo_url, vat_enabled')
      .eq('id', shopId)
      .single()

    const vatEnabled = shopData?.vat_enabled || false

    let subtotal = 0
    itemsList.forEach((it) => {
      subtotal += (it.price || 0) * (it.qty || 1)
    })

    // Discounts on quotations are set by the merchant in the dashboard, not by the model
    const discountAmount = 0
    const afterDiscount = Math.max(0, subtotal - discountAmount)
    const vatAmount = vatEnabled ? Math.round(afterDiscount * 0.07 * 100) / 100 : 0
    const totalAmount = afterDiscount + vatAmount

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randNum = Math.floor(1000 + Math.random() * 9000)
    const docNumber = `QT-${dateStr}-${randNum}`

    const admin = ctx.supabaseAdmin || supabase
    const { data: doc, error: docErr } = await admin
      .from('documents')
      .insert({
        shop_id: shopId,
        doc_no: docNumber,
        doc_number: docNumber,
        doc_type: 'quotation',
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        items: itemsList,
        subtotal,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        notes: String(args.notes || '').trim(),
        // Lets accept_quotation check the quotation belongs to the customer accepting it
        customer_info: { conversation_id: conversationId, line_user_id: userId },
      })
      .select('id')
      .single()

    if (docErr || !doc) {
      console.error('[create_quotation Error]:', docErr)
      return {
        resultForAi: 'เกิดข้อผิดพลาด ไม่สามารถออกใบเสนอราคาได้ในขณะนี้',
        immediateMessages: [],
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'
    const docUrl = `${baseUrl.replace(/\/$/, '')}/doc/quotation/${doc.id}`
    const wordUrl = `${baseUrl.replace(/\/$/, '')}/api/doc/${doc.id}/download?format=docx`
    const excelUrl = `${baseUrl.replace(/\/$/, '')}/api/doc/${doc.id}/download?format=xlsx`

    const flexQuotation = buildLineFlexQuotationMessage({
      shopName: shopData?.name || 'ร้านค้า',
      companyName: shopData?.company_name || shopData?.name || 'ร้านค้า',
      logoUrl: shopData?.company_logo_url || undefined,
      docNumber,
      customerName,
      customerPhone,
      customerAddress,
      items: itemsList,
      subtotal,
      discountAmount,
      vatAmount,
      totalAmount,
      docUrl,
      wordUrl,
      excelUrl,
    })

    return {
      resultForAi: `สร้างใบเสนอราคาเรียบร้อยแล้ว (สร้างผ่าน OfficeCLI สำเร็จ) และระบบได้แนบการ์ดใบเสนอราคา (LINE Flex Card) ส่งให้ลูกค้าแล้ว!\n- เลขที่เอกสาร: ${docNumber}\n- ผู้รับ: ${customerName}\n- ยอดรวมสุทธิ: ${totalAmount.toLocaleString()} บาท\n- ลิงก์ดูเอกสาร A4 (PDF): ${docUrl}\n- ลิงก์ดาวน์โหลด Word (.docx): ${wordUrl}\n- ลิงก์ดาวน์โหลด Excel (.xlsx): ${excelUrl}\n\nให้ตอบสรุปยอดสั้นๆ และบอกลูกค้าว่าสามารถแตะปุ่มเพื่อดูใบเสนอราคา หรือดาวน์โหลดไฟล์ Word / Excel ได้จากการ์ดที่ส่งให้ค่ะ`,
      immediateMessages: [
        {
          type: 'flex',
          content: `📄 ใบเสนอราคา ${docNumber} ยอดรวม ฿${totalAmount.toLocaleString()} บาท`,
          flexData: flexQuotation,
          links: [
            { label: 'ดูใบเสนอราคา', url: docUrl },
            { label: 'ดาวน์โหลด Word', url: wordUrl },
            { label: 'ดาวน์โหลด Excel', url: excelUrl },
          ],
        },
      ],
    }
  }

  if ((toolName as string) === 'accept_quotation') {
    // Turns a quotation this customer received into a pending order at the quotation's
    // own (catalog-priced) total, so send_payment_qr can then bill it.
    const admin = ctx.supabaseAdmin || supabase
    const docNo = String(args.quotation_no || args.doc_no || '').trim()
    let docQuery = admin
      .from('documents')
      .select('id, doc_no, doc_number, status, items, total_amount, customer_name, customer_phone, customer_address, customer_info')
      .eq('shop_id', shopId)
      .eq('doc_type', 'quotation')
    docQuery = docNo
      ? docQuery.or(`doc_no.eq.${docNo.replace(/[^A-Za-z0-9-]/g, '')},doc_number.eq.${docNo.replace(/[^A-Za-z0-9-]/g, '')}`)
      : docQuery.eq('customer_info->>conversation_id', conversationId)
    const { data: docs } = await docQuery.order('created_at', { ascending: false }).limit(1)
    const doc = docs?.[0]

    if (!doc) {
      return { resultForAi: 'ไม่พบใบเสนอราคาที่ระบุ ให้ถามเลขที่ใบเสนอราคา (QT-...) จากลูกค้า', immediateMessages: [] }
    }
    if (doc.customer_info?.conversation_id !== conversationId) {
      return {
        resultForAi: 'ใบเสนอราคานี้ไม่ได้ออกให้ลูกค้ารายนี้ผ่านแชทนี้ ยืนยันอัตโนมัติไม่ได้ ให้เรียก request_human_agent ให้แอดมินดำเนินการ',
        immediateMessages: [],
      }
    }
    const quoteNo = doc.doc_no || doc.doc_number
    if (doc.status === 'accepted' || doc.status === 'converted') {
      return { resultForAi: `ใบเสนอราคา ${quoteNo} ถูกยืนยันเป็นออเดอร์ไปแล้ว ถ้าลูกค้าต้องการชำระเงิน ให้เรียก send_payment_qr`, immediateMessages: [] }
    }

    const items: Array<{ name: string; price: number; qty: number }> = Array.isArray(doc.items) ? doc.items : []
    const totalAmount = Number(doc.total_amount) || 0
    if (items.length === 0 || totalAmount <= 0) {
      return { resultForAi: 'ใบเสนอราคานี้ไม่มีรายการหรือยอดเงิน ให้เรียก request_human_agent', immediateMessages: [] }
    }

    const orderNo = `ORD-${Date.now().toString().slice(-6)}`
    const itemsText = items.map((it) => `${it.name} x${it.qty}`).join(', ')
    const { error: orderError } = await supabase.from('orders').insert({
      shop_id: shopId,
      order_no: orderNo,
      conversation_id: conversationId,
      customer_name: doc.customer_name || args.name,
      customer_phone: doc.customer_phone || args.phone,
      address: doc.customer_address || args.address,
      product_name: itemsText.slice(0, 200),
      quantity: String(items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)),
      total_amount: totalAmount,
      items_summary: `จากใบเสนอราคา ${quoteNo}: ${itemsText}`,
      payment_method: args.payment_method || 'promptpay',
      status: 'pending',
    })
    if (orderError) {
      console.error('[accept_quotation Error]:', orderError)
      return { resultForAi: 'สร้างออเดอร์จากใบเสนอราคาไม่สำเร็จ ห้ามบอกลูกค้าว่าสำเร็จ ให้เรียก request_human_agent', immediateMessages: [] }
    }

    await admin
      .from('documents')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: 'line_customer' })
      .eq('id', doc.id)

    if (shop?.line_token && shop?.features?.admin_notify !== false) {
      const targetAdmin = shop.admin_line_user_id || shop.owner_line_id || shop.features?.admin_line_user_id || shop.features?.admin_notify_user_id
      if (targetAdmin) {
        fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${shop.line_token}` },
          body: JSON.stringify({
            to: targetAdmin,
            messages: [{ type: 'text', text: `📄 ลูกค้ายืนยันใบเสนอราคา ${quoteNo}\nสร้างออเดอร์: ${orderNo}\nยอด: ฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` }],
          }),
        }).catch((e) => console.warn('[Admin Quotation Notify Error]:', e))
      }
    }

    await updateSalesStage(ctx, 'post_sale')
    return {
      resultForAi: `ยืนยันใบเสนอราคา ${quoteNo} และสร้างออเดอร์ ${orderNo} ยอด ${totalAmount.toLocaleString('th-TH')} บาท สำเร็จแล้ว ให้เรียก send_payment_qr ต่อทันทีเพื่อส่ง QR ชำระเงิน`,
      immediateMessages: [],
    }
  }

  if (toolName === 'apply_custom_discount') {
    // Capped by the shop's own setting (features.max_discount_percent, default 0 = off),
    // applied once to this customer's pending order so the QR bills the reduced total.
    const maxPercent = Math.min(Math.max(Number(shop?.features?.max_discount_percent) || 0, 0), 50)
    if (maxPercent <= 0) {
      return { resultForAi: 'ร้านไม่ได้เปิดให้บอทลดราคาเอง ห้ามสัญญาส่วนลด ให้แจ้งลูกค้าว่าจะส่งเรื่องให้แอดมินพิจารณา และเรียก request_human_agent ถ้าลูกค้าต้องการ', immediateMessages: [] }
    }
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_no, total_amount, note')
      .eq('shop_id', shopId)
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
    const order = orders?.[0]
    if (!order) {
      return { resultForAi: 'ยังไม่มีออเดอร์ที่รอชำระ ให้เรียก take_order ก่อน แล้วค่อยพิจารณาส่วนลด', immediateMessages: [] }
    }
    if (String(order.note || '').includes('[bot-discount:')) {
      return { resultForAi: `ออเดอร์ ${order.order_no} ได้รับส่วนลดไปแล้ว ลดเพิ่มไม่ได้`, immediateMessages: [] }
    }

    const total = Number(order.total_amount) || 0
    const cap = Math.floor((total * maxPercent) / 100)
    const requested = Math.max(0, Math.floor(Number(args.discount_amount) || 0))
    const discount = Math.min(requested, cap)
    if (discount <= 0) {
      return { resultForAi: `ส่วนลดที่ให้ได้สูงสุดคือ ${cap} บาท (${maxPercent}% ของยอด) ไม่ได้ปรับยอด`, immediateMessages: [] }
    }
    const newTotal = total - discount
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        total_amount: newTotal,
        note: `${order.note ? `${order.note}\n` : ''}[bot-discount:${discount}] ${String(args.reason || '').slice(0, 120)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'pending')
    if (updateError) {
      console.error('[apply_custom_discount Error]:', updateError)
      return { resultForAi: 'ปรับส่วนลดไม่สำเร็จ ห้ามบอกลูกค้าว่าได้ส่วนลด', immediateMessages: [] }
    }
    return {
      resultForAi: `ให้ส่วนลด ${discount} บาทกับออเดอร์ ${order.order_no} แล้ว ยอดใหม่ ${newTotal.toLocaleString('th-TH')} บาท${requested > discount ? ` (ขอ ${requested} บาท แต่ร้านให้ได้สูงสุด ${cap} บาท)` : ''} ถ้าส่ง QR ไปแล้วให้เรียก send_payment_qr ใหม่เพื่อส่ง QR ยอดใหม่`,
      immediateMessages: [],
    }
  }

  if (toolName === 'create_official_letter') {
    const subject = String(args.subject || '').trim() || 'หนังสือราชการ'
    const recipient = String(args.recipient || '').trim() || 'ผู้รับหนังสือ'
    const department = String(args.department || '').trim()
    const bodyFacts = String(args.body_facts || '').trim()
    const bodyPurpose = String(args.body_purpose || args.body_considerations || '').trim()
    const bodyConclusion = String(args.body_conclusion || args.body_resolution || '').trim()
    const signatoryName = String(args.signatory_name || '').trim()
    const signatoryPosition = String(args.signatory_position || '').trim()
    const referenceTo = String(args.reference_to || '').trim()
    const enclosures = String(args.enclosures || '').trim()

    const { data: shopData } = await supabase
      .from('shops')
      .select('name, company_name, company_phone, company_email')
      .eq('id', shopId)
      .single()

    const resolvedDept = department || shopData?.company_name || shopData?.name || 'หน่วยงาน'
    const dateStr = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const dateNum = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randNum = Math.floor(1000 + Math.random() * 9000)
    const docNumber = `กท ${randNum}/${dateNum.slice(2, 6)}`

    const letterData = {
      doc_number: docNumber,
      department: resolvedDept,
      date_str: dateStr,
      subject,
      recipient,
      reference_to: referenceTo,
      enclosures,
      body_facts: bodyFacts,
      body_considerations: bodyPurpose,
      body_resolution: bodyConclusion,
      signatory_name: signatoryName,
      signatory_position: signatoryPosition,
      contact_info: `${shopData?.company_phone || ''} ${shopData?.company_email || ''}`.trim(),
    }

    const admin = ctx.supabaseAdmin || supabase
    const { data: doc, error: docErr } = await admin
      .from('documents')
      .insert({
        shop_id: shopId,
        doc_no: docNumber,
        doc_number: docNumber,
        doc_type: 'official_letter',
        customer_name: recipient,
        items: [{ name: subject, qty: 1, price: 0 }],
        notes: JSON.stringify(letterData),
      })
      .select('id')
      .single()

    if (docErr || !doc) {
      console.error('[create_official_letter Error]:', docErr)
      return {
        resultForAi: 'เกิดข้อผิดพลาด ไม่สามารถออกหนังสือราชการได้ในขณะนี้',
        immediateMessages: [],
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'
    const docUrl = `${baseUrl.replace(/\/$/, '')}/doc/official/${doc.id}`
    const wordUrl = `${baseUrl.replace(/\/$/, '')}/api/doc/${doc.id}/download?format=docx`

    const flexLetter = buildLineFlexOfficialLetterMessage({
      shopName: shopData?.name || 'หน่วยงาน',
      companyName: resolvedDept,
      docNumber,
      subject,
      recipient,
      department: resolvedDept,
      dateStr,
      docUrl,
      wordUrl,
    })

    return {
      resultForAi: `ร่างหนังสือราชการภายนอกเรียบร้อยแล้ว (จัดรูปแบบตามระเบียบงานสารบรรณด้วย OfficeCLI สำเร็จ) และระบบได้ส่งการ์ดหนังสือราชการให้ลูกค้าแล้ว!\n- เลขที่หนังสือ: ${docNumber}\n- เรื่อง: ${subject}\n- เรียน: ${recipient}\n- ลิงก์เปิดดูเอกสาร A4 (PDF): ${docUrl}\n- ลิงก์ดาวน์โหลด Word (.docx): ${wordUrl}\n\nให้ตอบสรุปสั้นๆ และแจ้งลูกค้าว่าสามารถแตะดูหน้าเอกสาร A4 หรือดาวน์โหลดไฟล์ Word (.docx) เพื่อนำไปแก้ไขต่อได้เลยค่ะ`,
      immediateMessages: [
        {
          type: 'flex',
          content: `📜 หนังสือราชการ: ${subject} (${docNumber})`,
          flexData: flexLetter,
          links: [
            { label: 'ดูเอกสาร', url: docUrl },
            { label: 'ดาวน์โหลด Word', url: wordUrl },
          ],
        },
      ],
    }
  }

  if (toolName === 'update_customer_preference') {
    const key = String(args.key || '').trim()
    const value = String(args.value || '').trim()
    if (!key || !value) return { resultForAi: 'กรุณาระบุ key และ value ของความชอบลูกค้า', immediateMessages: [] }
    const { updateCustomerPreference } = await import('@/lib/customerMemory')
    await updateCustomerPreference(ctx.shopId, ctx.userId, key, value)
    return { resultForAi: `บันทึกความชอบของลูกค้าเรียบร้อยแล้ว (${key}: ${value})`, immediateMessages: [] }
  }

  // Trigger stage transitions based on tool calls
  if (['search_products', 'check_stock', 'get_active_promotions'].includes(toolName)) {
    updateSalesStage(ctx, 'showcase').catch(() => {})
  } else if (['take_order', 'send_payment_qr', 'book_appointment'].includes(toolName)) {
    updateSalesStage(ctx, 'closing').catch(() => {})
  }

  // Every tool offered to the model has a handler above; anything else (an old or
  // hallucinated tool name) is a no-op and the model answers from context.
  return NO_OP
}

export type SalesStage = 'greeting' | 'showcase' | 'closing' | 'post_sale'

export async function updateSalesStage(ctx: ToolExecutionContext, newStage: SalesStage): Promise<void> {
  if (!ctx.conversationId) return
  try {
    const { data: conv } = await ctx.supabase
      .from('conversations')
      .select('sales_stage')
      .eq('id', ctx.conversationId)
      .maybeSingle()

    const currentStage: SalesStage = (conv?.sales_stage as SalesStage) || 'greeting'
    const STAGE_ORDER: Record<SalesStage, number> = { greeting: 0, showcase: 1, closing: 2, post_sale: 3 }

    if (STAGE_ORDER[newStage] > STAGE_ORDER[currentStage]) {
      await ctx.supabase
        .from('conversations')
        .update({ sales_stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', ctx.conversationId)
    }
  } catch (err) {
    console.error('[Sales Stage Update Error]:', err)
  }
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
