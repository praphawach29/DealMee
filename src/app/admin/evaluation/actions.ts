'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface EvaluationMetrics {
  totalConversations: number
  conversationsWithOrders: number
  conversionRate: number
  stageBreakdown: {
    greeting: number
    showcase: number
    closing: number
    post_sale: number
  }
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
  const totalConversations = allConvs.length

  const stageBreakdown = {
    greeting: 0,
    showcase: 0,
    closing: 0,
    post_sale: 0,
  }

  allConvs.forEach((c) => {
    const stage = (c.sales_stage || 'greeting') as keyof typeof stageBreakdown
    if (stageBreakdown[stage] !== undefined) {
      stageBreakdown[stage]++
    } else {
      stageBreakdown.greeting++
    }
  })

  // 2. Fetch distinct conversation_ids with orders
  const { data: orderConvs } = await admin
    .from('orders')
    .select('conversation_id')
    .not('conversation_id', 'is', null)

  const distinctOrderConvs = new Set((orderConvs || []).map((o) => o.conversation_id))
  const conversationsWithOrders = distinctOrderConvs.size
  const conversionRate = totalConversations > 0 ? (conversationsWithOrders / totalConversations) * 100 : 0

  // 3. Fetch CSAT feedback
  const { data: feedbacks } = await admin
    .from('conversation_feedback')
    .select('rating')

  const allFeedbacks = feedbacks || []
  const totalFeedbackCount = allFeedbacks.length
  const avgCsatRating =
    totalFeedbackCount > 0
      ? allFeedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / totalFeedbackCount
      : 0

  // 4. Fetch token usage from chat_messages
  const { data: messages } = await admin
    .from('chat_messages')
    .select('tokens_used')
    .not('tokens_used', 'is', null)

  const totalTokensUsed = (messages || []).reduce((sum, m) => sum + (m.tokens_used || 0), 0)
  const avgTokensPerConversation = totalConversations > 0 ? totalTokensUsed / totalConversations : 0

  // Gemini Flash estimated pricing: ~$0.00015 per 1K tokens
  const estimatedTotalCostUsd = (totalTokensUsed / 1000) * 0.00015

  return {
    totalConversations,
    conversationsWithOrders,
    conversionRate: Math.round(conversionRate * 10) / 10,
    stageBreakdown,
    avgCsatRating: Math.round(avgCsatRating * 10) / 10,
    totalFeedbackCount,
    totalTokensUsed,
    avgTokensPerConversation: Math.round(avgTokensPerConversation),
    estimatedTotalCostUsd: Math.round(estimatedTotalCostUsd * 1000) / 1000,
  }
}
