/**
 * Pure helpers that guard FAQ auto-synthesis (src/lib/ai/faqSynthesis.ts).
 * No I/O here so each rule can be unit-tested on its own.
 */

export interface RawChatMessage {
  sender_type: string | null
  message: string | null
}

export interface SynthesisTurn {
  role: 'customer' | 'admin'
  text: string
}

/**
 * Keep only the speakers whose words may become knowledge:
 *  - 'user'            → customer (the question)
 *  - 'agent' / 'human' → a real admin (the answer)
 * Everything else — 'bot', 'system', unknown — is dropped, so the bot's own (possibly
 * wrong) replies can never be learned back as FAQ.
 */
export function selectSynthesisTurns(messages: RawChatMessage[]): SynthesisTurn[] {
  const turns: SynthesisTurn[] = []
  for (const m of messages) {
    const text = (m.message ?? '').trim()
    if (!text) continue
    if (m.sender_type === 'user') turns.push({ role: 'customer', text })
    else if (m.sender_type === 'agent' || m.sender_type === 'human') turns.push({ role: 'admin', text })
  }
  return turns
}

// ───────────────────────── personal data ─────────────────────────

export const PII_PLACEHOLDER = '[ข้อมูลส่วนบุคคล]'

/**
 * Patterns for data that must never reach the AI or the knowledge base.
 * Order matters: more specific shapes first. Names cannot be found by regex — that
 * part stays with the prompt rule, the output check below and the owner's approval.
 */
const PII_PATTERNS: RegExp[] = [
  // e-mail
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g,
  // Thai street address: "99/1 ซ.สุขุมวิท ..." / "12 หมู่ 3 ต.บางนา ..." — to end of line
  /(?:บ้านเลขที่\s*)?\d{1,4}(?:\/\d{1,4})?\s*(?:หมู่\s*\d+\s*)?(?:ซ\.|ซอย|ถ\.|ถนน|ม\.|หมู่|แขวง|ต\.|ตำบล)[^\n]*/g,
  // alphanumeric reference with both letters and digits, 15+ chars (slip transRef, tokens)
  /(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{15,}/g,
  // card number 4-4-4-4
  /\d{4}(?:[\s-]\d{4}){3}/g,
  // Thai phone, with or without separators: 081-234-5678, 08 1234 5678, +66 81 234 5678
  /(?:\+66[\s.-]?\d|(?<!\d)0\d)(?:[\s.-]?\d){7,8}(?!\d)/g,
  // any other long digit run (bank account, national ID, slip / transfer number): 9+ digits, '-' or '.' allowed between
  /\d(?:[-.]?\d){8,}/g,
]

export function redactPii(text: string): { text: string; redacted: boolean } {
  let out = text
  let redacted = false
  for (const re of PII_PATTERNS) {
    out = out.replace(re, () => {
      redacted = true
      return PII_PLACEHOLDER
    })
  }
  return { text: out, redacted }
}

/** true when the text still carries personal data (or a redaction placeholder the model copied) */
export function containsPii(text: string): boolean {
  return text.includes(PII_PLACEHOLDER) || redactPii(text).redacted
}

// ───────────────────────── prompt-injection hardening ─────────────────────────

export const MAX_TURN_CHARS = 500
export const MAX_DRAFTS_PER_RUN = 3
export const MAX_TITLE_CHARS = 150
export const MAX_CONTENT_CHARS = 1000
/** share of a draft's character 3-grams that must also appear in the admin's own words */
export const GROUNDING_MIN_OVERLAP = 0.4

const CATEGORIES = ['faq', 'policy', 'product'] as const
export type FaqCategory = (typeof CATEGORIES)[number]

/** strip control characters and cap the length of one chat message */
export function clipTurn(text: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
  return clean.length > MAX_TURN_CHARS ? `${clean.slice(0, MAX_TURN_CHARS)}…` : clean
}

/**
 * The conversation as a JSON array. JSON.stringify escapes quotes and newlines, so a
 * customer message cannot fake a new speaker line or close a quoted block — it stays
 * one string value, tagged with the role WE assigned from sender_type.
 */
export function serializeTranscript(turns: SynthesisTurn[]): string {
  return JSON.stringify(turns.map((t) => ({ role: t.role, text: clipTurn(t.text) })))
}

export function normalizeCategory(value: unknown): FaqCategory {
  return CATEGORIES.includes(value as FaqCategory) ? (value as FaqCategory) : 'faq'
}

const squash = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

function trigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3))
  return out
}

function numbersIn(s: string): string[] {
  return (s.replace(/(?<=\d),(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(/^0+(?=\d)/, ''))
}

/**
 * A draft may only restate what an admin actually wrote. Code-level check, so it holds
 * even if the model was talked into inventing something: every number in the draft must
 * appear in the admin's messages, and the wording must overlap them enough.
 */
export function isGroundedInAdminText(content: string, adminTexts: string[]): boolean {
  const admin = adminTexts.join('\n')
  const adminNums = new Set(numbersIn(admin))
  if (!numbersIn(content).every((n) => adminNums.has(n))) return false
  const mine = trigrams(squash(content))
  if (mine.size === 0) return false
  const theirs = trigrams(squash(admin))
  let hit = 0
  for (const g of mine) if (theirs.has(g)) hit++
  return hit / mine.size >= GROUNDING_MIN_OVERLAP
}
