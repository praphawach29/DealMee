/**
 * Keyword matching for Thai chat text. Thai has no spaces between words, so a plain
 * `includes`/regex test also matches a keyword sitting inside a longer word, and it can't
 * tell "เอาเลย" from "ยังไม่เอาเลย". These helpers cover the cases that misfired:
 *
 * - "เหมา" (bulk buy) inside "เหมาะ" (suitable): every "เหมาะกับ..." question was scored as haggling
 * - "ยังไม่เอาเลยค่ะ" (a refusal) moved the chat to the closing stage
 * - "ขอคุยกับแอดมินค่ะ" didn't pause the bot: only the bare phrase, with no polite particle, did
 *
 * Dependency-free so tests/ can import it directly.
 */

/**
 * Vowel signs, tone marks and other marks that attach to the consonant before them. When one
 * follows a keyword's last letter, that letter belongs to a longer word ("เหมา|ะ", "มีอย|ู่").
 */
const CONTINUES_WORD = /^[ะ-ฺ็-๎]/

/** True when `keyword` appears in `text` as itself, not as the start of a longer Thai word. */
export function containsThaiKeyword(text: string, keyword: string): boolean {
  for (let at = text.indexOf(keyword); at !== -1; at = text.indexOf(keyword, at + 1)) {
    if (!CONTINUES_WORD.test(text.slice(at + keyword.length))) return true
  }
  return false
}

/** Words that, right before a phrase, turn it into its opposite ("ไม่เอาเลย", "ไม่ต้องโอน") */
const NEGATED_BEFORE = /(ไม่|ไม่ได้|ไม่ต้อง)\s*$/

/** True when `pattern` matches somewhere in `text` without a negation directly in front of it. */
export function hasUnnegatedMatch(text: string, pattern: RegExp): boolean {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  for (const match of text.matchAll(global)) {
    if (!NEGATED_BEFORE.test(text.slice(0, match.index))) return true
  }
  return false
}

const PAUSE_COMMANDS = new Set(['/pause', '/stop', '/admin', '/human'])
const HANDOFF_PHRASES = new Set(['ขอคุยกับแอดมิน', 'ขอคุยกับเจ้าหน้าที่', 'ติดต่อเจ้าหน้าที่'])
/** Polite endings and filler customers add to the end of a request */
const TRAILING = /(?:\s|[!?.~,。…]|ค่ะ|คะ|ครับ|คับ|ฮะ|จ้า|จ้ะ|นะ|หน่อย|ด้วย|\p{Extended_Pictographic}|️)+$/u

/**
 * The customer asked for a person: a pause command, or one of the hand-off phrases with any
 * polite ending ("ขอคุยกับแอดมินค่ะ", "ขอคุยกับเจ้าหน้าที่หน่อยครับ 🙏").
 */
export function isHandoffRequest(text: string): boolean {
  const clean = text.trim()
  if (PAUSE_COMMANDS.has(clean.toLowerCase())) return true
  return HANDOFF_PHRASES.has(clean.replace(TRAILING, ''))
}
