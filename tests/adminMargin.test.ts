import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aggregateShopUsage,
  computeShopAndPlanAggregations,
  buildPlanMarginRows,
  computeMarginTotals,
} from '../src/lib/admin/marginCalculator.ts'

test('aggregateShopUsage correctly aggregates messages and cost per shop', () => {
  const usageRows = [
    {
      shop_id: 'shop-1',
      provider: 'gemini',
      message_count: 50,
      prompt_tokens: 10000,
      completion_tokens: 2000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    },
    {
      shop_id: 'shop-1',
      provider: 'gemini',
      message_count: 50,
      prompt_tokens: 10000,
      completion_tokens: 2000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    },
    {
      shop_id: 'shop-2',
      provider: 'openai',
      message_count: 10,
      prompt_tokens: 5000,
      completion_tokens: 1000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    },
  ]

  const mockCostEstimator = (provider: string) => (provider === 'gemini' ? 0.05 : 0.02)
  const usageMap = aggregateShopUsage(usageRows, mockCostEstimator)
  assert.equal(usageMap.get('shop-1')?.messages, 100)
  assert.equal(usageMap.get('shop-1')?.costUsd, 0.1)
  assert.equal(usageMap.get('shop-2')?.messages, 10)
  assert.equal(usageMap.get('shop-2')?.costUsd, 0.02)
})

test('computeShopAndPlanAggregations computes margins and sorts by lowest margin first', () => {
  const shops = [
    { id: 'shop-1', name: 'Shop High Margin', plan_key: 'starter' },
    { id: 'shop-2', name: 'Shop Low Margin', plan_key: 'free' },
  ]
  const planByKey = new Map([
    ['free', { key: 'free', name: 'Free', price: 0 }],
    ['starter', { key: 'starter', name: 'Starter', price: 590 }],
  ])
  const shopUsage = new Map([
    ['shop-1', { messages: 100, costUsd: 0.1 }],
    ['shop-2', { messages: 500, costUsd: 2.0 }],
  ])

  const { shopRows, planAgg } = computeShopAndPlanAggregations(shops, planByKey, shopUsage, 35)
  assert.equal(shopRows.length, 2)
  // Lowest margin should be sorted first
  assert.equal(shopRows[0].shopId, 'shop-2')
  assert.ok(shopRows[0].marginThb < 0)

  const freeAgg = planAgg.get('free')
  assert.equal(freeAgg?.shopCount, 1)
  assert.equal(freeAgg?.messages, 500)
})

test('buildPlanMarginRows and computeMarginTotals calculates totals correctly', () => {
  const planAgg = new Map([
    ['starter', { shopCount: 2, messages: 200, costThb: 100 }],
    ['pro', { shopCount: 1, messages: 300, costThb: 200 }],
  ])
  const planByKey = new Map([
    ['starter', { key: 'starter', name: 'Starter', price: 590 }],
    ['pro', { key: 'pro', name: 'Pro', price: 1690 }],
  ])

  const planRows = buildPlanMarginRows(planAgg, planByKey)
  assert.equal(planRows.length, 2)

  const totals = computeMarginTotals(planRows)
  assert.equal(totals.messages, 500)
  assert.equal(totals.costThb, 300)
  // starter: 2 * 590 = 1180; pro: 1 * 1690 = 1690; total = 2870
  assert.equal(totals.revenueThb, 2870)
  assert.equal(totals.marginThb, 2570)
  assert.ok(totals.marginPct > 80)
})
