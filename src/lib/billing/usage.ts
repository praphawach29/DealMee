import { createAdminClient } from '@/lib/supabase/admin'

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
