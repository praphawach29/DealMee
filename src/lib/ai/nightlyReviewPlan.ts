import { createHash } from 'crypto'
import { questionKey } from '@/lib/ai/grounding'
import { redactPii } from '@/lib/ai/redactPii'
import { SHOP_SKILL_TYPES, type ShopSkillType } from '@/lib/ai/shopSkills'

/** Caps for one shop on one night. The model is not called when there is nothing to send. */
export const NIGHTLY_REVIEW_LIMITS = {
  maxSignals: 40,
  maxClusters: 8,
  maxProposals: 3,
  maxShopsPerRun: 20,
  maxModelShops: 3,
  lookbackDays: 7,
  budgetMs: 25_000,
  maxChain: 30,
  staleRunMs: 10 * 60 * 1000,
} as const

export type ReviewSignalType = 'gap' | 'feedback' | 'admin_reply'

export type ReviewSignal = {
  type: ReviewSignalType
  id: string
  shopId: string
  conversationId: string | null
  chatMessageId: string | null
  at: string
  /** Customer question, already safe to show. Never the bot's reply. */
  topic: string
  /** Text an admin or merchant wrote. Null when nobody answered. */
  adminText: string | null
  askCount: number
  reason: string | null
  overrodeSuggestion: boolean
}

export type SkillBrief = {
  id: string
  shopId: string
  status: 'candidate' | 'active' | 'archived'
  skill_type: ShopSkillType
  category: string
  trigger_keywords: string[]
  knowledge_body: string | null
  facts_confirmed: boolean
}

export type Rejection = {
  fingerprint: string
  topicKeys: string[]
}

export type Cluster = {
  id: string
  signals: ReviewSignal[]
  topicKeys: string[]
  fingerprint: string
}

export type RawModelProposal = {
  cluster_id?: unknown
  skill_type?: unknown
  category?: unknown
  trigger_keywords?: unknown
  instruction?: unknown
}

export type ProposalDraft = {
  clusterId: string
  skillType: ShopSkillType
  category: string
  triggerKeywords: string[]
  knowledgeBody: string | null
  instruction: string
  summaryTh: string
  needsMerchantFact: boolean
  revisesSkillId: string | null
  fingerprint: string
  topicKeys: string[]
  sourceSignals: {
    type: ReviewSignalType
    id: string
    label: string
    conversationId: string | null
    chatMessageId: string | null
  }[]
  status: 'candidate'
  factsConfirmed: false
}

export function bangkokDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function reviewLookbackStart(now = new Date(), days = NIGHTLY_REVIEW_LIMITS.lookbackDays): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

export function shopEligible(shop: { id?: string | null; status?: string | null; features?: unknown }): boolean {
  if (!shop.id) return false
  if (shop.status === 'suspended') return false
  const features = shop.features
  if (features && typeof features === 'object' && !Array.isArray(features) && (features as { is_demo?: unknown }).is_demo === true) {
    return false
  }
  return true
}

export function claimDecision(
  existing: { status: string; startedAt: string } | null,
  now: number,
  staleMs = NIGHTLY_REVIEW_LIMITS.staleRunMs,
): 'insert' | 'takeover' | 'skip' {
  if (!existing) return 'insert'
  if (existing.status === 'completed' || existing.status === 'skipped') return 'skip'
  const started = new Date(existing.startedAt).getTime()
  const age = Number.isNaN(started) ? staleMs : now - started
  if (existing.status === 'running' || existing.status === 'failed') {
    return age >= staleMs ? 'takeover' : 'skip'
  }
  return 'skip'
}

export function cronAuthResult(authorization: string | null, secret: string | undefined): 200 | 401 | 503 {
  const trimmed = secret?.trim()
  if (!trimmed) return 503
  if ((authorization || '').trim() !== `Bearer ${trimmed}`) return 401
  return 200
}

export function decisionEffect(decision: 'accept' | 'reject'): {
  proposalStatus: 'accepted' | 'rejected'
  archiveCandidate: boolean
  recordRejection: boolean
  activatesSkill: false
  confirmsFacts: false
} {
  if (decision === 'accept') {
    return { proposalStatus: 'accepted', archiveCandidate: false, recordRejection: false, activatesSkill: false, confirmsFacts: false }
  }
  return { proposalStatus: 'rejected', archiveCandidate: true, recordRejection: true, activatesSkill: false, confirmsFacts: false }
}

export function shouldChain(remaining: boolean, chain: number, maxChain = NIGHTLY_REVIEW_LIMITS.maxChain): boolean {
  return remaining && Number.isFinite(chain) && chain >= 0 && chain < maxChain
}

