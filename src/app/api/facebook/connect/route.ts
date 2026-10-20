import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { FB_OAUTH_COOKIE, facebookAppConfig, loginDialogUrl, newState, sealCookie } from '@/lib/facebook/connect'

/** Starts "เชื่อมเพจด้วย Facebook": sends the shop owner to Facebook Login */
export async function GET(req: NextRequest) {
  const settings = new URL('/dashboard/settings?tab=channels', req.nextUrl.origin)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return NextResponse.redirect(settings)

  const config = await facebookAppConfig()
  if (!config) {
    settings.searchParams.set('fb', 'not_configured')
    return NextResponse.redirect(settings)
  }

  // The same redirect URI must be sent again when the code is exchanged
  const redirectUri = `${req.nextUrl.origin}/api/facebook/callback`
  const state = newState()
  const res = NextResponse.redirect(loginDialogUrl(config, redirectUri, state))
  res.cookies.set(FB_OAUTH_COOKIE, sealCookie({ state, shopId: shop.id, redirectUri }, 10 * 60_000), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
