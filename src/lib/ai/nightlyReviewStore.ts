import { getShopAiKey } from '@/lib/billing/shopAiKey'
import { platformSecret } from '@/lib/platformSecrets'
import { queueSkillShadow } from '@/lib/ai/shadowSchedule'
import type { ShopSkill } from '@/lib/ai/shopSkills'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  NIGHTLY_REVIEW_LIMITS,
  bangkokDate,
  claimDecision,
  decisionEffect,
  latestUserBefore,
  reviewLookbackStart,
  shopEligible,
  toAdminReplySignal,
  toFeedbackSignal,
  toGapSignal,
  type ProposalDraft,
  type ReviewSignal,
} from '@/lib/ai/nightlyReviewPlan'
import { generateReviewJson, resolveShopGemini, reviewOneShop, type ShopReviewResult } from '@/lib/ai/nightlyReviewRun'

type AdminClient = ReturnType<typeof createAdminClient>

type ShopRow = {
  id: string
  status?: string | null
  features?: unknown
  plan?: string | null
  plan_key?: string | null
  trial_expires_at?: string | null
  plan_expires_at?: string | null
  custom_ai_model?: string | null
  ai_model?: string | null
}

function missingSchema(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === '42703' || /shop_skill_review_/i.test(error.message || '')
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  return groups
}

async function processedIds(supabase: AdminClient, shopId: string, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (const group of chunk(ids, 80)) {
    const { data, error } = await supabase
      .from('shop_skill_review_signals')
      .select('signal_id, shop_id')
      .eq('shop_id', shopId)
      .in('signal_id', group)
    if (error) {
      if (missingSchema(error)) return found
      throw new Error(error.message)
    }
    for (const row of data || []) {
      if (row.shop_id === shopId && row.signal_id) found.add(row.signal_id)
    }
  }
  return found
}

type UserTurn = {
  shopId: string
  conversationId: string
  createdAt: string
  text: string
  suggestion: string | null
}

async function userTurns(supabase: AdminClient, shopId: string, conversationIds: string[]): Promise<UserTurn[]> {
  const turns: UserTurn[] = []
  for (const group of chunk([...new Set(conversationIds.filter(Boolean))], 80)) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('shop_id, conversation_id, sender_type, message, created_at, ai_suggested_reply')
      .eq('shop_id', shopId)
      .eq('sender_type', 'user')
      .in('conversation_id', group)
      .order('created_at', { ascending: false })
      .limit(800)
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      if (row.shop_id !== shopId || row.sender_type !== 'user' || !row.conversation_id) continue
      turns.push({
        shopId,
        conversationId: row.conversation_id,
        createdAt: row.created_at,
        text: row.message || '',
        suggestion: row.ai_suggested_reply || null,
      })
    }
  }
  return turns
}

async function mockConversationIds(supabase: AdminClient, shopId: string, conversationIds: string[]): Promise<Set<string>> {
  const mock = new Set<string>()
  const ids = [...new Set(conversationIds.filter(Boolean))]
  if (ids.length === 0) return mock
  for (const group of chunk(ids, 80)) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, shop_id, metadata')
      .eq('shop_id', shopId)
      .in('id', group)
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      const meta = row.metadata
      if (row.shop_id === shopId && meta && typeof meta === 'object' && (meta as { mock?: unknown }).mock === true) {
        mock.add(row.id)
      }
    }
  }
  return mock
}

