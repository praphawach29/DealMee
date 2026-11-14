import { NextRequest, NextResponse } from 'next/server'
import { getLiveSessionState, processLiveComment, updateLiveBaskets } from '@/lib/live/liveStudioEngine'
import { redactLivePayment } from '@/lib/live/redactLivePayment'
import { requireShop } from '@/lib/auth/requireShop'
import { liveStudioGuard } from '@/lib/live/liveStudioAccess'
import { liveShopDecision } from '@/lib/security/tenantScope'

/**
 * GET /api/live/comment
 * The shop comes from the signed-in session. A shop_id query is accepted only
 * when it is that same shop; another shop gets 403 and no session state.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    const decision = liveShopDecision(auth.shopId, req.nextUrl.searchParams.get('shop_id'))
    if (decision.status !== 'ok') {
      return NextResponse.json({ error: 'Forbidden' }, { status: decision.status })
    }
    const liveBlocked = await liveStudioGuard(decision.shopId)
    if (liveBlocked) return liveBlocked

    const state = redactLivePayment(await getLiveSessionState(decision.shopId))
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
    const auth = await requireShop()
    if (auth.error) return auth.error
    const liveBlocked = await liveStudioGuard(auth.shopId)
    if (liveBlocked) return liveBlocked
    const shop_id = auth.shopId
    const body = await req.json()
    const { username, comment_text, platform, action, baskets, title } = body

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
      order: result.order,
    })
  } catch (err: any) {
    console.error('[Live Comment API Error]:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
