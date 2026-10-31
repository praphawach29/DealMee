/**
 * Checks a drafted customer reply before it is sent.
 *
 * Shop facts (price, stock, policy, shipping, specs, promotions, hours,
 * payment details) must be supported by retrieved chunks, the catalog, or a
 * tool result from this turn. Small talk is returned unchanged. The check is
 * local string matching: no extra model call.
 *
 * The model may end a factual reply with an internal citation line
 * `[[cite:chunk:<uuid>,tool:<name>]]`. That line is removed before the
 * customer sees the text.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CITE_RE = /\[\[cite:([^\]]*)\]\]/gi
const CHUNK_BLOCK_RE = /\[chunk_id:\s*([0-9a-f-]{36})\s*\|[^\]]*\]\n?([\s\S]*?)(?=\n\[chunk_id:|$)/gi

const FACT_CUE = /ราคา|บาท|฿|baht|\bprice\b|สต็อก|สต๊อก|คงเหลือ|เหลือ\s*\d|ของหมด|สินค้าหมด|พร้อมส่ง|in stock|out of stock|จัดส่ง|ค่าส่ง|ส่งฟรี|ค่าจัดส่ง|shipping|delivery|นโยบาย|รับประกัน|คืนสินค้า|เปลี่ยนสินค้า|warranty|refund|เปิดทำการ|เวลาทำการ|เปิดทุก|ปิดทุก|เวลาเปิด|business hours|\d{1,2}[:.]\d{2}|พร้อมเพย์|promptpay|เลขบัญชี|ธนาคาร|เก็บเงินปลายทาง|เก็บปลายทาง|\bcod\b|โปรโมชั่น|ส่วนลด|แถม|discount|ของแท้|ไซส์|สเปก|รหัสสินค้า|\bsku\b|จองเรียบร้อย|รับออเดอร์แล้ว|เลขที่ออเดอร์|เลขที่จอง/i

const OPEN_QUESTION = /[?？]\s*$|(ไหม|มั้ย|หรือยัง|เท่าไหร่|กี่โมง|ดีคะ|ดีครับ)\s*$/
const CONCRETE = /ส่งฟรี|จัดส่งฟรี|ฟรีค่าส่ง|รับประกัน|เก็บเงินปลายทาง|เก็บปลายทาง|ของแท้|ของหมด|สินค้าหมด|เปิดทุก|พร้อมเพย์|promptpay|\d[\d,.]*\s*(?:บาท|฿|%|ปี|เดือน|วัน|ชั่วโมง|ชม|ชิ้น)|\d{1,2}[:.]\d{2}|จองเรียบร้อย|รับออเดอร์แล้ว|เลขที่ออเดอร์|เลขที่จอง/i

const UNKNOWN_REPLY = /ไม่ทราบ|ไม่มีข้อมูล|ไม่พบข้อมูล|ให้แอดมิน|แอดมินช่วย|ไม่แน่ใจ|i don't have|don't know|not sure/i

export const GROUNDING_RULES = `[ข้อเท็จจริงของร้าน — ห้ามเดา]
ราคา สต็อก สเปก โปรโมชั่น นโยบาย การจัดส่ง เวลาทำการ และช่องทางชำระเงิน ต้องมาจากข้อความในพรอมต์นี้ หรือจากผลเครื่องมือในเทิร์นนี้เท่านั้น
- ราคาและจำนวนสินค้า: ใช้ตัวเลขจาก [แคตตาล็อกสินค้าของร้าน] หรือผล search_products / check_stock ห้ามจำราคาเอง
- นโยบาย วิธีส่ง โปรที่ไม่อยู่ในแคตตาล็อก สเปกที่แคตตาล็อกไม่มี และเวลาที่ไม่มีใน [เวลาทำการของร้าน]: เรียก search_knowledge_base ก่อนตอบ
- ห้ามสัญญาว่าส่งฟรี รับประกัน ของแท้ ลดราคา เก็บเงินปลายทาง หรือตัดรอบเวลา ถ้าข้อมูลร้านไม่ได้เขียนไว้
- ทักทาย ถามความต้องการ ขอชื่อ เบอร์ ที่อยู่ และชวนเลือกสินค้าได้ตามปกติ โดยไม่ต้องอ้างแหล่งข้อมูล
- ถ้าไม่มีข้อมูล ให้บอกอย่างสุภาพว่าจะให้แอดมินช่วยตรวจ แล้วเรียก request_human_agent ห้ามแต่งคำตอบ
- เมื่อตอบข้อเท็จจริง ให้ปิดท้ายหนึ่งบรรทัดภายในรูปแบบ [[cite:chunk:<chunk_id>,tool:<ชื่อเครื่องมือ>]] ใส่เฉพาะ chunk_id หรือเครื่องมือที่มีจริงในเทิร์นนี้ ลูกค้าจะไม่เห็นบรรทัดนี้`

export const GROUNDING_HANDOFF = {
  th: 'เรื่องนี้ยังไม่มีในข้อมูลของร้านค่ะ เดี๋ยวส่งให้แอดมินช่วยตรวจสอบ แล้วจะติดต่อกลับนะคะ',
  en: "I don't have that in the shop's information. I'll ask the team to check and get back to you.",
} as const

export interface EvidenceChunk {
  id: string
  content: string
}

export interface GroundingInput {
  draft: string
  customerMessage: string
  language: 'th' | 'en'
  chunks: EvidenceChunk[]
  evidenceTexts: string[]
  /** search_knowledge_base returned nothing for this turn. */
  knowledgeMiss?: boolean
}

