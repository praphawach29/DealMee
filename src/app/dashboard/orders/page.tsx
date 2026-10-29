import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OrdersManager from './OrdersManager'

import { getOrCreateShopForUser } from '@/lib/shopHelper'

export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)

  let orders: any[] = []
  if (shop?.id) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', shop.id)
      .not('order_no', 'match', '^ORD-[0-9]{4}$')
      .order('created_at', { ascending: false })

    orders = data || []
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <OrdersManager orders={orders} />
    </div>
  )
}
