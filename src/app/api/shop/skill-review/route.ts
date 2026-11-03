import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { decideProposal, listPendingProposals } from '@/lib/ai/nightlyReviewStore'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireShop()
  if (auth.error) return auth.error
  try {
    const result = await listPendingProposals(createAdminClient(), auth.shopId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[SkillReview] list failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'โหลดข้อเสนอไม่สำเร็จ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const input = body as { proposal_id?: unknown; decision?: unknown }
  const proposalId = typeof input.proposal_id === 'string' ? input.proposal_id.trim() : ''
  const decision = input.decision === 'accept' || input.decision === 'reject' ? input.decision : null
  if (!proposalId || !decision) {
    return NextResponse.json({ error: 'ต้องระบุข้อเสนอและคำตัดสิน' }, { status: 400 })
  }
  const result = await decideProposal(createAdminClient(), auth.shopId, proposalId, decision)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({
    ok: true,
    decision,
    activated: false,
    facts_confirmed: false,
  })
}
