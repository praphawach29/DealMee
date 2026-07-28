'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPeriod } from '@/lib/billing/usage'
import { estimateCostUsd, THB_PER_USD, type AiProviderName } from '@/lib/billing/aiPricing'
import { verifySuperAdmin } from '../actions'

export interface PlanMarginRow {
  planKey: string
  planName: string
  price: number
  shopCount: number
  messages: number
  costThb: number
  revenueThb: number
  marginThb: number
  marginPct: number
}

export interface ShopMarginRow {
  shopId: string
  shopName: string
  planKey: string
  messages: number
  costThb: number
  revenueThb: number
  marginThb: number
}

export interface MarginReport {
  period: string
  plans: PlanMarginRow[]
  shops: ShopMarginRow[]
  totals: { messages: number; costThb: number; revenueThb: number; marginThb: number; marginPct: number }
}

/**
 * Estimated cost vs. revenue per plan and per shop, for the current billing
 * period. Uses the service-role client (bypassing RLS entirely) to read
 * across all shops — gated at the application layer by verifySuperAdmin(),
 * same pattern as every other cross-shop query in /admin.
 *
 * No historical backfill is possible: ai_provider_usage only exists from
 * the day this feature shipped, so past periods will show as empty.
 */
export async function getMarginReport(period?: string): Promise<MarginReport | { error: string }> {
  const { isSuperAdmin } = await verifySuperAdmin()
  if (!isSuperAdmin) {
    return { error: 'คุณไม่มีสิทธิ์ผู้ดูแลระบบ Super Admin' }
  }

  const targetPeriod = period || getCurrentPeriod()
  const admin = createAdminClient()

  const [{ data: shops }, { data: plans }, { data: usageRows }] = await Promise.all([
    admin.from('shops').select('id, name, plan_key, plan'),
    admin.from('plans').select('key, name, price'),
    admin
      .from('ai_provider_usage')
      .select('shop_id, provider, message_count, prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens')
      .eq('period', targetPeriod),
  ])

  const planByKey = new Map((plans || []).map((p: any) => [p.key, p]))

  // shop_id -> { messages, costUsd }
  const shopUsage = new Map<string, { messages: number; costUsd: number }>()
  for (const row of usageRows || []) {
    const cost = estimateCostUsd(row.provider as AiProviderName, {
      promptTokens: Number(row.prompt_tokens) || 0,
      completionTokens: Number(row.completion_tokens) || 0,
      cacheReadTokens: Number(row.cache_read_tokens) || 0,
      cacheWriteTokens: Number(row.cache_write_tokens) || 0,
    })
    const existing = shopUsage.get(row.shop_id) || { messages: 0, costUsd: 0 }
    existing.messages += Number(row.message_count) || 0
    existing.costUsd += cost
    shopUsage.set(row.shop_id, existing)
  }

  const shopRows: ShopMarginRow[] = []
  const planAgg = new Map<string, { shopCount: number; messages: number; costThb: number }>()

  for (const shop of shops || []) {
    const planKey = shop.plan_key || shop.plan || 'free'
    const plan = planByKey.get(planKey)
    const price = Number(plan?.price || 0)
    const usage = shopUsage.get(shop.id) || { messages: 0, costUsd: 0 }
    const costThb = usage.costUsd * THB_PER_USD

    shopRows.push({
      shopId: shop.id,
      shopName: shop.name || '(ไม่มีชื่อ)',
      planKey,
      messages: usage.messages,
      costThb,
      revenueThb: price,
      marginThb: price - costThb,
    })

    const agg = planAgg.get(planKey) || { shopCount: 0, messages: 0, costThb: 0 }
    agg.shopCount += 1
    agg.messages += usage.messages
    agg.costThb += costThb
    planAgg.set(planKey, agg)
  }

  const planRows: PlanMarginRow[] = Array.from(planAgg.entries()).map(([planKey, agg]) => {
    const plan = planByKey.get(planKey)
    const price = Number(plan?.price || 0)
    const revenueThb = price * agg.shopCount
    const marginThb = revenueThb - agg.costThb
    return {
      planKey,
      planName: plan?.name || planKey,
      price,
      shopCount: agg.shopCount,
      messages: agg.messages,
      costThb: agg.costThb,
      revenueThb,
      marginThb,
      marginPct: revenueThb > 0 ? (marginThb / revenueThb) * 100 : 0,
    }
  }).sort((a, b) => a.marginThb - b.marginThb)

  shopRows.sort((a, b) => a.marginThb - b.marginThb)

  const totals = planRows.reduce(
    (acc, p) => ({
      messages: acc.messages + p.messages,
      costThb: acc.costThb + p.costThb,
      revenueThb: acc.revenueThb + p.revenueThb,
      marginThb: acc.marginThb + p.marginThb,
      marginPct: 0,
    }),
    { messages: 0, costThb: 0, revenueThb: 0, marginThb: 0, marginPct: 0 }
  )
  totals.marginPct = totals.revenueThb > 0 ? (totals.marginThb / totals.revenueThb) * 100 : 0

  return { period: targetPeriod, plans: planRows, shops: shopRows, totals }
}
