import { createAdminClient } from '@/lib/supabase/admin'
import { getShopAiKey } from '@/lib/billing/shopAiKey'
import { effectivePlanKey } from '@/lib/billing/trial'
import { shopCodEnabled } from '@/lib/ai/codPolicy'
import { platformSecret } from '@/lib/platformSecrets'
import { judgeWithGemini } from '@/lib/ai/replyJudge'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import type { ShopSkill } from '@/lib/ai/shopSkills'
import { skillDigest } from '@/lib/ai/shadowReport'
import { previewSkill, runShadowComparison, type ShadowJudge, type ShadowRunResult } from '@/lib/ai/shadowRun'
import { redactHistory, type ShadowHistoryTurn, type ShadowMessage } from '@/lib/ai/shadowSamples'
import { saveShadowEval } from '@/lib/ai/shadowEvalStore'

type DbMessage = {
  id: string
  shop_id: string
  conversation_id: string
  sender_type: string
  message: string
  created_at: string
}

function asSender(value: string): 'user' | 'bot' {
  return value === 'user' ? 'user' : 'bot'
}

async function loadShopReplay(shopId: string, skillId: string): Promise<{
  skill: ShopSkill
  shop: Record<string, unknown>
  messages: ShadowMessage[]
  historyFor: (sample: { conversationId: string; createdAt: string }) => Promise<ShadowHistoryTurn[]>
} | null> {
  const supabase = createAdminClient()
  const { data: skill, error: skillError } = await supabase
    .from('shop_skills')
    .select('*')
    .eq('id', skillId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (skillError || !skill || skill.shop_id !== shopId) return null
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .maybeSingle()
  if (shopError || !shop || shop.id !== shopId) return null
  const { data: rows, error: messageError } = await supabase
    .from('chat_messages')
    .select('id, shop_id, conversation_id, sender_type, message, created_at')
    .eq('shop_id', shopId)
    .eq('sender_type', 'user')
    .order('created_at', { ascending: false })
    .limit(400)
  if (messageError) throw new Error(messageError.message)
  const conversationIds = [...new Set((rows || []).map((row: DbMessage) => row.conversation_id).filter(Boolean))]
  const userByConversation = new Map<string, string>()
  if (conversationIds.length > 0) {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id, shop_id')
      .eq('shop_id', shopId)
      .in('id', conversationIds)
    for (const conversation of conversations || []) {
      if (conversation.shop_id === shopId) userByConversation.set(conversation.id, String(conversation.user_id || 'shadow-replay'))
    }
  }
  const messages: ShadowMessage[] = ((rows || []) as DbMessage[])
    .filter((row) => row.shop_id === shopId)
    .map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      conversationId: row.conversation_id,
      userId: userByConversation.get(row.conversation_id) || 'shadow-replay',
      sender: 'user' as const,
      text: row.message || '',
      createdAt: row.created_at,
    }))

  return {
    skill: skill as ShopSkill,
    shop: shop as Record<string, unknown>,
    messages,
    historyFor: async (sample) => {
      const { data: prior } = await supabase
        .from('chat_messages')
        .select('sender_type, message, created_at, shop_id, conversation_id')
        .eq('shop_id', shopId)
        .eq('conversation_id', sample.conversationId)
        .lt('created_at', sample.createdAt)
        .order('created_at', { ascending: false })
        .limit(8)
      return ((prior || []) as DbMessage[])
        .filter((row) => row.shop_id === shopId && row.conversation_id === sample.conversationId)
        .reverse()
        .map((row) => ({ sender: asSender(row.sender_type), text: row.message || '' }))
    },
  }
}

async function shopGemini(shop: Record<string, unknown>): Promise<{ apiKey: string; model: string } | null> {
  const model = String(shop.custom_ai_model || shop.ai_model || 'gemini-2.5-flash')
  if (effectivePlanKey(shop as never) === 'byok' && shop.id) {
    const own = await getShopAiKey(String(shop.id))
    if (own?.provider !== 'gemini' || !own.key) return null
    return { apiKey: own.key, model }
  }
  const apiKey = await platformSecret('GEMINI_API_KEY')
  if (!apiKey) return null
  const configured = String(shop.custom_ai_model || shop.ai_model || (await platformSecret('GEMINI_MODEL')) || 'gemini-2.5-flash')
  return { apiKey, model: configured }
}

