'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()?.toLowerCase() || ''
  const password = formData.get('password') as string

  // 1. Attempt login with password
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Smart Fallback: If account does not exist yet in Supabase Auth, attempt sign up automatically!
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      
      if (!signUpError) {
        // Sign in after automatic registration
        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password })
        if (!retryError) {
          revalidatePath('/', 'layout')
          if (isSuperAdminEmail(email)) {
            redirect('/admin')
          }
          redirect('/dashboard')
        }
      }
    }

    redirect(`/login?error=${encodeURIComponent('อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากลืมรหัสผ่าน สามารถกด "ลืมรหัสผ่าน?" ด้านล่างเพื่อรีเซ็ตได้)')}`)
  }

  revalidatePath('/', 'layout')
  if (isSuperAdminEmail(email)) {
    redirect('/admin')
  }
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()?.toLowerCase() || ''
  const password = formData.get('password') as string

  // 1. Try to sign up
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  // 2. If user already registered or signup succeeded, attempt sign in to ensure session cookies are set
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    const msg = signUpError ? signUpError.message : signInError.message
    redirect(`/login?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/', 'layout')
  if (isSuperAdminEmail(email)) {
    redirect('/admin')
  }
  redirect('/onboarding')
}

