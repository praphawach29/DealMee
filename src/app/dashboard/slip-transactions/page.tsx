import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import SlipTransactions from './SlipTransactions'

export default async function SlipTransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const shop = await getOrCreateShopForUser(supabase, user)
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <SlipTransactions />
    </div>
  )
}
