import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import ModulesView from './ModulesView'
import { DEFAULT_PENDING_ORDER_EXPIRY_HOURS, PENDING_ORDER_EXPIRY_OPTIONS } from '@/lib/orders/pendingOrderExpiry'
import { readBusinessHours } from '@/lib/shop/businessHours'

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
  const followUpConfig = (shop?.follow_up_config as Record<string, any>) || {}
  const rawExpiry = Number((shop?.features as Record<string, any>)?.pending_order_expiry_hours)
  const orderExpiryHours = PENDING_ORDER_EXPIRY_OPTIONS.includes(rawExpiry) ? rawExpiry : DEFAULT_PENDING_ORDER_EXPIRY_HOURS

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <ModulesView
        initialFeatures={initialFeatures}
        bizType={bizType}
        initialDiscountCap={discountCap}
        initialFollowUp={followUpConfig}
        initialOrderExpiryHours={orderExpiryHours}
        initialBusinessHours={readBusinessHours(shop?.features as Record<string, any>)}
      />
    </div>
  )
}
