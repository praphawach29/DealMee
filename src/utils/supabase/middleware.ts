import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PLAYGROUND_PATH, REQUEST_PATH_HEADER, safeNextPath } from '@/lib/auth/safeNext'

function nextWithSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`)
  const cookie = request.cookies
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join('; ')
  if (cookie) requestHeaders.set('cookie', cookie)
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export async function updateSession(request: NextRequest) {
  // An auth code or token_hash arriving on the root or login page means Supabase fell back to the
  // Site URL — the redirectTo was not on the project's Redirect URLs list. The root page would
  // redirect to /dashboard and drop it, and a password reset would end on the login form. Hand it
  // to the callback instead; a recovery link still finds its way to /reset-password.
  const { pathname, searchParams } = request.nextUrl
  if (
    (searchParams.has('code') || searchParams.has('token_hash')) &&
    (pathname === '/' || pathname === '/login')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    url.searchParams.set(
      'next',
      safeNextPath(url.searchParams.get('next'), searchParams.get('type') === 'recovery' ? '/reset-password' : '/dashboard'),
    )
    return NextResponse.redirect(url)
  }

  let supabaseResponse = nextWithSession(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = nextWithSession(request)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/reset-password') &&
    !request.nextUrl.pathname.startsWith('/terms') &&
    !request.nextUrl.pathname.startsWith('/privacy') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api/auth') &&
    !request.nextUrl.pathname.startsWith('/api/webhook') &&
    // Meta's data deletion / deauthorize callbacks and the status page it links people to
    !request.nextUrl.pathname.startsWith('/api/facebook/data-deletion') &&
    !request.nextUrl.pathname.startsWith('/facebook/data-deletion') &&
    !request.nextUrl.pathname.startsWith('/api/billing/webhook') &&
    !request.nextUrl.pathname.startsWith('/api/cron') &&
    // The landing page's live demo: no account, capped per visitor in the database
    !request.nextUrl.pathname.startsWith('/api/demo') &&
    !request.nextUrl.pathname.startsWith('/doc') &&
    !request.nextUrl.pathname.startsWith('/api/doc') &&
    request.nextUrl.pathname !== '/'
  ) {
    // Keep the page they asked for, including /dashboard?playground=1, through the login form.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', safeNextPath(`${pathname}${request.nextUrl.search}`))
    return NextResponse.redirect(url)
  }

  // A signed-in account with no shop cannot open the playground yet. Send them
  // through onboarding without dropping the deep link. Other dashboard URLs are
  // handled in the dashboard layout from x-dealmee-path.
  if (user && pathname === '/dashboard' && request.nextUrl.searchParams.get('playground') === '1') {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .maybeSingle()
    if (!profileError && !profile?.workspace_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      url.search = ''
      url.searchParams.set('next', PLAYGROUND_PATH)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
