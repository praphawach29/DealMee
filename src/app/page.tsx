import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

export default async function Home() {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  // If visitor is accessing the dedicated app subdomain, route directly into the dashboard
  if (host.startsWith('app.dealmee.app') || host.startsWith('app.localhost')) {
    redirect('/dashboard')
  }

  // Otherwise (botify.ai, dealmee.app, localhost, vercel preview), render the marketing landing page
  return <LandingPage />
}