export async function loadShopReviewSignals(supabase: AdminClient, shopId: string, sinceIso: string): Promise<ReviewSignal[]> {
  const cap = NIGHTLY_REVIEW_LIMITS.maxSignals
  const [gaps, feedback, admins] = await Promise.all([
    supabase
      .from('knowledge_gaps')
      .select('id, shop_id, conversation_id, question, ask_count, reason, last_asked_at, status')
      .eq('shop_id', shopId)
      .eq('status', 'open')
      .gte('last_asked_at', sinceIso)
      .order('last_asked_at', { ascending: false })
      .limit(cap),
    supabase
      .from('chat_message_feedback')
      .select('id, shop_id, conversation_id, chat_message_id, rating, reason, corrected_response, created_at')
      .eq('shop_id', shopId)
      .eq('rating', 'down')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(cap),
    supabase
      .from('chat_messages')
      .select('id, shop_id, conversation_id, sender_type, sender_name, message, created_at, metadata')
      .eq('shop_id', shopId)
      .in('sender_type', ['agent', 'human', 'admin'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(cap),
  ])
  for (const result of [gaps, feedback, admins]) {
    if (result.error && !missingSchema(result.error)) throw new Error(result.error.message)
  }
  const gapRows = gaps.error ? [] : gaps.data || []
  const feedbackRows = feedback.error ? [] : feedback.data || []
  const adminRows = admins.error ? [] : admins.data || []

  const conversationIds = [
    ...gapRows.map((row) => row.conversation_id),
    ...feedbackRows.map((row) => row.conversation_id),
    ...adminRows.map((row) => row.conversation_id),
  ].filter((id): id is string => Boolean(id))
  const mockIds = await mockConversationIds(supabase, shopId, conversationIds)
  const ratedIds = [...new Set(feedbackRows.map((row) => row.chat_message_id).filter((id): id is string => Boolean(id)))]
  const ratedById = new Map<string, { shop_id?: string; sender_type?: string | null; message?: string | null; created_at?: string | null; conversation_id?: string | null }>()
  for (const group of chunk(ratedIds, 80)) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, shop_id, sender_type, message, created_at, conversation_id')
      .eq('shop_id', shopId)
      .in('id', group)
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      if (row.shop_id === shopId) ratedById.set(row.id, row)
    }
  }
  const turns = await userTurns(supabase, shopId, conversationIds.filter((id) => !mockIds.has(id)))
  const signals: ReviewSignal[] = []
  for (const row of gapRows) {
    if (row.conversation_id && mockIds.has(row.conversation_id)) continue
    const signal = toGapSignal(row, shopId)
    if (signal) signals.push(signal)
  }
  for (const row of feedbackRows) {
    if (row.conversation_id && mockIds.has(row.conversation_id)) continue
    const rated = row.chat_message_id ? ratedById.get(row.chat_message_id) || null : null
    const prior = rated?.sender_type === 'bot'
      ? latestUserBefore(shopId, rated.conversation_id || row.conversation_id || null, rated.created_at || row.created_at || '', turns)
      : null
    const signal = toFeedbackSignal(row, shopId, rated, prior?.text || null)
    if (signal) signals.push(signal)
  }
  for (const row of adminRows) {
    if (row.conversation_id && mockIds.has(row.conversation_id)) continue
    const prior = latestUserBefore(shopId, row.conversation_id, row.created_at, turns)
    const signal = toAdminReplySignal(row, shopId, prior ? { text: prior.text, suggestion: prior.suggestion } : null)
    if (signal) signals.push(signal)
  }
  const seen = await processedIds(supabase, shopId, signals.map((signal) => signal.id))
  return signals
    .filter((signal) => signal.shopId === shopId && !seen.has(signal.id))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, cap)
}

async function loadSkills(supabase: AdminClient, shopId: string) {
  const { data, error } = await supabase
    .from('shop_skills')
    .select('id, shop_id, status, skill_type, category, trigger_keywords, knowledge_body, facts_confirmed')
    .eq('shop_id', shopId)
    .in('status', ['candidate', 'active'])
    .limit(100)
  if (error) throw new Error(error.message)
  return (data || [])
    .filter((row) => row.shop_id === shopId)
    .map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      status: row.status,
      skill_type: row.skill_type,
      category: row.category,
      trigger_keywords: row.trigger_keywords || [],
      knowledge_body: row.knowledge_body,
      facts_confirmed: row.facts_confirmed === true,
    }))
}

async function loadBlocks(supabase: AdminClient, shopId: string) {
  const [rejections, pending] = await Promise.all([
    supabase.from('shop_skill_review_rejections').select('fingerprint, topic_keys, shop_id').eq('shop_id', shopId),
    supabase.from('shop_skill_review_proposals').select('fingerprint, shop_id, status').eq('shop_id', shopId).in('status', ['pending', 'accepted']),
  ])
  if (rejections.error) throw new Error(rejections.error.message)
  if (pending.error) throw new Error(pending.error.message)
  return {
    rejections: (rejections.data || [])
      .filter((row) => row.shop_id === shopId)
      .map((row) => ({ fingerprint: row.fingerprint, topicKeys: row.topic_keys || [] })),
    pendingFingerprints: (pending.data || [])
      .filter((row) => row.shop_id === shopId)
      .map((row) => row.fingerprint),
  }
}