export function isBroadcastAdminMessage(message: { sender_name?: string | null; metadata?: unknown }): boolean {
  const name = String(message.sender_name || '').toLowerCase()
  if (name.includes('broadcast')) return true
  const meta = message.metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && 'broadcast_title' in meta) return true
  return false
}

export function clip(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max).trim()
}

export function topicKeyOf(text: string): string {
  return questionKey(redactPii(text)).slice(0, 160)
}

export function clusterFingerprint(keys: string[]): string {
  const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))].sort()
  return createHash('sha256').update(unique.join('\n')).digest('hex').slice(0, 32)
}

function compact(text: string): string {
  return redactPii(text).toLocaleLowerCase('th-TH').replace(/[^\p{L}\p{N}]+/gu, '')
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>()
  if (text.length < 2) {
    if (text) set.add(text)
    return set
  }
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2))
  return set
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}

export function signalsRelated(left: ReviewSignal, right: ReviewSignal): boolean {
  if (left.shopId !== right.shopId) return false
  const a = compact(left.topic || left.adminText || '')
  const b = compact(right.topic || right.adminText || '')
  if (!a || !b) return false
  if (a.length >= 8 && (b.includes(a) || a.includes(b))) return true
  return jaccard(bigrams(a), bigrams(b)) >= 0.34
}

function signalTopicKey(signal: ReviewSignal): string {
  const topic = signal.topic.trim()
  if (topic) return topicKeyOf(topic)
  if (signal.adminText?.trim()) return topicKeyOf(signal.adminText)
  return ''
}

function clusterScore(signals: ReviewSignal[]): number {
  const asks = signals.reduce((sum, signal) => sum + Math.max(1, signal.askCount || 1), 0)
  const taught = signals.some((signal) => (signal.adminText || '').trim()) ? 3 : 0
  return asks + taught + signals.length
}

export function clusterSignals(signals: ReviewSignal[], limit: number = NIGHTLY_REVIEW_LIMITS.maxClusters): Cluster[] {
  const ordered = [...signals].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const groups: ReviewSignal[][] = []
  for (const signal of ordered) {
    const found = groups.find((group) => group.some((member) => signalsRelated(member, signal)))
    if (found) {
      if (found.length < 8) found.push(signal)
    } else {
      groups.push([signal])
    }
  }
  return groups
    .map((group) => {
      const topicKeys = [...new Set(group.map(signalTopicKey).filter(Boolean))].sort()
      return { signals: group, topicKeys, fingerprint: clusterFingerprint(topicKeys) }
    })
    .sort((a, b) => clusterScore(b.signals) - clusterScore(a.signals))
    .slice(0, limit)
    .map((group, index) => ({ ...group, id: `c${index + 1}` }))
}

export function clusterIsRecurring(signals: ReviewSignal[]): boolean {
  if (signals.length >= 2) return true
  const only = signals[0]
  if (!only) return false
  if ((only.askCount || 0) >= 2) return true
  return Boolean(only.adminText && only.adminText.trim())
}

export function clusterBlocked(cluster: Cluster, rejections: Rejection[], pendingFingerprints: string[]): boolean {
  if (!cluster.fingerprint) return true
  if (pendingFingerprints.includes(cluster.fingerprint)) return true
  return rejections.some((rejection) => {
    if (rejection.fingerprint === cluster.fingerprint) return true
    if (cluster.topicKeys.length === 0) return false
    return cluster.topicKeys.every((key) => rejection.topicKeys.includes(key))
  })
}

export type ReviewSelection = {
  promptClusters: Cluster[]
  blockedSignals: ReviewSignal[]
}

/** Recurring clusters go to the model. Quiet one-off signals stay unmarked so a later night can group them. */
export function selectReviewClusters(
  signals: ReviewSignal[],
  rejections: Rejection[],
  pendingFingerprints: string[],
): ReviewSelection {
  const promptClusters: Cluster[] = []
  const blockedSignals: ReviewSignal[] = []
  for (const cluster of clusterSignals(signals, signals.length || 1)) {
    if (!clusterIsRecurring(cluster.signals)) continue
    if (clusterBlocked(cluster, rejections, pendingFingerprints)) {
      blockedSignals.push(...cluster.signals)
      continue
    }
    promptClusters.push(cluster)
  }
  return {
    promptClusters: promptClusters.slice(0, NIGHTLY_REVIEW_LIMITS.maxClusters),
    blockedSignals,
  }
}

