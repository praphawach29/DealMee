import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import SettingsTabs from './SettingsTabs'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)

  if (!shop) {
    redirect('/login')
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-28 sm:pb-36 max-w-[1440px] mx-auto w-full">
      <SettingsTabs shop={shop} />
    </div>
  )
}
