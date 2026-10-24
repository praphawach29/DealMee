/**
 * Merges vector hits and keyword hits for one shop.
 *
 * Reciprocal rank fusion keeps the two score scales from fighting. A second
 * pass then boosts exact product codes and prices (Thai full-text search
 * splits those poorly) and gives merchant-written Q&A a small tie-break,
 * not a free pass over a chunk that actually contains the code.
 *
 * Every hit from another shop is dropped. Callers also filter in SQL.
 */

const RRF_K = 60
const VECTOR_ONLY_FLOOR = 0.35
const KEYWORD_ONLY_FLOOR = 0.25
const META_MARKERS = ['วิธีตอบ', 'ห้ามพูด', 'ห้ามสัญญา', 'เมื่อไหร่ต้องส่งต่อ']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface HybridCandidate {
  id: string
  shopId: string
  content: string
  sourceFile: string | null
  section: string | null
  sourceKind: 'qa' | 'document'
  priority: number
  chunkIndex: number
  vectorRank?: number
  keywordRank?: number
  /** Cosine similarity in 0..1, not a distance. */
  vectorScore?: number
  keywordScore?: number
}

export interface RankedChunk extends HybridCandidate {
  score: number
}

export interface KnowledgeCitation {
  chunkId: string
  sourceFile: string | null
  section: string | null
}

export function assertShopScope(shopId: string): string {
  const id = (shopId || '').trim()
  if (!UUID_RE.test(id)) throw new Error('shop id is required to retrieve knowledge')
  return id
}

export function vectorSearchArgs(shopId: string, embedding: number[], limit: number) {
  return {
    p_shop_id: assertShopScope(shopId),
    p_query_embedding: `[${embedding.join(',')}]`,
    p_match_count: limit,
  }
}

