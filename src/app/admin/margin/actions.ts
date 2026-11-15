'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPeriod } from '@/lib/billing/usage'
import { verifySuperAdmin } from '../actions'
import { estimateCostUsd, THB_PER_USD, type AiProviderName } from '@/lib/billing/aiPricing'
import {
  aggregateShopUsage,
  computeShopAndPlanAggregations,
  buildPlanMarginRows,
  computeMarginTotals,
  ShopMarginRow,
  PlanMarginRow,
} from '@/lib/admin/marginCalculator'

export type { ShopMarginRow, PlanMarginRow }

export interface MarginReport {
  period: string
  plans: PlanMarginRow[]
  shops: ShopMarginRow[]
  totals: { messages: number; costThb: number; revenueThb: number; marginThb: number; marginPct: number }
}

export {
  aggregateShopUsage,
  computeShopAndPlanAggregations,
  buildPlanMarginRows,
  computeMarginTotals,
}

/**
 * Super Admin only: returns per-shop and per-plan revenue vs LLM cost
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
  const shopUsage = aggregateShopUsage(
    usageRows || [],
    (provider, tokens) => estimateCostUsd(provider as AiProviderName, tokens)
  )
  const { shopRows, planAgg } = computeShopAndPlanAggregations(
    shops || [],
    planByKey,
    shopUsage,
    THB_PER_USD
  )
  const planRows = buildPlanMarginRows(planAgg, planByKey)
  const totals = computeMarginTotals(planRows)

  return { period: targetPeriod, plans: planRows, shops: shopRows, totals }
}
