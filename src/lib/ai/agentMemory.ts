import { createAdminClient } from '@/lib/supabase/admin'

export type AgentMemoryType = 'procedure' | 'preference' | 'pitfall' | 'fact'

export interface AgentMemory {
  id: string
  shop_id: string
  memory_type: AgentMemoryType
  category: string
  content: string
  confidence: number
  usage_count: number
  last_used_at: string | null
  created_at: string
}

/**
 * Shadow-eval notes used to be stored here as type "fact". They are not shop
 * knowledge and must not enter the prompt or the grounding evidence.
 */
export function isShadowEvalMemory(memory: { category?: string | null; content?: string | null }): boolean {
  const category = (memory.category || '').trim().toLowerCase()
  if (category === 'shadow_eval' || category === 'shadow-eval') return true
  return /^shadow eval\b/i.test((memory.content || '').trim())
}

/**
 * Merchant-entered facts may support a shop claim. Procedures, preferences,
 * pitfalls, and anything the bot wrote itself may not.
 */
export function isGroundingMemory(memory: Pick<AgentMemory, 'memory_type' | 'category' | 'content'>): boolean {
  return memory.memory_type === 'fact' && !isShadowEvalMemory(memory)
}

/**
 * Retrieve relevant agent memories for a shop.
 * Used to inject procedural knowledge into the system prompt.
 */
export async function retrieveAgentMemories(
  shopId: string,
  query: string,
  limit = 5
): Promise<AgentMemory[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('shop_agent_memory')
      .select('*')
      .eq('shop_id', shopId)
      .order('usage_count', { ascending: false })
      .limit(50)

    if (error || !data) return []

    // Simple keyword matching (same approach as shopSkills rankShopSkills)
    const normalized = query.toLocaleLowerCase('th-TH')
    const scored = (data as AgentMemory[])
      .filter((m) => !isShadowEvalMemory(m))
      .map((m) => ({
      memory: m,
      score:
        (normalized.includes(m.category.toLocaleLowerCase('th-TH')) ? 2 : 0) +
        (m.content.toLocaleLowerCase('th-TH').split(/\s+/).filter((w) => normalized.includes(w)).length),
    }))

    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ memory }) => memory)
  } catch {
    return []
  }
}

/**
 * Format agent memories for prompt injection.
 */
export function formatAgentMemoryContext(memories: AgentMemory[], maxLength = 2000): string {
  const visible = memories.filter((memory) => !isShadowEvalMemory(memory))
  if (visible.length === 0) return ''
  const blocks = visible.map((m) => {
    const typeLabel = m.memory_type === 'procedure' ? '📋 ขั้นตอน' :
                      m.memory_type === 'preference' ? '⭐ ความชอบ' :
                      m.memory_type === 'pitfall' ? '⚠️ ข้อควรระวัง' : '📌 ข้อเท็จจริง'
    return `${typeLabel}: ${m.content}`
  })
  return [
    '## AGENT MEMORY (ความรู้ที่บอทเรียนรู้เอง)',
    ...blocks,
  ].join('\n').slice(0, maxLength)
}

/** Only merchant-entered facts. This is the slice grounding is allowed to quote. */
export function formatGroundingMemory(memories: AgentMemory[], maxLength = 2000): string {
  return formatAgentMemoryContext(memories.filter(isGroundingMemory), maxLength)
}

/**
 * Save a new agent memory (procedure, preference, pitfall, or fact).
 */
export async function saveAgentMemory({
  shopId,
  memoryType,
  category,
  content,
  sourceConversationId,
  confidence = 0.8,
}: {
  shopId: string
  memoryType: AgentMemoryType
  category: string
  content: string
  sourceConversationId?: string | null
  confidence?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('shop_agent_memory')
      .insert({
        shop_id: shopId,
        memory_type: memoryType,
        category,
        content: content.slice(0, 2000),
        source_conversation_id: sourceConversationId || null,
        confidence,
      })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, id: data.id }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Increment usage count for a memory (called when it's injected into a prompt).
 */
export async function markMemoryUsed(memoryId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.rpc('increment_memory_usage', { p_memory_id: memoryId })
  } catch {
    // Fallback: direct update
    try {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('shop_agent_memory')
        .select('usage_count')
        .eq('id', memoryId)
        .single()
      if (data) {
        await supabase
          .from('shop_agent_memory')
          .update({ usage_count: (data.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
          .eq('id', memoryId)
      }
    } catch {
      // Non-critical
    }
  }
}

/**
 * Log tool usage for analytics.
 */
export async function logToolUsage({
  shopId,
  conversationId,
  toolName,
  argsSummary,
  success,
  errorMessage,
  durationMs,
}: {
  shopId: string
  conversationId?: string | null
  toolName: string
  argsSummary?: string
  success: boolean
  errorMessage?: string
  durationMs?: number
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('tool_usage_log').insert({
      shop_id: shopId,
      conversation_id: conversationId || null,
      tool_name: toolName,
      args_summary: argsSummary?.slice(0, 500) || null,
      success,
      error_message: errorMessage?.slice(0, 500) || null,
      duration_ms: durationMs || null,
    })
  } catch {
    // Non-critical
  }
}

/**
 * Get tool usage stats for a shop.
 */
export async function getToolUsageStats(shopId: string): Promise<any[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tool_usage_stats')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_calls', { ascending: false })

    if (error) return []
    return data || []
  } catch {
    return []
  }
}
