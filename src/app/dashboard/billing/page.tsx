import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getPlans } from '@/app/admin/actions'
import BillingClient from './BillingClient'

export default async function BillingPage() {
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

  const plans = await getPlans()

  const period = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('usage_logs')
    .select('messages_used, tokens_used')
    .eq('shop_id', shop.id)
    .eq('period', period)
    .maybeSingle()

  const { data: payments } = await supabase
    .from('billing_payments')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <BillingClient
        shop={shop}
        plans={plans}
        usage={usage || { messages_used: 0, tokens_used: 0 }}
        payments={payments || []}
      />
    </div>
  )
}
