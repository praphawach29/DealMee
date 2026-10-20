import { NextRequest, NextResponse } from 'next/server'
import { getLiveSessionState, generateHostPitch } from '@/lib/live/liveStudioEngine'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireShop } from '@/lib/auth/requireShop'
import { liveStudioGuard } from '@/lib/live/liveStudioAccess'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    const liveBlocked = await liveStudioGuard(auth.shopId)
    if (liveBlocked) return liveBlocked
    const shopId = auth.shopId
    const body = await req.json()
    const basketNo = body.basket_no ? Number(body.basket_no) : undefined

    const state = await getLiveSessionState(shopId)
    const targetBasket = basketNo
      ? state.baskets.find((b) => b.basket_no === basketNo) || state.current_product || state.baskets[0]
      : state.current_product || state.baskets[0]

    if (!targetBasket) {
      return NextResponse.json(
        { error: 'No active basket found in live session' },
        { status: 404 }
      )
    }

    const supabase = createAdminClient()
    const { data: shop } = await supabase
      .from('shops')
      .select('name')
      .eq('id', shopId)
      .maybeSingle()

    const shopName = shop?.name || state.title || 'DealMee Live Shop'
    const pitch = await generateHostPitch(targetBasket, shopName)

    return NextResponse.json({
      success: true,
      pitch,
      basket: targetBasket,
    })
  } catch (err: any) {
    console.error('[Live Pitch API Error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to generate live sales pitch' },
      { status: 500 }
    )
  }
}
