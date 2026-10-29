import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import CostMonitor from './CostMonitor'

export default async function CostMonitorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const shop = await getOrCreateShopForUser(supabase, user)
  const features = (shop?.features ?? {}) as Record<string, unknown>

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <CostMonitor shopId={shop?.id} enabled={features.shop_skills_enabled === true} />
    </div>
  )
}
