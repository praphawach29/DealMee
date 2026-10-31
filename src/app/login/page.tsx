import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import { pathAfterAuth, safeNextPath } from '@/lib/auth/safeNext'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string; mode?: string }>
}) {
  const params = (await searchParams) || {}
  const next = safeNextPath(params.next, '')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const shop = await getOrCreateShopForUser(supabase, user)
      redirect(pathAfterAuth({
        hasShop: Boolean(shop?.id),
        isSuperAdmin: isSuperAdminEmail(user.email),
        requested: next,
      }))
    }
  } catch (err) {
    // redirect() throws NEXT_REDIRECT. A failed session lookup should still show the form.
    const digest = typeof err === 'object' && err && 'digest' in err ? String((err as { digest?: unknown }).digest) : ''
    if (digest.startsWith('NEXT_REDIRECT')) throw err
  }

  const initialMode = params.mode === 'login'
    ? 'login'
    : params.mode === 'signup' || next.includes('playground=1')
      ? 'signup'
      : 'login'

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">กำลังโหลด...</div>}>
      <LoginForm initialMode={initialMode} />
    </Suspense>
  )
}
