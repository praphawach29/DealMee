import { SupabaseClient } from '@supabase/supabase-js'

export interface PushQuotaInfo {
  totalQuota: number
  usedCount: number
  remainingCount: number
  period: string
  planName: string
}

/**
 * Calculates current month's LINE Push message quota, used count, and remaining quota for a shop.
 * Free LINE Official Account = 300 free pushes/month (PRO plan = 1,000 pushes/month).
 */
export async function getLinePushQuotaInfo(
  supabase: SupabaseClient,
  shopId: string,
  plan = 'pro'
): Promise<PushQuotaInfo> {
  const now = new Date()
  const currentPeriod = now.toISOString().slice(0, 7) // 'YYYY-MM'
  const startOfMonth = `${currentPeriod}-01T00:00:00.000Z`

  // Plan quotas: Free = 300, Pro = 1000
  const totalQuota = plan.toLowerCase() === 'pro' ? 1000 : 300

  if (!shopId) {
    return {
      totalQuota,
      usedCount: 0,
      remainingCount: totalQuota,
      period: currentPeriod,
      planName: plan.toUpperCase(),
    }
  }

  // Fetch broadcasts sent in current month
  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('*') // recipient_count only exists once the broadcast columns migration has run
    .eq('shop_id', shopId)
    .gte('created_at', startOfMonth)

  // recipient_count arrives with the broadcast columns migration; until then success + failed is the same number
  const usedCount = (broadcasts || []).reduce(
    (sum, b: any) => sum + Number(b.recipient_count ?? Number(b.success_count || 0) + Number(b.failed_count || 0)),
    0
  )
  const remainingCount = Math.max(0, totalQuota - usedCount)

  return {
    totalQuota,
    usedCount,
    remainingCount,
    period: currentPeriod,
    planName: plan.toUpperCase(),
  }
}
