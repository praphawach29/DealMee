'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateStageBreakdown,
  calculateConversionRate,
  calculateCsat,
  calculateTokenMetrics,
  StageBreakdown,
} from '@/lib/admin/evaluationMetrics'

export interface EvaluationMetrics {
  totalConversations: number
  conversationsWithOrders: number
  conversionRate: number
  stageBreakdown: StageBreakdown
  avgCsatRating: number
  totalFeedbackCount: number
  totalTokensUsed: number
  avgTokensPerConversation: number
  estimatedTotalCostUsd: number
}

export async function getEvaluationMetrics(): Promise<EvaluationMetrics> {
  const admin = createAdminClient()

  // 1. Fetch conversations & stage breakdown
  const { data: convs } = await admin
    .from('conversations')
    .select('id, sales_stage, shop_id')
  const allConvs = convs || []
  const stageBreakdown = calculateStageBreakdown(allConvs)

  // 2. Fetch distinct conversation_ids with orders
  const { data: orderConvs } = await admin
    .from('orders')
    .select('conversation_id')
    .not('conversation_id', 'is', null)
  const distinctOrderConvs = new Set((orderConvs || []).map((o) => o.conversation_id))
  const conversionRate = calculateConversionRate(allConvs.length, distinctOrderConvs.size)

  // 3. Fetch CSAT feedback
  const { data: feedbacks } = await admin
    .from('conversation_feedback')
    .select('rating')
  const { avgCsatRating, totalFeedbackCount } = calculateCsat(feedbacks || [])

  // 4. Fetch token usage from chat_messages
  const { data: messages } = await admin
    .from('chat_messages')
    .select('tokens_used')
    .not('tokens_used', 'is', null)
  const { totalTokensUsed, avgTokensPerConversation, estimatedTotalCostUsd } =
    calculateTokenMetrics(allConvs.length, messages || [])

  return {
    totalConversations: allConvs.length,
    conversationsWithOrders: distinctOrderConvs.size,
    conversionRate,
    stageBreakdown,
    avgCsatRating,
    totalFeedbackCount,
    totalTokensUsed,
    avgTokensPerConversation,
    estimatedTotalCostUsd,
  }
}
