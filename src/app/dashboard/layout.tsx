import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import DashboardClientLayout from './DashboardClientLayout'

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

  const bizType = shop?.business_type || 'retail'
  const isSuperAdmin = user.email === 'praphawach@gmail.com'

  return (
    <DashboardClientLayout bizType={bizType} userEmail={user.email || ''} isSuperAdmin={isSuperAdmin}>
      {children}
    </DashboardClientLayout>
  )
}
