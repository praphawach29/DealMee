import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentUsage } from '@/lib/ai/salesAgentEngine'

export function getCurrentPeriod(): string {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

/** Atomically increments a shop's usage counters for the current billing period. */
export async function incrementUsage(
  shopId: string,
  usage: { totalTokens: number }
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('increment_usage', {
      p_shop_id: shopId,
      p_period: getCurrentPeriod(),
      p_messages: 1,
      p_tokens: usage.totalTokens || 0,
    })
    if (error) console.error('[incrementUsage] RPC failed:', error.message)
  } catch (err) {
    console.error('[incrementUsage] Exception:', err)
  }
}

/**
 * Atomically records which provider handled a message and how many tokens
 * it used (including Claude cache read/write split), for the admin Margin
 * Dashboard's cost estimates. Separate from incrementUsage()'s quota
 * counters — this is cost analytics, not gating.
 */
export async function incrementProviderUsage(shopId: string, usage: AgentUsage): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('increment_provider_usage', {
      p_shop_id: shopId,
      p_period: getCurrentPeriod(),
      p_provider: usage.provider,
      p_prompt_tokens: usage.promptTokens || 0,
      p_completion_tokens: usage.completionTokens || 0,
      p_cache_read_tokens: usage.cacheReadTokens || 0,
      p_cache_write_tokens: usage.cacheWriteTokens || 0,
    })
    if (error) console.error('[incrementProviderUsage] RPC failed:', error.message)
  } catch (err) {
    console.error('[incrementProviderUsage] Exception:', err)
  }
}
