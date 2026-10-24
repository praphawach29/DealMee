import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { internalRedirectUrl, safeNextPath } from '@/lib/auth/safeNext'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'), '/dashboard')

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(internalRedirectUrl(origin, next))
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      return NextResponse.redirect(internalRedirectUrl(origin, next))
    }
  }

  // A reset link that could not be exchanged lands on the reset page, which says why and offers a
  // new link, rather than on the login form the user came here to get past.
  if (next === '/reset-password' || type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password?error=link`)
  }

  const login = new URL('/login', origin)
  login.searchParams.set('error', 'ลิงก์ยืนยันตัวตนหมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
  if (searchParams.get('next')) login.searchParams.set('next', next)
  return NextResponse.redirect(login)
}

