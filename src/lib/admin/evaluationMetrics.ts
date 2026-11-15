export interface StageBreakdown {
  greeting: number
  showcase: number
  closing: number
  post_sale: number
}

export function calculateStageBreakdown(
  conversations: Array<{ sales_stage?: string | null }>
): StageBreakdown {
  const breakdown: StageBreakdown = {
    greeting: 0,
    showcase: 0,
    closing: 0,
    post_sale: 0,
  }

  for (const c of conversations) {
    const stage = (c.sales_stage || 'greeting') as keyof StageBreakdown
    if (stage in breakdown) {
      breakdown[stage]++
    } else {
      breakdown.greeting++
    }
  }

  return breakdown
}

export function calculateConversionRate(
  totalConversations: number,
  distinctOrderConvsCount: number
): number {
  if (totalConversations <= 0) return 0
  const rate = (distinctOrderConvsCount / totalConversations) * 100
  return Math.round(rate * 10) / 10
}

export function calculateCsat(
  feedbacks: Array<{ rating?: number | null }>
): { avgCsatRating: number; totalFeedbackCount: number } {
  const count = feedbacks.length
  if (count <= 0) {
    return { avgCsatRating: 0, totalFeedbackCount: 0 }
  }

  const totalSum = feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0)
  const avg = totalSum / count
  return {
    avgCsatRating: Math.round(avg * 10) / 10,
    totalFeedbackCount: count,
  }
}

export function calculateTokenMetrics(
  totalConversations: number,
  messages: Array<{ tokens_used?: number | null }>
): {
  totalTokensUsed: number
  avgTokensPerConversation: number
  estimatedTotalCostUsd: number
} {
  const totalTokensUsed = messages.reduce((sum, m) => sum + (m.tokens_used || 0), 0)
  const avgTokensPerConversation =
    totalConversations > 0 ? Math.round(totalTokensUsed / totalConversations) : 0
  const estimatedCost = (totalTokensUsed / 1000) * 0.00015

  return {
    totalTokensUsed,
    avgTokensPerConversation,
    estimatedTotalCostUsd: Math.round(estimatedCost * 1000) / 1000,
  }
}

