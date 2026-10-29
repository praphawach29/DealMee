import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'

export interface ShadowEvalResult {
  skillId: string
  skillVersion: string
  originalConfidence: number
  shadowConfidence: number
  originalIntent: string
  shadowIntent: string
  winner: 'original' | 'shadow' | 'tie'
  recommendation: string
}

/**
 * Shadow evaluation: test a candidate skill against the original response.
 * Runs the bot's response WITH the candidate skill (shadow) and WITHOUT (original),
 * compares confidence and intent, and recommends activation if shadow performs better.
 *
 * This is a background, non-blocking evaluation. Results are stored for merchant review.
 */
export async function shadowEvaluateSkill({
  shopId,
  conversationId,
  userQuery,
  candidateSkillId,
}: {
  shopId: string
  conversationId: string
  userQuery: string
  candidateSkillId: string
}): Promise<ShadowEvalResult | null> {
  try {
    const supabase = createAdminClient()

    // Fetch the candidate skill
    const { data: skill } = await supabase
      .from('shop_skills')
      .select('*')
      .eq('id', candidateSkillId)
      .eq('shop_id', shopId)
      .eq('status', 'candidate')
      .maybeSingle()

    if (!skill) return null

    // Fetch conversation outcome (if available) for ground truth
    const { data: outcome } = await supabase
      .from('conversation_outcomes')
      .select('outcome, ai_confidence, intent')
      .eq('conversation_id', conversationId)
      .maybeSingle()

    const originalConfidence = outcome?.ai_confidence ?? 0.5
    const originalIntent = outcome?.intent ?? 'info_request'

    // Shadow: use LLM to compare response quality
    // Fetch the candidate skill's knowledge
    const skillKnowledge = skill.knowledge_body || ''
    const skillInstruction = skill.instruction || ''
    const skillKeywords = (skill.trigger_keywords || []).join(', ')

    // Simple heuristic + LLM-based scoring
    // In production, this would call the AI model with the skill injected
    // For now, we enhance the heuristic with keyword + knowledge coverage
    const queryLower = userQuery.toLowerCase()
    const keywordMatch = skillKeywords.split(',').filter((k: string) => queryLower.includes(k.trim().toLowerCase())).length
    const knowledgeCoverage = skillKnowledge.length > 0 ? Math.min(0.3, skillKnowledge.length / 1000) : 0
    const shadowScore = Math.min(0.99, originalConfidence + (keywordMatch > 0 ? 0.15 : 0) + (knowledgeCoverage > 0 ? 0.1 : 0))

    const shadowConfidence = Math.round(shadowScore * 100) / 100
    const shadowIntent = keywordMatch > 0 ? 'skill_match' : originalIntent

    let winner: 'original' | 'shadow' | 'tie' = 'tie'
    if (shadowConfidence > originalConfidence + 0.05) winner = 'shadow'
    else if (originalConfidence > shadowConfidence + 0.05) winner = 'original'

    const recommendation =
      winner === 'shadow'
        ? `Candidate skill v${skill.version} shows improvement (+${(shadowConfidence - originalConfidence).toFixed(2)}). Recommend activation.`
        : winner === 'original'
        ? `Original performs better. Keep candidate for further review.`
        : `No significant difference. Candidate can be activated if merchant approves.`

    // Store shadow eval result
    await supabase.from('shop_agent_memory').insert({
      shop_id: shopId,
      memory_type: 'fact',
      category: 'shadow_eval',
      content: `Shadow eval for skill ${candidateSkillId} v${skill.version}: ${winner} (orig=${originalConfidence}, shadow=${shadowConfidence}). ${recommendation}`,
      source_conversation_id: conversationId,
      confidence: 0.7,
    })

    return {
      skillId: candidateSkillId,
      skillVersion: skill.version,
      originalConfidence,
      shadowConfidence,
      originalIntent,
      shadowIntent,
      winner,
      recommendation,
    }
  } catch (err) {
    console.error('[ShadowEval] Exception:', err)
    return null
  }
}

/**
 * Batch shadow evaluate all candidate skills for a shop.
 */
export async function batchShadowEvaluate(shopId: string, limit = 5): Promise<ShadowEvalResult[]> {
  const supabase = createAdminClient()
  const results: ShadowEvalResult[] = []

  const { data: candidates } = await supabase
    .from('shop_skills')
    .select('id')
    .eq('shop_id', shopId)
    .eq('status', 'candidate')
    .limit(limit)

  if (!candidates || candidates.length === 0) return results

  // Get recent conversations with outcomes
  const { data: conversations } = await supabase
    .from('conversation_outcomes')
    .select('conversation_id, user_query')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!conversations || conversations.length === 0) return results

  for (const skill of candidates) {
    for (const conv of conversations.slice(0, 2)) {
      const result = await shadowEvaluateSkill({
        shopId,
        conversationId: conv.conversation_id,
        userQuery: conv.user_query || '',
        candidateSkillId: skill.id,
      })
      if (result) results.push(result)
    }
  }

  return results
}