/**
 * Replays this shop's own chats with and without the skill. Does not send
 * messages, and does not activate the skill.
 */
export async function executeShadowEval(input: {
  shopId: string
  skillId: string
  evalId: string
  confirmFacts: boolean
}): Promise<ShadowRunResult | null> {
  try {
    const loaded = await loadShopReplay(input.shopId, input.skillId)
    if (!loaded) {
      await saveShadowEval(input.shopId, input.evalId, {
        status: 'failed',
        winner: 'pending',
        recommendation: 'ไม่พบสกิลของร้านนี้ จึงยังไม่มีผลให้ตัดสิน',
        error: 'missing-skill',
      })
      return null
    }
    const features = (loaded.shop.features || {}) as Record<string, unknown>
    const skillsEnabled = features.shop_skills_enabled === true
    const confirmFacts = input.confirmFacts || loaded.skill.facts_confirmed === true
    const preview = previewSkill(loaded.skill, confirmFacts)
    const historyCache = new Map<string, ShadowHistoryTurn[]>()
    let judge: ShadowJudge | null = null
    if (process.env.SHADOW_JUDGE !== '0') {
      const gemini = await shopGemini(loaded.shop)
      if (gemini) {
        judge = async (payload) => {
          const judged = await judgeWithGemini({ ...gemini, ...payload })
          if (!judged.verdict) return null
          return { ...judged.verdict, promptTokens: judged.promptTokens, completionTokens: judged.completionTokens }
        }
      }
    }
    const result = await runShadowComparison({
      shopId: input.shopId,
      skill: loaded.skill,
      messages: loaded.messages,
      skillsEnabled,
      confirmFacts,
      judge,
      historyFor: (sample) => historyCache.get(sample.id) || [],
      replay: async (sample, arm) => {
        if (!historyCache.has(sample.id)) historyCache.set(sample.id, await loaded.historyFor(sample))
        const history = redactHistory(historyCache.get(sample.id) || [])
        const played = await processSalesAgentChat({
          shop: loaded.shop,
          userQuery: sample.redactedText,
          userId: sample.userId || 'shadow-replay',
          conversationId: sample.conversationId,
          conversationHistory: history,
          isPlayground: true,
          shadowReplay: {
            maxSteps: 2,
            omitSkillIds: [loaded.skill.id],
            extraSkills: arm === 'with' ? [preview] : [],
          },
        })
        const trace = played.shadowTrace
        return {
          finalText: played.text || '',
          draft: trace?.draft || played.text || '',
          toolCalls: (trace?.toolCalls || played.toolCallsExecuted || []).map((call) => ({ name: call.name })),
          evidenceTexts: trace?.evidenceTexts || [],
          chunks: trace?.chunks || [],
          codEnabled: shopCodEnabled(loaded.shop),
          promptTokens: played.usage?.promptTokens || 0,
          completionTokens: played.usage?.completionTokens || 0,
        }
      },
    })
    await saveShadowEval(input.shopId, input.evalId, {
      status: result.status,
      winner: result.winner,
      recommendation: result.recommendation,
      skill_version: String(loaded.skill.version ?? ''),
      sample_size: result.status === 'insufficient' && result.sampleSize === 0 ? result.found : result.sampleSize,
      improved_count: result.improved,
      regressed_count: result.regressed,
      tied_count: result.tied,
      grounded_with: result.groundedWith,
      grounded_without: result.groundedWithout,
      handoff_with: result.handoffWith,
      handoff_without: result.handoffWithout,
      judge_with: result.judgeWith,
      judge_without: result.judgeWithout,
      judge_used: result.judgeUsed,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      estimated_cost_usd: result.estimatedCostUsd,
      original_confidence: result.originalConfidence,
      shadow_confidence: result.shadowConfidence,
      skill_digest: skillDigest(loaded.skill, confirmFacts),
      metrics: result.metrics,
      error: null,
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ShadowEval] failed', message)
    await saveShadowEval(input.shopId, input.evalId, {
      status: 'failed',
      winner: 'pending',
      recommendation: 'ทดสอบไม่สำเร็จ จึงยังไม่มีผลให้ตัดสิน กดทดสอบใหม่ได้',
      error: message.slice(0, 300),
    }).catch(() => {})
    return null
  }
}
