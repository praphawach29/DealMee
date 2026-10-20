import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import {
  FB_OAUTH_COOKIE,
  FB_PAGES_COOKIE,
  facebookAppConfig,
  facebookUserId,
  listPages,
  openCookie,
  sealCookie,
  userTokenFromCode,
} from '@/lib/facebook/connect'

/**
 * Facebook Login returns here. The long-lived user token goes into a 15-minute encrypted
 * cookie (page tokens for several pages would outgrow a cookie), and the owner picks a
 * page on the channel settings page, which lists them again with that token.
 */
export async function GET(req: NextRequest) {
  const settings = new URL('/dashboard/settings?tab=channels', req.nextUrl.origin)
  const fail = (reason: string) => {
    settings.searchParams.set('fb', reason)
    const res = NextResponse.redirect(settings)
    res.cookies.delete(FB_OAUTH_COOKIE)
    return res
  }

  const pending = openCookie<{ state: string; shopId: string; redirectUri: string }>(req.cookies.get(FB_OAUTH_COOKIE)?.value)
  const state = req.nextUrl.searchParams.get('state')
  if (!pending || !state || state !== pending.state) return fail('expired')
  if (req.nextUrl.searchParams.get('error')) return fail('cancelled')
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return fail('cancelled')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id || shop.id !== pending.shopId) return fail('expired')

  const config = await facebookAppConfig()
  if (!config) return fail('not_configured')

  try {
    const userToken = await userTokenFromCode(config, code, pending.redirectUri)
    const [fbUserId, pages] = await Promise.all([facebookUserId(userToken), listPages(userToken)])
    if (pages.length === 0) return fail('no_pages')

    settings.searchParams.set('fb', 'choose')
    const res = NextResponse.redirect(settings)
    res.cookies.delete(FB_OAUTH_COOKIE)
    res.cookies.set(FB_PAGES_COOKIE, sealCookie({ shopId: shop.id, fbUserId, userToken }, 15 * 60_000), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    })
    return res
  } catch (err) {
    console.error('[Facebook connect] callback failed:', err)
    return fail('error')
  }
}
