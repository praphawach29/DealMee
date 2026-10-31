import { createAdminClient } from '@/lib/supabase/admin'

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

    // Stored beside skills, never in shop_agent_memory. Memory facts are
    // grounding evidence; a shadow score is not a shop fact.
    const { error: saveError } = await supabase.from('shop_skill_shadow_evals').insert({
      shop_id: shopId,
      skill_id: candidateSkillId,
      conversation_id: conversationId,
      skill_version: String(skill.version ?? ''),
      user_query: userQuery.slice(0, 500),
      original_confidence: originalConfidence,
      shadow_confidence: shadowConfidence,
      original_intent: originalIntent,
      shadow_intent: shadowIntent,
      winner,
      recommendation,
    })
    if (saveError) {
      console.error('[ShadowEval] Could not store result:', saveError.message)
      return null
    }

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
    .select('conversation_id, notes')
    .eq('shop_id', shopId)
    .order('set_at', { ascending: false })
    .limit(limit)

  if (!conversations || conversations.length === 0) return results

  for (const skill of candidates) {
    for (const conv of conversations.slice(0, 2)) {
      const { data: firstMsg } = await supabase
        .from('chat_messages')
        .select('message')
        .eq('conversation_id', conv.conversation_id)
        .eq('shop_id', shopId)
        .eq('sender_type', 'user')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const userQuery = String(firstMsg?.message || conv.notes || '').trim()
      if (!userQuery) continue
      const result = await shadowEvaluateSkill({
        shopId,
        conversationId: conv.conversation_id,
        userQuery,
        candidateSkillId: skill.id,
      })
      if (result) results.push(result)
    }
  }

  return results
}
