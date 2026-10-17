import { createAdminClient } from '@/lib/supabase/admin'

export interface CompetitorQuotaInfo {
  total: number
  used: number
  remaining: number
  planName: string
  period: string
}

export const COMPETITOR_PLAN_LIMITS: Record<string, number> = {
  free: 3,
  starter: 10,
  pro: 50,
  agency: 200,
  enterprise: 200,
}

function getCurrentPeriod(): string {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

/**
 * Retrieves the current month's competitor scan quota and usage for a shop.
 * Plan Limits:
 * - Free: 3 scans/month
 * - Starter: 10 scans/month
 * - Pro: 50 scans/month
 * - Agency: 200 scans/month
 */
export async function getCompetitorQuota(shopId: string): Promise<CompetitorQuotaInfo> {
  const supabase = createAdminClient()
  const period = getCurrentPeriod()

  if (!shopId) {
    return {
      total: 3,
      used: 0,
      remaining: 3,
      planName: 'FREE',
      period,
    }
  }

  // 1. Fetch shop plan
  const { data: shop } = await supabase
    .from('shops')
    .select('plan, plan_key')
    .eq('id', shopId)
    .maybeSingle()

  const rawPlan = (shop?.plan_key || shop?.plan || 'free').toLowerCase()
  const total = COMPETITOR_PLAN_LIMITS[rawPlan] ?? 3

  // 2. Fetch recorded scans for the current period from settings
  const settingKey = `competitor_scans_${shopId}_${period}`
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', settingKey)
    .maybeSingle()

  let used = 0

  if (setting && setting.value !== undefined && setting.value !== null) {
    used = parseInt(setting.value, 10) || 0
  } else {
    // Fallback: Count scans from competitors table updated this month
    const startOfMonth = `${period}-01T00:00:00.000Z`
    const { count } = await supabase
      .from('competitors')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gte('last_scanned_at', startOfMonth)

    used = count || 0
  }

  const remaining = Math.max(0, total - used)

  return {
    total,
    used,
    remaining,
    planName: rawPlan.toUpperCase(),
    period,
  }
}

/**
 * Checks whether the shop has remaining scan quota.
 */
export async function canScanCompetitor(shopId: string): Promise<{ allowed: boolean; quota: CompetitorQuotaInfo }> {
  const quota = await getCompetitorQuota(shopId)
  return {
    allowed: quota.remaining > 0,
    quota,
  }
}

/**
 * Atomically increments the shop's competitor scan count for the current period.
 * Returns true if successful and within quota, false if quota was already exceeded.
 */
export async function incrementCompetitorQuota(shopId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const quota = await getCompetitorQuota(shopId)

  if (quota.used >= quota.total) {
    return false
  }

  const newUsed = quota.used + 1
  const settingKey = `competitor_scans_${shopId}_${quota.period}`

  const { error } = await supabase
    .from('settings')
    .upsert(
      {
        key: settingKey,
        value: String(newUsed),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('[incrementCompetitorQuota] Error updating quota setting:', error)
    return false
  }

  return true
}