export function keywordSearchArgs(shopId: string, query: string, limit: number) {
  return {
    p_shop_id: assertShopScope(shopId),
    p_query: Array.from(query).slice(0, 500).join(''),
    p_match_count: limit,
  }
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export function buildRetrievalQuery(query: string, recent: string[] = []): string {
  const current = (query || '').trim()
  if (!current) return ''
  if (Array.from(current).length >= 25 || recent.length === 0) return Array.from(current).slice(0, 800).join('')
  const prev = recent.map((item) => item.trim()).filter(Boolean).slice(-1)[0] || ''
  if (!prev) return Array.from(current).slice(0, 800).join('')
  return Array.from(`${prev}\n${current}`).slice(0, 800).join('')
}

/** Merchant-written rows outrank imported summaries, which outrank raw document slices. */
export function priorityForSource(source: string | null | undefined): number {
  if (!source || source === 'manual') return 100
  return 40
}

export const DOCUMENT_PRIORITY = 10

const PARTICLES = [
  'นะคะ', 'นะครับ', 'ครับ', 'ค่ะ', 'คะ', 'จ้า', 'จ้ะ', 'หน่อย', 'ไหม', 'มั้ย', 'บ้าง', 'ด้วย', 'เลย',
  'ยังไง', 'อย่างไร', 'เท่าไหร่', 'เท่าไร', 'สอบถาม', 'อยากทราบ', 'รบกวน', 'ขอ', 'ได้',
]

function bigrams(text: string): Set<string> {
  let normalized = (text || '').toLowerCase()
  for (const particle of PARTICLES) normalized = normalized.split(particle).join(' ')
  normalized = normalized.replace(/[\s.,!?()"'“”:;\-–—/\\[\]{}]+/g, ' ')
  const out = new Set<string>()
  for (const word of normalized.split(' ')) {
    const chars = Array.from(word)
    for (let i = 0; i + 1 < chars.length; i++) out.add(chars[i] + chars[i + 1])
  }
  return out
}

export function bigramOverlapRatio(query: string, text: string): number {
  const left = bigrams(query)
  if (left.size === 0) return 0
  const right = bigrams(text)
  let shared = 0
  for (const gram of left) if (right.has(gram)) shared++
  return shared / left.size
}

export function exactTokens(query: string): string[] {
  const found = new Set<string>()
  const lower = query.toLowerCase()
  for (const match of lower.matchAll(/[a-z0-9][a-z0-9._/-]{2,}/g)) found.add(match[0])
  for (const match of query.matchAll(/\d{2,}(?:[.,]\d+)*/g)) found.add(match[0].replace(/,/g, ''))
  return [...found]
}

function exactTokenBoost(query: string, text: string): number {
  const haystack = text.toLowerCase()
  let boost = 0
  for (const token of exactTokens(query)) {
    if (!haystack.includes(token.toLowerCase())) continue
    boost += /[a-z]/i.test(token) ? 0.35 : 0.2
  }
  return Math.min(boost, 0.8)
}

function isMetaGuideline(section: string | null): boolean {
  const title = section || ''
  return META_MARKERS.some((marker) => title.includes(marker))
}

function queryAsksMeta(query: string): boolean {
  return META_MARKERS.some((marker) => query.includes(marker))
}

function normalizeContent(content: string): string {
  return content.replace(/^Q:[\s\S]*\nA:\s*/, '').replace(/\s+/g, ' ').trim()
}

export function mergeHybridResults(input: {
  shopId: string
  query: string
  vectorHits?: HybridCandidate[]
  keywordHits?: HybridCandidate[]
  limit?: number
}): RankedChunk[] {
  const shopId = (input.shopId || '').trim()
  if (!shopId) throw new Error('shop id is required to retrieve knowledge')
  const query = (input.query || '').trim()
  if (!query) return []

  interface Accum extends HybridCandidate {
    vectorRank?: number
    keywordRank?: number
  }
  const byId = new Map<string, Accum>()

  const consider = (hit: HybridCandidate, kind: 'vector' | 'keyword', rank: number) => {
    if (!hit?.id || hit.shopId !== shopId) return
    const current = byId.get(hit.id) || { ...hit }
    if (kind === 'vector') {
      current.vectorRank = hit.vectorRank ?? rank
      current.vectorScore = hit.vectorScore
    } else {
      current.keywordRank = hit.keywordRank ?? rank
      current.keywordScore = hit.keywordScore
    }
    current.content = current.content || hit.content
    current.sourceFile = current.sourceFile ?? hit.sourceFile
    current.section = current.section ?? hit.section
    current.sourceKind = current.sourceKind || hit.sourceKind
    current.priority = Math.max(current.priority || 0, hit.priority || 0)
    byId.set(hit.id, current)
  }

  ;(input.vectorHits || []).forEach((hit, index) => consider(hit, 'vector', index + 1))
  ;(input.keywordHits || []).forEach((hit, index) => consider(hit, 'keyword', index + 1))

  const ranked: RankedChunk[] = []
  for (const hit of byId.values()) {
    const rrf =
      (hit.vectorRank ? 1 / (RRF_K + hit.vectorRank) : 0) +
      (hit.keywordRank ? 1 / (RRF_K + hit.keywordRank) : 0)
    const lexical = bigramOverlapRatio(query, `${hit.section || ''} ${hit.content}`)
    const codes = exactTokenBoost(query, `${hit.sourceFile || ''} ${hit.section || ''} ${hit.content}`)
    const priorityTie = Math.max(0, Math.min(hit.priority || 0, 100)) / 5000
    const meta = isMetaGuideline(hit.section) && !queryAsksMeta(query) ? 0.15 : 0
    const inBoth = Boolean(hit.vectorRank && hit.keywordRank)
    const keywordOk = Boolean(hit.keywordRank) && ((hit.keywordScore ?? 1) >= KEYWORD_ONLY_FLOOR || lexical > 0)
    const vectorOk = Boolean(hit.vectorRank) && (hit.vectorScore ?? 0) >= VECTOR_ONLY_FLOOR
    if (!inBoth && !keywordOk && !vectorOk && codes <= 0) continue
    ranked.push({ ...hit, score: rrf * (1 + lexical) + codes + priorityTie - meta })
  }

  ranked.sort((a, b) => b.score - a.score || b.priority - a.priority || a.id.localeCompare(b.id))

  const seen = new Set<string>()
  const unique: RankedChunk[] = []
  for (const hit of ranked) {
    const key = normalizeContent(hit.content)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    unique.push(hit)
  }
  return unique.slice(0, input.limit ?? 8)
}

export function formatRetrievedChunk(chunk: Pick<RankedChunk, 'id' | 'sourceFile' | 'section' | 'content'>): string {
  const file = chunk.sourceFile || 'ไม่ระบุไฟล์'
  const section = chunk.section || 'ไม่ระบุหัวข้อ'
  return `[chunk_id: ${chunk.id} | ไฟล์: ${file} | หัวข้อ: ${section}]\n${(chunk.content || '').trim()}`
}

export function formatRetrievedKnowledge(chunks: RankedChunk[], maxChars = 6000): {
  blocks: string[]
  omitted: number
  citations: KnowledgeCitation[]
} {
  const blocks: string[] = []
  const citations: KnowledgeCitation[] = []
  let used = 0
  for (const chunk of chunks) {
    let block = formatRetrievedChunk(chunk)
    const separator = blocks.length > 0 ? 2 : 0
    if (blocks.length > 0 && used + separator + codePoints(block) > maxChars) continue
    if (blocks.length === 0 && codePoints(block) > maxChars) {
      block = Array.from(block).slice(0, maxChars).join('')
    }
    blocks.push(block)
    citations.push({ chunkId: chunk.id, sourceFile: chunk.sourceFile, section: chunk.section })
    used += separator + codePoints(block)
  }
  return { blocks, omitted: chunks.length - blocks.length, citations }
}

function codePoints(text: string): number {
  return Array.from(text).length
}

export const NO_KNOWLEDGE_TOOL_RESULT = (query: string) =>
  `ไม่พบข้อมูลเรื่อง "${query}" ในคลังความรู้ของร้าน ห้ามเดาคำตอบ ให้บอกลูกค้าว่าจะให้แอดมินช่วยตรวจสอบ หรือเรียก request_human_agent`

export function renderToolResult(query: string, chunks: RankedChunk[]): string {
  if (chunks.length === 0) return NO_KNOWLEDGE_TOOL_RESULT(query)
  return `ข้อมูลจากคลังความรู้ (อ้างอิง chunk_id เมื่อตอบ):\n` + chunks.map(formatRetrievedChunk).join('\n\n')
}

export function renderKnowledgeSection(input: {
  chunks: RankedChunk[]
  shopHasKnowledge: boolean
  maxChars?: number
}): { text: string; citations: KnowledgeCitation[]; omitted: number } {
  if (input.chunks.length === 0) {
    if (!input.shopHasKnowledge) return { text: '', citations: [], omitted: 0 }
    return {
      text: '\n\n[คลังข้อมูลความรู้ของร้าน]\nไม่มีช่วงข้อความที่ตรงกับข้อความนี้ ถ้าจะตอบรายละเอียดเฉพาะของร้าน ให้เรียก search_knowledge_base ก่อน ถ้าเครื่องมือก็ไม่พบ ห้ามเดาคำตอบ ให้เรียก request_human_agent',
      citations: [],
      omitted: 0,
    }
  }
  const formatted = formatRetrievedKnowledge(input.chunks, input.maxChars ?? 6000)
  const tail = formatted.omitted > 0
    ? `\n\n(ยังมีข้อมูลอีก ${formatted.omitted} ส่วนที่ไม่ได้แสดงตรงนี้ ถ้าลูกค้าถามเรื่องที่ไม่มีข้างบน ให้เรียก search_knowledge_base ค้นหาก่อนตอบว่าไม่รู้ ห้ามเดา)`
    : ''
  return {
    text:
      '\n\n[คลังข้อมูลความรู้ของร้าน (เฉพาะส่วนที่เกี่ยวข้อง)]\nตอบจากข้อความด้านล่างหรือจากผล search_knowledge_base เท่านั้น ถ้าไม่มีข้อมูล ห้ามเดา ให้เรียก request_human_agent\n' +
      formatted.blocks.join('\n\n') +
      tail,
    citations: formatted.citations,
    omitted: formatted.omitted,
  }
}

export function isMissingKnowledgeSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: string; message?: string }
  const code = record.code || ''
  const message = (record.message || '').toLowerCase()
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883') return true
  return (
    message.includes('knowledge_chunks') ||
    message.includes('knowledge_documents') ||
    message.includes('match_knowledge_chunks') ||
    message.includes('search_knowledge_chunks_keyword')
  )
}

export function providerFromModel(model: string | null | undefined): 'gemini' | 'openai' | null {
  if (!model) return null
  if (model.startsWith('gemini:')) return 'gemini'
  if (model.startsWith('openai:')) return 'openai'
  return null
}
