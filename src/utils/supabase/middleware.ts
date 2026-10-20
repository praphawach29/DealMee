import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    if (!url.searchParams.has('next')) {
      url.searchParams.set('next', searchParams.get('type') === 'recovery' ? '/reset-password' : '/dashboard')
    }
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
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
    !request.nextUrl.pathname.startsWith('/api/test') &&
    !request.nextUrl.pathname.startsWith('/doc') &&
    !request.nextUrl.pathname.startsWith('/api/doc') &&
    request.nextUrl.pathname !== '/'
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
