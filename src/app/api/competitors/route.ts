import { NextRequest, NextResponse } from 'next/server'
import { getCompetitors, deleteCompetitor } from '@/lib/competitors/competitorStore'

/**
 * GET /api/competitors?shop_id=...
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const shopId = searchParams.get('shop_id')

    if (!shopId) {
      return NextResponse.json({ error: 'Missing shop_id query parameter' }, { status: 400 })
    }

    const competitors = await getCompetitors(shopId)
    return NextResponse.json({ success: true, competitors })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/competitors?shop_id=...&id=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const shopId = searchParams.get('shop_id')
    const competitorId = searchParams.get('id')

    if (!shopId || !competitorId) {
      return NextResponse.json({ error: 'Missing shop_id or id parameter' }, { status: 400 })
    }

    const deleted = await deleteCompetitor(shopId, competitorId)
    return NextResponse.json({ success: deleted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