async function persistProposal(supabase: AdminClient, shopId: string, runId: string | null, draft: ProposalDraft): Promise<void> {
  const { data: skill, error } = await supabase
    .from('shop_skills')
    .insert({
      shop_id: shopId,
      skill_type: draft.skillType,
      category: draft.category,
      version: '0.1.0',
      status: 'candidate',
      trigger_keywords: draft.triggerKeywords,
      knowledge_body: draft.knowledgeBody,
      instruction: draft.instruction,
      gold_conversations: [],
      facts_confirmed: false,
      created_by: null,
    })
    .select('*')
    .single()
  if (error || !skill || skill.shop_id !== shopId) throw new Error(error?.message || 'skill insert failed')
  const { error: proposalError } = await supabase.from('shop_skill_review_proposals').insert({
    shop_id: shopId,
    review_run_id: runId,
    skill_id: skill.id,
    revises_skill_id: draft.revisesSkillId,
    status: 'pending',
    summary_th: draft.summaryTh,
    needs_merchant_fact: draft.needsMerchantFact,
    fingerprint: draft.fingerprint,
    topic_keys: draft.topicKeys,
    source_signals: draft.sourceSignals,
  })
  if (proposalError) {
    if (proposalError.code === '23505') {
      await supabase.from('shop_skills').delete().eq('id', skill.id).eq('shop_id', shopId).eq('status', 'candidate')
      return
    }
    throw new Error(proposalError.message)
  }
  await linkSources(supabase, shopId, skill.id, draft)
  await queueSkillShadow(skill as ShopSkill, false).catch((err) => {
    console.error('[SkillReview] shadow queue failed', err instanceof Error ? err.message : err)
  })
}

