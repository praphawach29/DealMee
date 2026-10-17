import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import ModulesView from './ModulesView'

export default async function ModulesPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) {
    redirect('/onboarding')
  }

  const initialFeatures = (shop?.features as Record<string, boolean>) || {}
  const bizType = shop?.business_type || 'retail'
  const discountCap = Number((shop?.features as Record<string, any>)?.max_discount_percent) || 0

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <ModulesView initialFeatures={initialFeatures} bizType={bizType} initialDiscountCap={discountCap} />
    </div>
  )
}
