import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractSkillFromConversation } from '@/lib/ai/skillExtractor'

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const admin = createAdminClient()

  // Find conversations with outcomes but no skill extraction yet
  const { data: conversations } = await admin
    .from('conversation_outcomes')
    .select('conversation_id, outcome, revenue')
    .eq('shop_id', auth.shopId)
    .in('outcome', ['conversion', 'handoff'])
    .order('set_at', { ascending: false })
    .limit(20)

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ message: 'No eligible conversations found', processed: 0, created: 0 })
  }

  let processed = 0
  let created = 0
  let skipped = 0
  let errors = 0

  for (const conv of conversations) {
    try {
      const result = await extractSkillFromConversation({
        shopId: auth.shopId,
        conversationId: conv.conversation_id,
        outcome: conv.outcome,
        revenue: conv.revenue || 0,
      })
      processed++
      if (result.success) created++
      else if (result.skipped) skipped++
      else errors++
    } catch (err) {
      console.warn('[BatchExtract] failed for', conv.conversation_id, err)
      errors++
    }
  }

  return NextResponse.json({
    message: `Processed ${processed} conversations`,
    processed,
    created,
    skipped,
    errors,
  })
}