async function linkSources(supabase: AdminClient, shopId: string, skillId: string, draft: ProposalDraft): Promise<void> {
  const seen = new Set<string>()
  const rows: { skill_id: string; shop_id: string; conversation_id?: string; chat_message_id?: string; weight: number }[] = []
  for (const signal of draft.sourceSignals) {
    if (!signal.conversationId && !signal.chatMessageId) continue
    const key = `${signal.conversationId || ''}:${signal.chatMessageId || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      skill_id: skillId,
      shop_id: shopId,
      ...(signal.conversationId ? { conversation_id: signal.conversationId } : {}),
      ...(signal.chatMessageId ? { chat_message_id: signal.chatMessageId } : {}),
      weight: 1,
    })
  }
  if (rows.length === 0) return
  const { error } = await supabase.from('shop_skill_sources').insert(rows)
  if (error) console.error('[SkillReview] source link failed', error.message)
}

async function markProcessed(supabase: AdminClient, shopId: string, runId: string | null, signals: ReviewSignal[]): Promise<void> {
  const rows = signals
    .filter((signal) => signal.shopId === shopId)
    .map((signal) => ({
      shop_id: shopId,
      review_run_id: runId,
      signal_type: signal.type,
      signal_id: signal.id,
    }))
  if (rows.length === 0) return
  const { error } = await supabase.from('shop_skill_review_signals').upsert(rows, {
    onConflict: 'shop_id,signal_type,signal_id',
    ignoreDuplicates: true,
  })
  if (error) throw new Error(error.message)
}

type RunRow = { id: string; shop_id: string; status: string; started_at: string }

async function runsForDate(supabase: AdminClient, date: string): Promise<RunRow[] | null> {
  const { data, error } = await supabase
    .from('shop_skill_review_runs')
    .select('id, shop_id, status, started_at')
    .eq('review_date', date)
  if (error) {
    if (missingSchema(error)) return null
    throw new Error(error.message)
  }
  return (data || []) as RunRow[]
}

function runIsClosed(run: RunRow, now: number): boolean {
  return claimDecision({ status: run.status, startedAt: run.started_at }, now) === 'skip'
}

async function listOpenShops(supabase: AdminClient, date: string, now: number): Promise<ShopRow[] | null> {
  const [shops, runs] = await Promise.all([
    supabase.from('shops').select('id, status, features, plan, plan_key, trial_expires_at, plan_expires_at, custom_ai_model, ai_model').order('id', { ascending: true }).limit(500),
    runsForDate(supabase, date),
  ])
  if (shops.error) throw new Error(shops.error.message)
  if (runs === null) return null
  const closed = new Set(runs.filter((run) => runIsClosed(run, now)).map((run) => run.shop_id))
  return ((shops.data || []) as ShopRow[]).filter((shop) => shopEligible(shop) && !closed.has(shop.id))
}

async function claimShop(supabase: AdminClient, shopId: string, date: string, now: number): Promise<{ claimed: boolean; runId: string | null }> {
  const { data: existing, error } = await supabase
    .from('shop_skill_review_runs')
    .select('id, shop_id, status, started_at')
    .eq('shop_id', shopId)
    .eq('review_date', date)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing && existing.shop_id !== shopId) return { claimed: false, runId: null }
  const decision = claimDecision(existing ? { status: existing.status, startedAt: existing.started_at } : null, now)
  if (decision === 'skip') return { claimed: false, runId: null }
  const stamp = new Date(now).toISOString()
  if (decision === 'insert') {
    const { data, error: insertError } = await supabase
      .from('shop_skill_review_runs')
      .insert({ shop_id: shopId, review_date: date, status: 'running', started_at: stamp })
      .select('id')
      .single()
    if (insertError?.code === '23505') return { claimed: false, runId: null }
    if (insertError || !data?.id) throw new Error(insertError?.message || 'claim failed')
    return { claimed: true, runId: data.id }
  }
  const { data, error: updateError } = await supabase
    .from('shop_skill_review_runs')
    .update({ status: 'running', started_at: stamp, finished_at: null, skip_reason: null })
    .eq('id', existing!.id)
    .eq('shop_id', shopId)
    .select('id')
    .single()
  if (updateError || !data?.id) throw new Error(updateError?.message || 'claim failed')
  return { claimed: true, runId: data.id }
}

async function finishRun(supabase: AdminClient, shopId: string, date: string, result: ShopReviewResult): Promise<void> {
  const { error } = await supabase
    .from('shop_skill_review_runs')
    .update({
      status: result.status,
      skip_reason: result.reason,
      signals_seen: result.signalsSeen,
      proposals_created: result.proposalsCreated,
      finished_at: new Date().toISOString(),
    })
    .eq('shop_id', shopId)
    .eq('review_date', date)
  if (error) console.error('[SkillReview] finish failed', error.message)
}

export type NightlyBatchResult = {
  ready: boolean
  reviewDate: string
  reviewed: number
  remaining: boolean
  shops: { shopId: string; status: string; reason: string | null; proposalsCreated: number; modelCalled: boolean }[]
}

export async function runNightlySkillReviewBatch(options?: { now?: Date }): Promise<NightlyBatchResult> {
  const now = options?.now ?? new Date()
  const date = bangkokDate(now)
  const supabase = createAdminClient()
  const open = await listOpenShops(supabase, date, now.getTime())
  if (open === null) {
    return { ready: false, reviewDate: date, reviewed: 0, remaining: false, shops: [] }
  }
  const started = Date.now()
  const shops: NightlyBatchResult['shops'] = []
  let reviewed = 0
  let modelCalls = 0
  for (const shop of open) {
    if (reviewed >= NIGHTLY_REVIEW_LIMITS.maxShopsPerRun) break
    if (modelCalls >= NIGHTLY_REVIEW_LIMITS.maxModelShops) break
    if (Date.now() - started >= NIGHTLY_REVIEW_LIMITS.budgetMs) break
    const claim = await claimShop(supabase, shop.id, date, Date.now())
    if (!claim.claimed) continue
    let result: ShopReviewResult
    try {
      result = await reviewOneShop(shop.id, {
        loadSignals: (shopId) => loadShopReviewSignals(supabase, shopId, reviewLookbackStart(now)),
        loadSkills: (shopId) => loadSkills(supabase, shopId),
        loadBlocks: (shopId) => loadBlocks(supabase, shopId),
        resolveGemini: () => resolveShopGemini(shop, {
          platformSecret: (name) => platformSecret(name),
          getShopAiKey: (shopId) => getShopAiKey(shopId),
        }),
        complete: (prompt, gemini) => generateReviewJson(gemini, prompt),
        insertProposal: (shopId, draft) => persistProposal(supabase, shopId, claim.runId, draft),
        markProcessed: (shopId, signals) => markProcessed(supabase, shopId, claim.runId, signals),
      })
    } catch (err) {
      console.error('[SkillReview] shop failed', shop.id, err instanceof Error ? err.message : err)
      result = { status: 'failed', reason: 'exception', signalsSeen: 0, proposalsCreated: 0, modelCalled: false }
    }
    await finishRun(supabase, shop.id, date, result)
    shops.push({
      shopId: shop.id,
      status: result.status,
      reason: result.reason,
      proposalsCreated: result.proposalsCreated,
      modelCalled: result.modelCalled,
    })
    reviewed += 1
    if (result.modelCalled) modelCalls += 1
  }
  const stillOpen = await listOpenShops(supabase, date, Date.now())
  return {
    ready: true,
    reviewDate: date,
    reviewed,
    remaining: (stillOpen || []).length > 0,
    shops,
  }
}

export async function listPendingProposals(supabase: AdminClient, shopId: string) {
  const { data, error } = await supabase
    .from('shop_skill_review_proposals')
    .select('id, shop_id, skill_id, revises_skill_id, status, summary_th, needs_merchant_fact, source_signals, created_at')
    .eq('shop_id', shopId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    if (missingSchema(error)) return { ready: false as const, proposals: [] }
    throw new Error(error.message)
  }
  const rows = (data || []).filter((row) => row.shop_id === shopId)
  const skillIds = [...new Set(rows.flatMap((row) => [row.skill_id, row.revises_skill_id].filter(Boolean)))] as string[]
  const skills = new Map<string, { id: string; category: string; skill_type: string; knowledge_body: string | null; instruction: string | null; trigger_keywords: string[]; status: string; facts_confirmed: boolean | null }>()
  if (skillIds.length > 0) {
    const { data: skillRows, error: skillError } = await supabase
      .from('shop_skills')
      .select('id, shop_id, category, skill_type, knowledge_body, instruction, trigger_keywords, status, facts_confirmed')
      .eq('shop_id', shopId)
      .in('id', skillIds)
    if (skillError) throw new Error(skillError.message)
    for (const skill of skillRows || []) {
      if (skill.shop_id === shopId) skills.set(skill.id, skill)
    }
  }
  return {
    ready: true as const,
    proposals: rows.map((row) => {
      const skill = skills.get(row.skill_id) || null
      const revises = row.revises_skill_id ? skills.get(row.revises_skill_id) : null
      return {
        id: row.id,
        skill_id: row.skill_id,
        revises_skill_id: row.revises_skill_id,
        summary_th: row.summary_th,
        needs_merchant_fact: row.needs_merchant_fact === true,
        source_signals: Array.isArray(row.source_signals) ? row.source_signals : [],
        created_at: row.created_at,
        revises_category: revises?.category || null,
        skill,
      }
    }),
  }
}

export async function decideProposal(
  supabase: AdminClient,
  shopId: string,
  proposalId: string,
  decision: 'accept' | 'reject',
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: proposal, error } = await supabase
    .from('shop_skill_review_proposals')
    .select('id, shop_id, skill_id, status, fingerprint, topic_keys')
    .eq('id', proposalId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (error) {
    if (missingSchema(error)) return { ok: false, status: 503, error: 'ยังไม่ได้ติดตั้งตารางรีวิว กรุณารันสคริปต์ฐานข้อมูลก่อน' }
    return { ok: false, status: 500, error: 'บันทึกไม่สำเร็จ' }
  }
  if (!proposal || proposal.shop_id !== shopId) return { ok: false, status: 404, error: 'ไม่พบข้อเสนอนี้' }
  if (proposal.status !== 'pending') return { ok: false, status: 409, error: 'ข้อเสนอนี้ถูกตัดสินแล้ว' }
  const effect = decisionEffect(decision)
  const now = new Date().toISOString()
  if (effect.recordRejection) {
    const { error: rejectError } = await supabase.from('shop_skill_review_rejections').upsert({
      shop_id: shopId,
      fingerprint: proposal.fingerprint,
      topic_keys: proposal.topic_keys || [],
    }, { onConflict: 'shop_id,fingerprint', ignoreDuplicates: true })
    if (rejectError) return { ok: false, status: 500, error: 'บันทึกไม่สำเร็จ' }
  }
  if (effect.archiveCandidate) {
    const { error: archiveError } = await supabase
      .from('shop_skills')
      .update({ status: 'archived', updated_at: now })
      .eq('id', proposal.skill_id)
      .eq('shop_id', shopId)
      .eq('status', 'candidate')
    if (archiveError) return { ok: false, status: 500, error: 'เก็บฉบับร่างไม่สำเร็จ' }
  }
  const { error: updateError } = await supabase
    .from('shop_skill_review_proposals')
    .update({ status: effect.proposalStatus, decided_at: now })
    .eq('id', proposal.id)
    .eq('shop_id', shopId)
    .eq('status', 'pending')
  if (updateError) return { ok: false, status: 500, error: 'บันทึกไม่สำเร็จ' }
  return { ok: true }
}
