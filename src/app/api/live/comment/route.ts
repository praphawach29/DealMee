import { NextRequest, NextResponse } from 'next/server'
import { getLiveSessionState, processLiveComment, updateLiveBaskets } from '@/lib/live/liveStudioEngine'
import { redactLivePayment } from '@/lib/live/redactLivePayment'
import { requireShop } from '@/lib/auth/requireShop'
import { liveStudioGuard } from '@/lib/live/liveStudioAccess'
import { liveOverlayDecision, liveShopDecision } from '@/lib/security/tenantScope'
import { verifyOverlayKey } from '@/lib/live/overlayKey'

/**
 * GET /api/live/comment
 * Two callers:
 * - The OBS overlay, which has no login: shop_id plus the overlay key from the
 *   URL Live Studio gave the shop. A key opens only the shop it was signed for.
 * - The signed-in shop: a shop_id query is accepted only when it is that same
 *   shop; another shop gets 403 and no session state.
 * PromptPay data is stripped either way.
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    let shopId: string
    const overlay = liveOverlayDecision(params.get('shop_id'), params.get('key'), verifyOverlayKey)
    if (overlay.status === 403) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (overlay.status === 'ok') {
      shopId = overlay.shopId
    } else {
      const auth = await requireShop()
      if (auth.error) return auth.error
      const decision = liveShopDecision(auth.shopId, params.get('shop_id'))
      if (decision.status !== 'ok') {
        return NextResponse.json({ error: 'Forbidden' }, { status: decision.status })
      }
      shopId = decision.shopId
    }
    const liveBlocked = await liveStudioGuard(shopId)
    if (liveBlocked) return liveBlocked

    const state = redactLivePayment(await getLiveSessionState(shopId))
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
