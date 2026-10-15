import { NextRequest, NextResponse } from 'next/server'
import { getLiveSessionState, processLiveComment, updateLiveBaskets } from '@/lib/live/liveStudioEngine'

/**
 * GET /api/live/comment?shop_id=...
 * Returns current live session state and active product card
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const shopId = searchParams.get('shop_id')

    if (!shopId) {
      return NextResponse.json({ error: 'Missing shop_id query parameter' }, { status: 400 })
    }

    const state = await getLiveSessionState(shopId)
    return NextResponse.json({ success: true, state })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/live/comment
 * Ingests live comment, updates active basket, and triggers overlay transition
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shop_id, username, comment_text, platform, action, baskets, title } = body

    if (!shop_id) {
      return NextResponse.json({ error: 'Missing shop_id' }, { status: 400 })
    }

    // If request is updating baskets from dashboard
    if (action === 'update_baskets' && Array.isArray(baskets)) {
      const updatedState = await updateLiveBaskets(shop_id, baskets, title)
      return NextResponse.json({ success: true, state: updatedState })
    }

    if (!comment_text) {
      return NextResponse.json({ error: 'Missing comment_text' }, { status: 400 })
    }

    const result = await processLiveComment(shop_id, {
      username: username || 'ผู้ชมไลฟ์',
      comment_text,
      platform: platform || 'tiktok',
    })

    return NextResponse.json({
      success: true,
      action_type: result.action_type,
      switched_to_basket: result.switched_to_basket,
      ai_reply: result.ai_reply,
      state: result.state,
    })
  } catch (err: any) {
    console.error('[Live Comment API Error]:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
