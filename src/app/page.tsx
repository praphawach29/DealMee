import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  // If visitor is accessing the dedicated app subdomain, route directly into the dashboard
  if (host.startsWith('app.dealmee.app') || host.startsWith('app.localhost')) {
    redirect('/dashboard')
  }

  // Otherwise (dealmee.app, localhost, vercel preview), render the marketing landing page
  // Someone already signed in sees "ไปที่แดชบอร์ด" instead of the sign-up buttons. The browser keeps
  // the session, so a signed-in owner who pressed "ทดลองใช้ฟรี" went straight to their dashboard
  // with nothing on the page saying they were signed in.
  let isLoggedIn = false
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    isLoggedIn = Boolean(data.user)
  } catch {
    isLoggedIn = false
  }

  return <LandingPage isLoggedIn={isLoggedIn} />
}
