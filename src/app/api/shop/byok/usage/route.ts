import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShopAiKey, getShopAiKeyStatus } from '@/lib/billing/shopAiKey'

export async function GET(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const admin = createAdminClient()

  // Get BYOK status
  const byokKey = await getShopAiKey(auth.shopId)
  const byokStatus = byokKey ? await getShopAiKeyStatus(auth.shopId) : null

  // Count AI calls this month (from chat_messages where sender_type = 'bot')
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count: aiCalls } = await admin
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', auth.shopId)
    .eq('sender_type', 'bot')
    .gte('created_at', monthStart)

  // Estimate cost (Gemini Flash: ~0.0001 USD per request ≈ 0.0035 THB)
  const estimatedCostUsd = (aiCalls || 0) * 0.0001
  const estimatedCostThb = estimatedCostUsd * 35

  return NextResponse.json({
    byok: {
      enabled: !!byokKey,
      provider: byokKey?.provider || null,
      keyHint: byokStatus?.hint || null,
      updatedAt: byokStatus?.updatedAt || null,
    },
    usage: {
      month: now.toISOString().slice(0, 7),
      aiCalls: aiCalls || 0,
      estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
      estimatedCostThb: Math.round(estimatedCostThb * 100) / 100,
    },
  })
}