export type GroundingReason = 'small_talk' | 'grounded' | 'unsupported_shop_fact' | 'invented_citation' | 'unanswered'

export interface GroundingVerdict {
  text: string
  skipped: boolean
  grounded: boolean
  shouldHandoff: boolean
  shouldLog: boolean
  reason: GroundingReason
  question: string
}

export interface GapExisting {
  id: string
  status: 'open' | 'dismissed'
  ask_count: number
}

export type GapPlan =
  | { action: 'insert' }
  | { action: 'increment'; id: string; askCount: number }

export function assertGapShop(shopId: string): string {
  const id = (shopId || '').trim()
  if (!UUID_RE.test(id)) throw new Error('shop id is required to log a knowledge gap')
  return id
}

export function questionKey(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
}

export function planGapWrite(existing: GapExisting | null): GapPlan {
  if (!existing) return { action: 'insert' }
  return { action: 'increment', id: existing.id, askCount: Math.max(0, existing.ask_count || 0) + 1 }
}

export function gapInsert(shopId: string, question: string, reason: GroundingReason) {
  return {
    shop_id: assertGapShop(shopId),
    question: question.trim().slice(0, 500),
    question_key: questionKey(question),
    reason,
    status: 'open' as const,
    ask_count: 1,
  }
}

export function chunksFromRetrievedText(text: string): EvidenceChunk[] {
  const chunks: EvidenceChunk[] = []
  for (const match of text.matchAll(CHUNK_BLOCK_RE)) {
    const id = match[1]
    const content = (match[2] || '').trim()
    if (id && content) chunks.push({ id, content })
  }
  return chunks
}

export function checkGrounding(input: GroundingInput): GroundingVerdict {
  const question = (input.customerMessage || '').trim().slice(0, 500)
  const { visible, citedChunkIds } = stripCitations(input.draft || '')
  const allowed = new Set(input.chunks.map((chunk) => chunk.id))
  const invented = citedChunkIds.some((id) => !allowed.has(id))
  const evidence = normalize([
    ...input.evidenceTexts,
    ...input.chunks.map((chunk) => chunk.content),
  ].join('\n'))
  const sentences = splitSentences(visible)
  const factSentences = sentences.filter(isShopFactSentence)
  const base = {
    question,
    text: visible,
  }

  if (factSentences.length === 0) {
    const unanswered = Boolean(input.knowledgeMiss) && UNKNOWN_REPLY.test(visible)
    return {
      ...base,
      skipped: !unanswered,
      grounded: true,
      shouldHandoff: unanswered,
      shouldLog: unanswered,
      reason: unanswered ? 'unanswered' : 'small_talk',
    }
  }

  const unsupported = factSentences.filter((sentence) => !sentenceSupported(sentence, evidence))
  if (unsupported.length === 0) {
    return {
      ...base,
      skipped: false,
      grounded: true,
      shouldHandoff: false,
      shouldLog: false,
      reason: 'grounded',
    }
  }

  return {
    text: input.language === 'en' ? GROUNDING_HANDOFF.en : GROUNDING_HANDOFF.th,
    question,
    skipped: false,
    grounded: false,
    shouldHandoff: true,
    shouldLog: true,
    reason: invented ? 'invented_citation' : 'unsupported_shop_fact',
  }
}

