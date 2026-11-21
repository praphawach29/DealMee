import { effectivePlanKey } from '@/lib/billing/trial'
import {
  buildProposalDrafts,
  buildReviewPrompt,
  parseReviewModelOutput,
  selectReviewClusters,
  type ProposalDraft,
  type Rejection,
  type ReviewSignal,
  type SkillBrief,
} from '@/lib/ai/nightlyReviewPlan'

export type ShopReviewResult = {
  status: 'completed' | 'skipped' | 'failed'
  reason: string | null
  signalsSeen: number
  proposalsCreated: number
  modelCalled: boolean
}

export type NightlyReviewPort = {
  loadSignals: (shopId: string) => Promise<ReviewSignal[]>
  loadSkills: (shopId: string) => Promise<SkillBrief[]>
  loadBlocks: (shopId: string) => Promise<{ rejections: Rejection[]; pendingFingerprints: string[] }>
  resolveGemini: (shopId: string) => Promise<{ apiKey: string; model: string } | null>
  complete: (prompt: string, gemini: { apiKey: string; model: string }) => Promise<string>
  insertProposal: (shopId: string, draft: ProposalDraft) => Promise<void>
  markProcessed: (shopId: string, signals: ReviewSignal[]) => Promise<void>
}

type ShopKeyFields = {
  id: string
  plan?: string | null
  plan_key?: string | null
  trial_expires_at?: string | null
  plan_expires_at?: string | null
  custom_ai_model?: string | null
  ai_model?: string | null
}

/**
 * BYOK shops use only their own Gemini key. Everyone else uses the platform
 * key from Super Admin. A missing key skips the shop before any model call.
 */
export async function resolveShopGemini(
  shop: ShopKeyFields,
  deps: {
    platformSecret: (name: 'GEMINI_API_KEY' | 'GEMINI_MODEL') => Promise<string | null>
    getShopAiKey: (shopId: string) => Promise<{ provider: string; key: string } | null>
  },
): Promise<{ apiKey: string; model: string } | null> {
  const model = String(shop.custom_ai_model || shop.ai_model || '').trim()
  if (effectivePlanKey(shop) === 'byok') {
    const own = await deps.getShopAiKey(shop.id)
    if (own?.provider !== 'gemini' || !own.key) return null
    return { apiKey: own.key, model: model || 'gemini-2.5-flash' }
  }
  const apiKey = await deps.platformSecret('GEMINI_API_KEY')
  if (!apiKey) return null
  const configured = model || (await deps.platformSecret('GEMINI_MODEL')) || 'gemini-2.5-flash'
  return { apiKey, model: configured }
}

export async function generateReviewJson(
  gemini: { apiKey: string; model: string },
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gemini.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    },
  )
  if (!response.ok) {
    throw new Error(`gemini ${response.status}`)
  }
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const raw = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('')
  if (!raw.trim()) throw new Error('empty model output')
  return raw
}

function uniqueSignals(signals: ReviewSignal[]): ReviewSignal[] {
  const seen = new Set<string>()
  const rows: ReviewSignal[] = []
  for (const signal of signals) {
    const key = `${signal.type}:${signal.id}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(signal)
  }
  return rows
}

/**
 * Reviews one shop. No signals means no model call and no draft.
 * A failed model call leaves the signals unmarked so a later night can retry.
 */
export async function reviewOneShop(shopId: string, port: NightlyReviewPort): Promise<ShopReviewResult> {
  const signals = (await port.loadSignals(shopId)).filter((signal) => signal.shopId === shopId)
  const signalsSeen = signals.length
  if (signalsSeen === 0) {
    return { status: 'skipped', reason: 'no_signals', signalsSeen, proposalsCreated: 0, modelCalled: false }
  }
  const blocks = await port.loadBlocks(shopId)
  const skills = (await port.loadSkills(shopId)).filter((skill) => skill.shopId === shopId)
  const { promptClusters, blockedSignals } = selectReviewClusters(signals, blocks.rejections, blocks.pendingFingerprints)
  if (promptClusters.length === 0) {
    if (blockedSignals.length > 0) await port.markProcessed(shopId, uniqueSignals(blockedSignals))
    return {
      status: 'skipped',
      reason: blockedSignals.length > 0 ? 'already_decided' : 'no_recurring',
      signalsSeen,
      proposalsCreated: 0,
      modelCalled: false,
    }
  }
  const gemini = await port.resolveGemini(shopId)
  if (!gemini) {
    return { status: 'skipped', reason: 'no_gemini_key', signalsSeen, proposalsCreated: 0, modelCalled: false }
  }
  const prompt = buildReviewPrompt(shopId, promptClusters, skills)
  let raw: string
  try {
    raw = await port.complete(prompt, gemini)
  } catch {
    return { status: 'failed', reason: 'model_error', signalsSeen, proposalsCreated: 0, modelCalled: true }
  }
  const parsed = parseReviewModelOutput(raw)
  if (!parsed.ok) {
    return { status: 'failed', reason: 'model_output', signalsSeen, proposalsCreated: 0, modelCalled: true }
  }
  const drafts = buildProposalDrafts({
    shopId,
    clusters: promptClusters,
    skills,
    modelProposals: parsed.proposals,
    rejections: blocks.rejections,
    pendingFingerprints: blocks.pendingFingerprints,
  })
  let proposalsCreated = 0
  const createdSignals: ReviewSignal[] = []
  for (const draft of drafts) {
    const cluster = promptClusters.find((item) => item.id === draft.clusterId)
    await port.insertProposal(shopId, draft)
    proposalsCreated += 1
    if (cluster) createdSignals.push(...cluster.signals)
  }
  await port.markProcessed(shopId, uniqueSignals([
    ...blockedSignals,
    ...promptClusters.flatMap((cluster) => cluster.signals),
    ...createdSignals,
  ]))
  return { status: 'completed', reason: null, signalsSeen, proposalsCreated, modelCalled: true }
}
