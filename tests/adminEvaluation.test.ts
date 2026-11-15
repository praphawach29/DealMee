import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateStageBreakdown,
  calculateConversionRate,
  calculateCsat,
  calculateTokenMetrics,
} from '../src/lib/admin/evaluationMetrics.ts'

test('calculateStageBreakdown groups stages accurately and defaults unknown to greeting', () => {
  const convs = [
    { sales_stage: 'greeting' },
    { sales_stage: 'showcase' },
    { sales_stage: 'closing' },
    { sales_stage: 'post_sale' },
    { sales_stage: 'showcase' },
    { sales_stage: 'unknown_stage' },
    { sales_stage: null },
  ]

  const breakdown = calculateStageBreakdown(convs)
  assert.equal(breakdown.greeting, 3) // 1 greeting + 1 unknown + 1 null
  assert.equal(breakdown.showcase, 2)
  assert.equal(breakdown.closing, 1)
  assert.equal(breakdown.post_sale, 1)
})

test('calculateConversionRate returns rounded percentage and handles zero conversations', () => {
  assert.equal(calculateConversionRate(0, 0), 0)
  assert.equal(calculateConversionRate(100, 25), 25)
  assert.equal(calculateConversionRate(3, 1), 33.3)
})

test('calculateCsat computes average score and handles empty feedbacks', () => {
  const empty = calculateCsat([])
  assert.equal(empty.avgCsatRating, 0)
  assert.equal(empty.totalFeedbackCount, 0)

  const feedbacks = [
    { rating: 5 },
    { rating: 4 },
    { rating: 5 },
    { rating: 3 },
  ]
  const res = calculateCsat(feedbacks)
  assert.equal(res.avgCsatRating, 4.3)
  assert.equal(res.totalFeedbackCount, 4)
})

test('calculateTokenMetrics computes total, average, and estimated USD cost', () => {
  const messages = [
    { tokens_used: 1000 },
    { tokens_used: 2500 },
    { tokens_used: 500 },
    { tokens_used: null },
  ]

  const metrics = calculateTokenMetrics(2, messages)
  assert.equal(metrics.totalTokensUsed, 4000)
  assert.equal(metrics.avgTokensPerConversation, 2000)
  // 4000 / 1000 * 0.00015 = 0.0006 -> 0.001
  assert.equal(metrics.estimatedTotalCostUsd, 0.001)
})