function stripCitations(draft: string): { visible: string; citedChunkIds: string[] } {
  const citedChunkIds: string[] = []
  const visible = draft
    .replace(CITE_RE, (_all, body: string) => {
      for (const part of String(body).split(',')) {
        const token = part.trim()
        const chunk = /^chunk:([0-9a-f-]{36})$/i.exec(token)
        if (chunk) citedChunkIds.push(chunk[1])
      }
      return ''
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { visible, citedChunkIds }
}

function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function isShopFactSentence(sentence: string): boolean {
  if (!FACT_CUE.test(sentence)) return false
  if (OPEN_QUESTION.test(sentence) && !CONCRETE.test(sentence)) return false
  return true
}

function sentenceSupported(sentence: string, evidence: string): boolean {
  const norm = normalize(sentence)
  if (/จองเรียบร้อย|รับออเดอร์แล้ว/.test(norm)) {
    const id = norm.match(/[a-z]{2,}-\d{3,}/i)
    if (!id) return false
    return evidence.includes(id[0].toLowerCase())
  }
  if (!literalPhrasesSupported(norm, evidence)) return false
  if (!codesSupported(norm, evidence)) return false
  const claims = extractClaims(norm)
  if (/ราคา|บาท|฿|baht|\bprice\b/.test(norm)) {
    for (const match of norm.matchAll(/(?:^|[^\d])(\d{2,7})(?!\d)/g)) {
      if (!claims.some((claim) => claim.digits === match[1])) {
        claims.push({ digits: match[1], unit: 'บาท', time: null })
      }
    }
  }
  return claims.every((claim) => claimSupported(claim, evidence))
}

function codesSupported(sentence: string, evidence: string): boolean {
  if (!/รหัสสินค้า|\bsku\b/.test(sentence)) return true
  const codes = sentence.match(/[a-z]{1,8}-?\d{2,}/gi) || []
  if (codes.length === 0) return false
  return codes.every((code) => evidence.includes(code.toLowerCase()))
}

function literalPhrasesSupported(sentence: string, evidence: string): boolean {
  const groups = [
    ['ส่งฟรี', 'จัดส่งฟรี', 'ฟรีค่าส่ง'],
    ['รับประกัน'],
    ['เก็บเงินปลายทาง', 'เก็บปลายทาง'],
    ['ของแท้'],
    ['เปิดทุกวัน'],
  ]
  for (const group of groups) {
    const used = group.filter((phrase) => sentence.includes(phrase))
    if (used.length === 0) continue
    if (!used.some((phrase) => phraseOccurs(evidence, phrase))) return false
  }
  return true
}

function phraseOccurs(evidence: string, phrase: string): boolean {
  let from = 0
  while (from < evidence.length) {
    const at = evidence.indexOf(phrase, from)
    if (at < 0) return false
    const prefix = evidence.slice(Math.max(0, at - 8), at)
    if (!/ไม่(?:มี|ได้)?\s*$/.test(prefix)) return true
    from = at + phrase.length
  }
  return false
}

interface NumberClaim {
  digits: string
  unit: string | null
  time: string | null
}

function extractClaims(sentence: string): NumberClaim[] {
  const claims: NumberClaim[] = []
  for (const match of sentence.matchAll(/(\d{1,2}):(\d{2})/g)) {
    claims.push({ digits: '', unit: null, time: `${match[1].padStart(2, '0')}:${match[2]}` })
  }
  for (const match of sentence.matchAll(/(\d+(?:\.\d+)?)(\s*)(บาท|฿|baht|%|ปี|เดือน|วัน|ชั่วโมง|ชม|ชิ้น)/g)) {
    const digits = match[1]
    const unit = match[3]
    if ((digits === '1' || digits === '2') && !unit) continue
    claims.push({ digits, unit, time: null })
  }
  for (const match of sentence.matchAll(/(?:^|[^\d])(\d{8,})(?!\d)/g)) {
    claims.push({ digits: match[1], unit: 'account', time: null })
  }
  return claims
}

function claimSupported(claim: NumberClaim, evidence: string): boolean {
  if (claim.time) {
    const alt = claim.time.replace(/^0/, '')
    return evidence.includes(claim.time) || evidence.includes(alt)
  }
  if (!claim.digits) return false
  if (claim.unit && claim.unit !== 'account') {
    const unit = claim.unit === '฿' ? '(?:฿|บาท)' : claim.unit
    const re = new RegExp(`${escapeRegExp(claim.digits)}\\s*${unit}|${unit}\\s*${escapeRegExp(claim.digits)}`)
    return re.test(evidence)
  }
  return new RegExp(`(?:^|[^\\d])${escapeRegExp(claim.digits)}(?!\\d)`).test(evidence)
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
