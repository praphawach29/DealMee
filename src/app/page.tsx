import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import DealMeeLandingPage from '@/components/landing/DealMeeLandingPage'

export default async function Home() {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  // If visitor is accessing the dedicated app subdomain, route directly into the dashboard
  if (host.startsWith('app.dealmee.app') || host.startsWith('app.localhost')) {
    redirect('/dashboard')
  }

  // Otherwise (dealmee.app, www.dealmee.app, localhost, vercel preview), render the marketing landing page
  return <DealMeeLandingPage />
}
