import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getPlans } from '@/app/admin/actions'
import { getPlatformBillingSettings, isPlatformPromptPayConfigured } from '@/lib/billing/manualBilling'
import { getPlanLimits } from '@/lib/billing/planLimits'
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

  const period = new Date().toISOString().slice(0, 7)
  const nowIso = new Date().toISOString()

  const [
    plans,
    platformSettings,
    limits,
    { data: usage },
    { data: payments },
    { data: wallet },
    { data: transactions },
    { data: addonPacks },
    { data: addonCredits },
  ] = await Promise.all([
    getPlans(),
    getPlatformBillingSettings(),
    getPlanLimits(shop),
    supabase
      .from('usage_logs')
      .select('messages_used, slips_used')
      .eq('shop_id', shop.id)
      .eq('period', period)
      .maybeSingle(),
    supabase
      .from('billing_payments')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('shop_wallets').select('balance, auto_renew').eq('shop_id', shop.id).maybeSingle(),
    supabase
      .from('wallet_transactions')
      .select('id, kind, amount, balance_after, description, created_at')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('addon_packs').select('key, kind, name, quantity, price, valid_days').eq('is_active', true).order('sort_order'),
    supabase
      .from('shop_addon_credits')
      .select('kind, remaining, expires_at')
      .eq('shop_id', shop.id)
      .gt('remaining', 0)
      .gt('expires_at', nowIso)
      .order('expires_at'),
  ])

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <BillingClient
        shop={shop}
        plans={plans}
        platformSettings={platformSettings}
        topUpEnabled={isPlatformPromptPayConfigured(platformSettings)}
        limits={limits}
        usage={{ messages_used: Number(usage?.messages_used || 0), slips_used: Number(usage?.slips_used || 0) }}
        payments={payments || []}
        wallet={{ balance: Number(wallet?.balance || 0), auto_renew: wallet?.auto_renew !== false }}
        transactions={transactions || []}
        addonPacks={(addonPacks || []).map((p) => ({ ...p, price: Number(p.price) }))}
        addonCredits={addonCredits || []}
      />
    </div>
  )
}
