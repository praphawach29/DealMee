import { createClient } from '@/utils/supabase/server'
import { planLabel } from '@/lib/billing/planLabel'
import MerchantDashboardClient from './MerchantDashboardClient'
import { getOrCreateShopForUser } from '@/lib/shopHelper'

import { getLinePushQuotaInfo } from '@/lib/billing/pushQuota'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <MerchantDashboardClient
        shopName="ร้านค้าตัวอย่าง"
        botName="น้อง DealMee"
        botStatus="active"
        plan="PRO"
        productsCount={0}
        knowledgeCount={0}
        ordersCount={0}
        totalRevenue={0}
        totalMessages={0}
        latestKnowledgeTitle="ยังไม่ได้เชื่อมต่อร้านค้า"
        latestKnowledgeDate=""
        pushQuotaInfo={{
          totalQuota: 300,
          usedCount: 0,
          remainingCount: 300,
          period: new Date().toISOString().slice(0, 7),
          planName: 'PRO',
        }}
      />
    )
  }

  // 2. Fetch Merchant's Shop via shopHelper
  const shop = await getOrCreateShopForUser(supabase, user)
  const currentShopId = shop?.id

  let productsCount = 0
  let knowledgeCount = 0
  let ordersCount = 0
  let totalRevenue = 0
  let totalMessages = 0
  let latestKnowledgeTitle = ''
  let latestKnowledgeDate = ''
  let pushQuotaInfo = {
    totalQuota: 300,
    usedCount: 0,
    remainingCount: 300,
    period: new Date().toISOString().slice(0, 7),
    planName: planLabel(shop),
  }

  if (currentShopId) {
    // Run all 5 independent queries in parallel
    const [
      prodRes,
      kbRes,
      msgRes,
      orderRes,
      quotaInfo,
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', currentShopId),
      supabase.from('knowledge_base').select('title, created_at', { count: 'exact' }).eq('shop_id', currentShopId).order('created_at', { ascending: false }).limit(1),
      supabase.from('chat_messages').select('*', { count: 'exact', head: true }).eq('shop_id', currentShopId),
      supabase.from('orders').select('id, total_amount, status, payment_status').eq('shop_id', currentShopId),
      getLinePushQuotaInfo(supabase, currentShopId, shop?.plan || 'pro'),
    ])

    productsCount = prodRes.count || 0

    const knowledgeItems = kbRes.data
    knowledgeCount = kbRes.count || knowledgeItems?.length || 0
    if (knowledgeItems && knowledgeItems.length > 0) {
      latestKnowledgeTitle = knowledgeItems[0].title
      latestKnowledgeDate = new Date(knowledgeItems[0].created_at).toLocaleDateString('th-TH')
    }

    totalMessages = msgRes.count || shop?.msg_used || 0

    const orders = orderRes.data
    if (orders && orders.length > 0) {
      ordersCount = orders.length
      totalRevenue = orders.reduce((sum: number, o: { total_amount?: number | null }) => {
        return sum + Number(o.total_amount || 0)
      }, 0)
    }

    pushQuotaInfo = quotaInfo
  }

  return (
    <MerchantDashboardClient
      shopName={shop?.name || 'ร้านค้าของคุณ'}
      botName={shop?.bot_name || 'น้อง DealMee'}
      botStatus={shop?.status || 'active'}
      plan={planLabel(shop)}
      productsCount={productsCount}
      knowledgeCount={knowledgeCount}
      ordersCount={ordersCount}
      totalRevenue={totalRevenue}
      totalMessages={totalMessages}
      latestKnowledgeTitle={latestKnowledgeTitle}
      latestKnowledgeDate={latestKnowledgeDate}
      pushQuotaInfo={pushQuotaInfo}
    />
  )
}