export function adminFactText(signals: ReviewSignal[]): string | null {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const signal of signals) {
    const text = redactPii(signal.adminText || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    parts.push(text)
  }
  const joined = parts.join('\n').slice(0, 1500).trim()
  return joined || null
}

export function fillInInstruction(topic: string): string {
  const label = clip(redactPii(topic).trim() || 'คำถามนี้', 120)
  return `ลูกค้าถามซ้ำเรื่อง «${label}» แต่ยังไม่มีคำตอบที่ร้านหรือแอดมินเขียนไว้ กรุณาเติมข้อเท็จจริงของร้านในช่องข้อมูล แล้วค่อยเปิดใช้ ถ้ายังไม่ทราบ ให้บอทส่งต่อแอดมิน ห้ามเดาคำตอบ`
}

export function confirmedInstruction(): string {
  return 'เมื่อลูกค้าถามเรื่องนี้ ให้ตอบจากข้อมูลในสกิลได้หลังร้านยืนยันแล้วเท่านั้น ก่อนยืนยันห้ามใช้ข้อความนี้เป็นหลักฐาน และให้ส่งต่อแอดมินถ้าตอบไม่ได้'
}

export function serverSummary(signals: ReviewSignal[], needsFact: boolean, revisesCategory: string | null): string {
  const gap = signals.filter((signal) => signal.type === 'gap').length
  const feedback = signals.filter((signal) => signal.type === 'feedback').length
  const admin = signals.filter((signal) => signal.type === 'admin_reply').length
  const bits: string[] = []
  if (gap) bits.push(`คำถามที่ตอบไม่ได้ ${gap}`)
  if (admin) bits.push(`แอดมินตอบเอง ${admin}`)
  if (feedback) bits.push(`กดไม่ชอบ ${feedback}`)
  const why = bits.join(' · ') || 'สัญญาณจากแชท'
  const head = needsFact
    ? 'ข้อเสนอให้เติมข้อเท็จจริง ยังไม่เปิดใช้'
    : 'ข้อเสนอจากคำตอบที่ร้านเขียนไว้ ยังไม่เปิดใช้'
  const edit = revisesCategory ? ` เสนอเป็นฉบับร่างแยกจากสกิล «${revisesCategory}» โดยยังไม่แก้สกิลเดิม` : ''
  return `${head}${edit} (${why})`
}

export function matchSkill(topics: string, skills: SkillBrief[], shopId: string): SkillBrief | null {
  const hay = topics.toLocaleLowerCase('th-TH')
  let best: { skill: SkillBrief; score: number } | null = null
  for (const skill of skills) {
    if (skill.shopId !== shopId || skill.status === 'archived') continue
    let score = 0
    for (const keyword of skill.trigger_keywords) {
      const token = keyword.trim().toLocaleLowerCase('th-TH')
      if (token && hay.includes(token)) score += 2
    }
    const category = skill.category.trim().toLocaleLowerCase('th-TH')
    if (category && hay.includes(category)) score += 1
    if (!best || score > best.score) best = { skill, score }
  }
  return best && best.score >= 2 ? best.skill : null
}

