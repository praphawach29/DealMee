/**
 * A shop's business hours (features.business_hours). With bot_mode 'outside_hours'
 * the bot stays quiet while the shop is open and admins answer from the Inbox; with
 * 'always' it answers around the clock and only tells customers when people are in.
 * Times are Thailand time (UTC+7, no daylight saving).
 */
export type BotMode = 'outside_hours' | 'always'

export interface BusinessHours {
  enabled: boolean
  /** 0 = Sunday … 6 = Saturday */
  days: number[]
  /** 'HH:MM'; close earlier than open means the shop closes after midnight */
  open: string
  close: string
  bot_mode: BotMode
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  open: '09:00',
  close: '18:00',
  bot_mode: 'outside_hours',
}

export const THAI_DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Validated hours from features, falling back to the defaults for anything missing or malformed */
export function readBusinessHours(features: Record<string, any> | null | undefined): BusinessHours {
  const raw = (features?.business_hours || {}) as Partial<BusinessHours>
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : DEFAULT_BUSINESS_HOURS.days
  return {
    enabled: raw.enabled === true,
    days,
    open: typeof raw.open === 'string' && TIME_RE.test(raw.open) ? raw.open : DEFAULT_BUSINESS_HOURS.open,
    close: typeof raw.close === 'string' && TIME_RE.test(raw.close) ? raw.close : DEFAULT_BUSINESS_HOURS.close,
    bot_mode: raw.bot_mode === 'always' ? 'always' : 'outside_hours',
  }
}

export function isValidTime(time: unknown): time is string {
  return typeof time === 'string' && TIME_RE.test(time)
}

/** Day of week and minutes since midnight in Thailand */
function thaiClock(now: Date) {
  const t = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return { day: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() }
}

export function isShopOpen(hours: BusinessHours, now = new Date()): boolean {
  if (hours.days.length === 0) return false
  const { day, minutes } = thaiClock(now)
  const open = toMinutes(hours.open)
  const close = toMinutes(hours.close)
  if (open === close) return hours.days.includes(day) // open all day
  if (open < close) return hours.days.includes(day) && minutes >= open && minutes < close
  // Past midnight: the early hours belong to the previous day's opening
  return (hours.days.includes(day) && minutes >= open) || (hours.days.includes((day + 6) % 7) && minutes < close)
}

/** False only while the shop is open and has chosen to answer customers itself */
export function botMayReplyNow(features: Record<string, any> | null | undefined, now = new Date()): boolean {
  const hours = readBusinessHours(features)
  if (!hours.enabled || hours.bot_mode !== 'outside_hours') return true
  return !isShopOpen(hours, now)
}

/** e.g. "จ.–ศ. 09:00–18:00" or "จ., พ., ศ. 10:00–02:00" */
export function describeBusinessHours(hours: BusinessHours): string {
  const d = hours.days
  const consecutive = d.length > 2 && d.every((v, i) => i === 0 || v === d[i - 1] + 1)
  const days =
    d.length === 7 ? 'ทุกวัน' : consecutive ? `${THAI_DAY_SHORT[d[0]]}–${THAI_DAY_SHORT[d[d.length - 1]]}` : d.map((x) => THAI_DAY_SHORT[x]).join(', ')
  const time = hours.open === hours.close ? 'ตลอดวัน' : `${hours.open}–${hours.close} น.`
  return `${days} ${time}`
}

/** When the shop next opens, as text for the bot to tell a customer */
function nextOpeningText(hours: BusinessHours, now: Date): string {
  const { day, minutes } = thaiClock(now)
  const open = toMinutes(hours.open)
  for (let ahead = 0; ahead <= 7; ahead++) {
    const d = (day + ahead) % 7
    if (!hours.days.includes(d)) continue
    if (ahead === 0 && minutes >= open) continue
    const when = ahead === 0 ? 'วันนี้' : ahead === 1 ? 'พรุ่งนี้' : `วัน${['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][d]}`
    return `${when} ${hours.open} น.`
  }
  return 'เวลาทำการถัดไป'
}

/** Line for the bot's prompt: the hours and whether people are in right now (empty when not set) */
export function businessHoursPromptContext(features: Record<string, any> | null | undefined, now = new Date()): string {
  const hours = readBusinessHours(features)
  if (!hours.enabled || hours.days.length === 0) return ''
  const open = isShopOpen(hours, now)
  return (
    `\n\n[เวลาทำการของร้าน]\n${describeBusinessHours(hours)} (เวลาประเทศไทย)\n` +
    (open
      ? 'ตอนนี้อยู่ในเวลาทำการ แอดมินพร้อมตอบ'
      : `ตอนนี้นอกเวลาทำการ ถ้าลูกค้าขอคุยกับแอดมินหรือต้องให้คนช่วย ให้แจ้งว่าแอดมินจะตอบกลับ${nextOpeningText(hours, now)} และช่วยเท่าที่ทำได้ก่อน`)
  )
}
