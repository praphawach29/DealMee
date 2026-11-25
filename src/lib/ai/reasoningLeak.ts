/**
 * Catches the model's own working notes before they reach a customer.
 *
 * Seen live (25 Nov 2026, CheckMee on LINE): instead of only the reply, the
 * model sent its plan ("ลูกค้าบอก ... ต้องให้ ..."), a draft ("เขียนตอบ: ..."),
 * a rule checklist ("ตรวจกฎ: - ไม่มี markdown - stage tag ...") and only then
 * the reply itself, all in one plain text part. Reasoning models behind the
 * OpenAI-compatible BYOK providers do the same inside <think> tags.
 *
 * Dependency-free so tests/ can import it directly.
 */

/** Phrases that only appear when the model talks about its instructions, not to the customer. */
const META_SIGNALS: RegExp[] = [
  /ลูกค้า(?:บอก|พิมพ์|ถาม)ว่า?\s*["“'‘]/,
  /ตรวจ(?:สอบ)?กฎ|เช็[คก]กฎ/,
  /(?:เขียน|ร่าง)(?:คำ)?ตอบ\s*[:：]/,
  /ไม่มี\s*markdown|ห้าม\s*markdown|ห้ามตัวหนา|ห้ามดอกจัน|\bplain ?text\b/i,
  /\bstage tag\b|ป้าย\s*stage/i,
  /\bbridge question\b|\balternative close\b/i,
  /อ้างอิงข้อมูล\s*[:：]/,
  /คำสั่งบอท|system prompt|ในพรอมต์|ตามพรอมต์/i,
  /ไม่เกิน\s*\d+(?:\s*-\s*\d+)?\s*บรรทัด/,
  /ใส่\s*cite\b/i,
  /^\s*(?:draft|final reply|checklist|rules? check)\s*[:：]/im,
]

const THINK_BLOCK = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi
const THINK_CLOSE = /<\/(?:think|thinking|reasoning)>/i

const DRAFT_MARKER = /(?:เขียน(?:คำ)?ตอบ|ร่าง(?:คำ)?ตอบ|คำตอบสุดท้าย|ตอบลูกค้า|draft|final reply)\s*[:：]/gi
const CHECK_MARKER = /ตรวจ(?:สอบ)?กฎ|เช็[คก]กฎ|\bchecklist\b|\brules? check\b/i

function metaSignalCount(text: string): number {
  return META_SIGNALS.filter((re) => re.test(text)).length
}

/** Removes <think>-style blocks reasoning models put before the answer. */
export function stripThinkBlocks(text: string): string {
  let out = text.replace(THINK_BLOCK, '')
  // An opening tag the provider dropped: everything up to the close is reasoning.
  const close = THINK_CLOSE.exec(out)
  if (close) out = out.slice(close.index + close[0].length)
  return out.replace(/<(?:think|thinking|reasoning)>[\s\S]*$/i, '').trim()
}

/** True when the reply reads like the model's notes about its instructions rather than a message to the customer. */
export function looksLikeReasoningLeak(text: string): boolean {
  return metaSignalCount(text) >= 2
}

/**
 * Pulls the customer-facing reply out of a leaked one, or returns null when it
 * can't be told apart safely. The last draft is taken; when the model rewrote
 * it after its checklist (same opening words), that rewrite is preferred.
 */
export function recoverReplyFromLeak(text: string): string | null {
  const markers = [...text.matchAll(DRAFT_MARKER)]
  if (markers.length === 0) return null
  const last = markers[markers.length - 1]
  const afterDraft = text.slice(last.index! + last[0].length)

  const check = CHECK_MARKER.exec(afterDraft)
  const draft = (check ? afterDraft.slice(0, check.index) : afterDraft).trim()
  const rest = check ? afterDraft.slice(check.index) : ''

  const candidates: string[] = []
  const opener = draft.slice(0, 8)
  if (rest && opener.length >= 4) {
    const at = rest.lastIndexOf(opener)
    if (at >= 0) candidates.push(rest.slice(at).trim())
  }
  candidates.push(draft)

  for (const candidate of candidates) {
    if (candidate.length >= 10 && metaSignalCount(candidate) === 0) return candidate
  }
  return null
}
