import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import { loginUrl, REQUEST_PATH_HEADER, safeNextPath } from '@/lib/auth/safeNext'
import DashboardClientLayout, { type ShellNotification } from './DashboardClientLayout'
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

  const requested = safeNextPath((await headers()).get(REQUEST_PATH_HEADER), '/dashboard')

  if (error || !user) {
    redirect(loginUrl({ next: requested }))
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  // Accounts not linked to a shop yet set one up first, rather than browsing a
  // dashboard whose pages expect a shop. The path they asked for (for example
  // the playground) is carried through onboarding.
  if (!shop) {
    const resume = requested.startsWith('/dashboard') ? requested : '/dashboard'
    redirect(`/onboarding?next=${encodeURIComponent(resume)}`)
  }

  const bizType = shop?.business_type || 'retail'
  const features = (shop?.features as Record<string, boolean>) || {}
  const isSuperAdmin = isSuperAdminEmail(user.email)

  let notifications: ShellNotification[] = []
  if (shop?.id) {
    const { data } = await supabase
      .from('conversations')
      .select('id, customer_name, last_message, unread_count')
      .eq('shop_id', shop.id)
      .gt('unread_count', 0)
      .order('last_message_at', { ascending: false })
      .limit(6)
    notifications = (data || []).map((row) => ({
      id: row.id,
      customer_name: row.customer_name || 'ลูกค้า',
      last_message: row.last_message,
      unread_count: Number(row.unread_count || 0),
    }))
  }

  return (
    <DashboardClientLayout
      bizType={bizType}
      features={features}
      userEmail={user.email || ''}
      isSuperAdmin={isSuperAdmin}
      planName={planLabel(shop)}
      shopName={shop?.name || 'ร้านค้าของคุณ'}
      notifications={notifications}
    >
      <TrialBanner shop={shop} />
      {children}
    </DashboardClientLayout>
  )
}