export function buildReviewPrompt(shopId: string, clusters: Cluster[], skills: SkillBrief[]): string {
  const owned = clusters.filter((cluster) => cluster.signals.every((signal) => signal.shopId === shopId))
  const payload = {
    shop_skills: skills
      .filter((skill) => skill.shopId === shopId && skill.status !== 'archived')
      .slice(0, 30)
      .map((skill) => ({
        id: skill.id,
        category: skill.category,
        skill_type: skill.skill_type,
        keywords: skill.trigger_keywords.slice(0, 8).map((keyword) => clip(redactPii(keyword), 40)),
        confirmed_fact: skill.facts_confirmed ? clip(redactPii(skill.knowledge_body || ''), 300) : null,
      })),
    clusters: owned.map((cluster) => ({
      cluster_id: cluster.id,
      signals: cluster.signals.map((signal) => ({
        type: signal.type,
        topic: clip(redactPii(signal.topic), 300),
        admin_text: signal.adminText ? clip(redactPii(signal.adminText), 400) : null,
        ask_count: Math.max(1, signal.askCount || 1),
        overrode_suggestion: signal.overrodeSuggestion === true,
      })),
    })),
  }
  return [
    'คุณช่วยร้านคัดปัญหาที่เกิดซ้ำ แล้วเสนอสกิลฉบับร่างเท่านั้น',
    'ห้ามเปิดใช้สกิล และห้ามแต่งข้อเท็จจริง ราคา วัน สต็อก หรือนโยบายที่ไม่มีใน admin_text',
    'admin_text คือถ้อยคำที่แอดมินหรือร้านเขียน knowledge ที่จะถูกเก็บคัดลอกจากข้อความนั้นโดยระบบ ไม่ต้องเขียน knowledge_body',
    'ถ้า admin_text เป็น null แปลว่ายังไม่มีคำตอบจากร้าน ห้ามแต่งคำตอบ',
    'เลือกอย่างมาก 3 คลัสเตอร์ที่สกิลใหม่หรือฉบับร่างแยกจะช่วยได้ จงละคลัสเตอร์ที่ไม่คุ้ม',
    'trigger_keywords เป็นคำสั้น ๆ ภาษาไทย 1-5 คำ จากหัวข้อ ไม่ใส่เบอร์โทรหรือเลขเอกสาร',
    'อย่าเขียนคำตอบหรือแนวทาง ระบบจะคัดลอก admin_text เอง หรือจะขอให้ร้านเติมถ้ายังไม่มี',
    'ตอบเป็น JSON เท่านั้น รูปแบบ {"proposals":[{"cluster_id":"c1","skill_type":"knowledge","category":"shipping","trigger_keywords":["ส่งของ"]}]}',
    'skill_type ต้องเป็น knowledge, behavior, example หรือ rule',
    JSON.stringify(payload),
  ].join('\n')
}

export function parseReviewModelOutput(raw: string): { ok: true; proposals: RawModelProposal[] } | { ok: false } {
  try {
    const parsed = JSON.parse(raw) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { proposals?: unknown }).proposals)
        ? (parsed as { proposals: unknown[] }).proposals
        : null
    if (!list) return { ok: false }
    const proposals = list.filter((item): item is RawModelProposal => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    return { ok: true, proposals }
  } catch {
    return { ok: false }
  }
}

function asSkillType(value: unknown): ShopSkillType {
  return typeof value === 'string' && (SHOP_SKILL_TYPES as readonly string[]).includes(value)
    ? value as ShopSkillType
    : 'knowledge'
}

function asKeywords(value: unknown, fallback: string): string[] {
  const raw = Array.isArray(value) ? value : []
  const keywords = [...new Set(raw.map((item) => clip(redactPii(String(item || '')), 40)).filter((item) => item && !item.startsWith('[')))]
  if (keywords.length > 0) return keywords.slice(0, 5)
  const backup = clip(redactPii(fallback), 24)
  return backup ? [backup] : ['ทั่วไป']
}

export function buildProposalDrafts(input: {
  shopId: string
  clusters: Cluster[]
  skills: SkillBrief[]
  modelProposals: RawModelProposal[]
  rejections: Rejection[]
  pendingFingerprints: string[]
}): ProposalDraft[] {
  const byId = new Map(input.clusters.map((cluster) => [cluster.id, cluster]))
  const used = new Set<string>()
  const drafts: ProposalDraft[] = []
  for (const raw of input.modelProposals) {
    if (drafts.length >= NIGHTLY_REVIEW_LIMITS.maxProposals) break
    const clusterId = typeof raw.cluster_id === 'string' ? raw.cluster_id : ''
    const cluster = byId.get(clusterId)
    if (!cluster || used.has(cluster.id)) continue
    if (cluster.signals.some((signal) => signal.shopId !== input.shopId)) continue
    if (clusterBlocked(cluster, input.rejections, input.pendingFingerprints)) continue
    used.add(cluster.id)
    const fact = adminFactText(cluster.signals)
    const needsMerchantFact = !fact
    const topic = cluster.signals.map((signal) => signal.topic).find((item) => item.trim()) || ''
    const matched = matchSkill(
      cluster.signals.map((signal) => `${signal.topic} ${signal.adminText || ''}`).join('\n'),
      input.skills,
      input.shopId,
    )
    const instruction = needsMerchantFact ? fillInInstruction(topic) : confirmedInstruction()
    drafts.push({
      clusterId: cluster.id,
      skillType: asSkillType(raw.skill_type),
      category: clip(typeof raw.category === 'string' ? raw.category : '', 50) || 'ทั่วไป',
      triggerKeywords: asKeywords(raw.trigger_keywords, topic || cluster.topicKeys[0] || 'ทั่วไป'),
      knowledgeBody: fact,
      instruction,
      summaryTh: serverSummary(cluster.signals, needsMerchantFact, matched?.category || null),
      needsMerchantFact,
      revisesSkillId: matched?.id || null,
      fingerprint: cluster.fingerprint,
      topicKeys: cluster.topicKeys,
      sourceSignals: cluster.signals.map((signal) => ({
        type: signal.type,
        id: signal.id,
        label: clip(redactPii(signal.topic || signal.adminText || 'สัญญาณจากแชท'), 160),
        conversationId: signal.conversationId,
        chatMessageId: signal.chatMessageId,
      })),
      status: 'candidate',
      factsConfirmed: false,
    })
  }
  return drafts
}

