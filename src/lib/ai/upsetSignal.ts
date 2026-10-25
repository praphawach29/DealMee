/**
 * "Is this customer upset?", asked of TypeSafe (a model that answers typed yes/no questions with a
 * probability) for every customer message, so the shop admin hears about an unhappy customer
 * while it still matters. It only alerts; the bot keeps answering.
 *
 * The wording was tested on 64 Thai messages before it shipped (typesafe-eval, 25 Oct 2026):
 * 9/9 upset customers caught, no false alarms, including on 24 messages the wording was never
 * tuned on. Earlier wording read "แพงจังเลย" (a price remark) as upset; the false criterion
 * now names that case. Change the wording only with a re-run of that comparison.
 *
 * Dependency-free so tests/ can import it directly; upsetAlert.ts does the network and database.
 */

export const UPSET_THRESHOLD = 0.7
/** At most one alert per conversation in this window, so an angry thread doesn't flood the admin */
export const UPSET_ALERT_COOLDOWN_MS = 60 * 60 * 1000

export const UPSET_QUESTION = {
  type: 'noul',
  instructions: 'Is the customer in `message` upset with the shop or its service?',
  criteria: {
    true:
      'The customer complains about a problem (late, wrong or faulty order, slow or unhelpful replies), ' +
      'repeats themselves impatiently, or shows anger or disappointment.',
    false:
      'The customer sounds calm, neutral or happy, including when they remark that an item is ' +
      'expensive while still considering it.',
  },
} as const

/** The request body for TypeSafe's System One endpoint */
export function upsetRequestBody(message: string, shopName?: string | null) {
  return {
    model: 'jev-latest',
    state: {
      shop: `${shopName ? `"${shopName}", a` : 'A'} Thai shop that sells through chat. Customers write in Thai.`,
      message,
    },
    questions: { upset: UPSET_QUESTION },
  }
}

/** The probability TypeSafe gave, or null when the response doesn't hold a usable answer */
export function upsetProbability(response: unknown): number | null {
  const answer = (response as { answers?: Record<string, { type?: string; noul?: unknown }> })?.answers?.upset
  const p = answer?.type === 'noul' ? answer.noul : undefined
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1 ? p : null
}

/** Worth asking about: real text from the customer, not a command, a sticker code or a lone emoji */
export function worthChecking(text: string): boolean {
  const t = text.trim()
  if (t.length < 3 || t.startsWith('/')) return false
  return /[\p{L}]/u.test(t)
}

/** Whether a new alert may go out, given when the last one for this conversation went */
export function cooldownOver(lastAlertAt: unknown, now: number = Date.now()): boolean {
  const last = typeof lastAlertAt === 'string' ? Date.parse(lastAlertAt) : NaN
  return !Number.isFinite(last) || now - last >= UPSET_ALERT_COOLDOWN_MS
}

/** The LINE message the shop admin gets */
export function upsetAlertText(message: string, customerName: string | null | undefined, inboxUrl: string): string {
  const quoted = message.length > 200 ? `${message.slice(0, 200)}…` : message
  return [
    '🔔 ลูกค้าดูไม่พอใจ',
    customerName ? `ลูกค้า: ${customerName}` : null,
    `ข้อความ: "${quoted}"`,
    'บอทยังตอบต่อตามปกติ ถ้าจะคุยเอง กด "แอดมิน" ในกล่องข้อความ',
    `ตอบลูกค้า: ${inboxUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
}
