import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import DashboardClientLayout from './DashboardClientLayout'
import { planLabel } from '@/lib/billing/planLabel'
import TrialBanner from './components/TrialBanner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  // Accounts not linked to a shop yet set one up first, rather than browsing a
  // dashboard whose pages expect a shop
  if (!shop) {
    redirect('/onboarding')
  }

  const bizType = shop?.business_type || 'retail'
  const features = (shop?.features as Record<string, boolean>) || {}
  const isSuperAdmin = isSuperAdminEmail(user.email)

  return (
    <DashboardClientLayout bizType={bizType} features={features} userEmail={user.email || ''} isSuperAdmin={isSuperAdmin} planName={planLabel(shop)}>
      <TrialBanner shop={shop} />
      {children}
    </DashboardClientLayout>
  )
}
