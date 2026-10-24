'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { loginUrl, pathAfterAuth } from '@/lib/auth/safeNext'

const INVALID_LOGIN = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากลืมรหัสผ่าน สามารถกด "ลืมรหัสผ่าน?" ด้านล่างเพื่อรีเซ็ตได้)'

async function finishAuth(email: string, requested: FormDataEntryValue | null, user: { id: string; email?: string | null }) {
  const supabase = await createClient()
  const shop = await getOrCreateShopForUser(supabase, { id: user.id, email: user.email || undefined })
  revalidatePath('/', 'layout')
  redirect(pathAfterAuth({
    hasShop: Boolean(shop?.id),
    isSuperAdmin: isSuperAdminEmail(email),
    requested: typeof requested === 'string' ? requested : null,
  }))
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()?.toLowerCase() || ''
  const password = formData.get('password') as string
  const requested = formData.get('next')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Smart Fallback: If account does not exist yet in Supabase Auth, attempt sign up automatically!
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })

      if (!signUpError) {
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email, password })
        if (!retryError && retryData.user) {
          await finishAuth(email, requested, retryData.user)
        }
      }
    }

    redirect(loginUrl({ error: INVALID_LOGIN, next: typeof requested === 'string' ? requested : null }))
  }

  if (!data.user) {
    redirect(loginUrl({ error: INVALID_LOGIN, next: typeof requested === 'string' ? requested : null }))
  }

  await finishAuth(email, requested, data.user)
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()?.toLowerCase() || ''
  const password = formData.get('password') as string
  const requested = formData.get('next')

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !signInData.user) {
    const msg = signUpError ? signUpError.message : signInError?.message || INVALID_LOGIN
    redirect(loginUrl({ error: msg, next: typeof requested === 'string' ? requested : null, mode: 'signup' }))
  }

  await finishAuth(email, requested, signInData.user)
}