export type GapRow = {
  id?: string
  shop_id?: string
  conversation_id?: string | null
  question?: string | null
  ask_count?: number | null
  reason?: string | null
  last_asked_at?: string | null
  status?: string | null
}

export function toGapSignal(row: GapRow, shopId: string): ReviewSignal | null {
  if (row.shop_id !== shopId || row.status !== 'open' || !row.id) return null
  const topic = redactPii(String(row.question || '')).trim()
  if (!topic) return null
  return {
    type: 'gap',
    id: row.id,
    shopId,
    conversationId: row.conversation_id || null,
    chatMessageId: null,
    at: row.last_asked_at || new Date(0).toISOString(),
    topic,
    adminText: null,
    askCount: Math.max(1, Number(row.ask_count) || 1),
    reason: row.reason || null,
    overrodeSuggestion: false,
  }
}

export type FeedbackRow = {
  id?: string
  shop_id?: string
  conversation_id?: string | null
  chat_message_id?: string | null
  rating?: string | null
  reason?: string | null
  corrected_response?: string | null
  created_at?: string | null
}

export function toFeedbackSignal(
  row: FeedbackRow,
  shopId: string,
  rated: { shop_id?: string; sender_type?: string | null; message?: string | null; created_at?: string | null; conversation_id?: string | null } | null,
  earlierUserText: string | null,
): ReviewSignal | null {
  if (row.shop_id !== shopId || row.rating !== 'down' || !row.id) return null
  if (rated && rated.shop_id && rated.shop_id !== shopId) return null
  const fromUser = rated?.sender_type === 'user' ? redactPii(rated.message || '').trim() : ''
  const topic = fromUser || redactPii(earlierUserText || '').trim()
  const adminText = redactPii(row.corrected_response || '').trim() || null
  if (!topic && !adminText) return null
  return {
    type: 'feedback',
    id: row.id,
    shopId,
    conversationId: row.conversation_id || rated?.conversation_id || null,
    chatMessageId: row.chat_message_id || null,
    at: row.created_at || new Date(0).toISOString(),
    topic,
    adminText,
    askCount: 1,
    reason: row.reason || null,
    overrodeSuggestion: Boolean(adminText),
  }
}

export type AdminMessageRow = {
  id?: string
  shop_id?: string
  conversation_id?: string | null
  sender_type?: string | null
  sender_name?: string | null
  message?: string | null
  created_at?: string | null
  metadata?: unknown
}

const ADMIN_SENDERS = new Set(['agent', 'human', 'admin'])

export function toAdminReplySignal(
  row: AdminMessageRow,
  shopId: string,
  earlierUser: { text: string; suggestion?: string | null } | null,
): ReviewSignal | null {
  if (row.shop_id !== shopId || !row.id || !ADMIN_SENDERS.has(String(row.sender_type || ''))) return null
  if (isBroadcastAdminMessage(row)) return null
  const adminText = redactPii(row.message || '').trim()
  const topic = redactPii(earlierUser?.text || '').trim()
  if (!adminText || !topic) return null
  const suggestion = redactPii(earlierUser?.suggestion || '').trim()
  return {
    type: 'admin_reply',
    id: row.id,
    shopId,
    conversationId: row.conversation_id || null,
    chatMessageId: row.id,
    at: row.created_at || new Date(0).toISOString(),
    topic,
    adminText,
    askCount: 1,
    reason: suggestion && suggestion !== adminText ? 'overrode_suggestion' : 'admin_reply',
    overrodeSuggestion: Boolean(suggestion && suggestion !== adminText),
  }
}

export function latestUserBefore<T extends { shopId: string; conversationId: string; createdAt: string; text: string; suggestion?: string | null }>(
  shopId: string,
  conversationId: string | null,
  before: string,
  users: T[],
): T | null {
  if (!conversationId) return null
  const prior = users
    .filter((user) => user.shopId === shopId && user.conversationId === conversationId && user.createdAt < before)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  return prior.at(-1) || null
}
