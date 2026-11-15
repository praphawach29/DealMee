export const DEFAULT_THB_PER_USD = 35

export interface ShopMarginRow {
  shopId: string
  shopName: string
  planKey: string
  messages: number
  costThb: number
  revenueThb: number
  marginThb: number
}

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

export type CostEstimator = (
  provider: string,
  tokens: {
    promptTokens: number
    completionTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }
) => number

export function aggregateShopUsage(
  usageRows: Array<{
    shop_id: string
    provider: string
    message_count?: number | null
    prompt_tokens?: number | null
    completion_tokens?: number | null
    cache_read_tokens?: number | null
    cache_write_tokens?: number | null
  }>,
  estimateCost: CostEstimator
): Map<string, { messages: number; costUsd: number }> {
  const shopUsage = new Map<string, { messages: number; costUsd: number }>()

  for (const row of usageRows) {
    const cost = estimateCost(row.provider, {
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

  return shopUsage
}

export function computeShopAndPlanAggregations(
  shops: Array<{ id: string; name?: string | null; plan_key?: string | null; plan?: string | null }>,
  planByKey: Map<string, { key: string; name: string; price: number }>,
  shopUsage: Map<string, { messages: number; costUsd: number }>,
  thbPerUsd: number = DEFAULT_THB_PER_USD
): {
  shopRows: ShopMarginRow[]
  planAgg: Map<string, { shopCount: number; messages: number; costThb: number }>
} {
  const shopRows: ShopMarginRow[] = []
  const planAgg = new Map<string, { shopCount: number; messages: number; costThb: number }>()

  for (const shop of shops) {
    const planKey = shop.plan_key || shop.plan || 'free'
    const plan = planByKey.get(planKey)
    const price = Number(plan?.price || 0)
    const usage = shopUsage.get(shop.id) || { messages: 0, costUsd: 0 }
    const costThb = usage.costUsd * thbPerUsd

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

  shopRows.sort((a, b) => a.marginThb - b.marginThb)
  return { shopRows, planAgg }
}

export function buildPlanMarginRows(
  planAgg: Map<string, { shopCount: number; messages: number; costThb: number }>,
  planByKey: Map<string, { key: string; name: string; price: number }>
): PlanMarginRow[] {
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
  })

  planRows.sort((a, b) => a.marginThb - b.marginThb)
  return planRows
}

export function computeMarginTotals(planRows: PlanMarginRow[]) {
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
  return totals
}
