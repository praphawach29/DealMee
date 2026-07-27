import { createClient } from '@/utils/supabase/server'
import AdminOverview from './AdminOverview'

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  trial: 0,
  starter: 390,
  pro: 990,
  agency: 2490,
  byok: 590,
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, plan, status, msg_used, token_used, created_at')
    .order('created_at', { ascending: false })

  const allShops = shops || []
  const shopsCount = allShops.length
  const activeShopsCount = allShops.filter((s) => s.status !== 'suspended').length
  const totalMessages = allShops.reduce((sum, s) => sum + (s.msg_used || 0), 0)
  const totalTokens = allShops.reduce((sum, s) => sum + (s.token_used || 0), 0)

  const estimatedMrr = allShops.reduce((sum, s) => {
    if (s.status === 'suspended') return sum
    const planKey = (s.plan || 'free').toLowerCase()
    return sum + (PLAN_PRICES[planKey] || 0)
  }, 0)

  const recentShops = allShops.slice(0, 5)

  return (
    <AdminOverview
      shopsCount={shopsCount}
      activeShopsCount={activeShopsCount}
      totalMessages={totalMessages}
      totalTokens={totalTokens}
      estimatedMrr={estimatedMrr}
      recentShops={recentShops}
    />
  )
}
