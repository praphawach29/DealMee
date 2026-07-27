import { createClient } from '@/utils/supabase/server'
import MerchantDashboardClient from './MerchantDashboardClient'

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
        botName="น้อง Botify"
        botStatus="active"
        plan="PRO"
        productsCount={0}
        knowledgeCount={0}
        ordersCount={0}
        totalRevenue={0}
        totalMessages={0}
        latestKnowledgeTitle="ยังไม่ได้เชื่อมต่อร้านค้า"
        latestKnowledgeDate=""
      />
    )
  }

  // 2. Fetch Merchant's Shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, bot_name, status, plan, msg_used')
    .eq('user_id', user.id)
    .single()

  const currentShopId = shop?.id

  let productsCount = 0
  let knowledgeCount = 0
  let ordersCount = 0
  let totalRevenue = 0
  let latestKnowledgeTitle = ''
  let latestKnowledgeDate = ''

  if (currentShopId) {
    // Fetch Products Count
    const { count: prodCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', currentShopId)
    productsCount = prodCount || 0

    // Fetch Knowledge Base Count & Latest Item
    const { data: knowledgeItems, count: kCount } = await supabase
      .from('knowledge_base')
      .select('title, created_at')
      .eq('shop_id', currentShopId)
      .order('created_at', { ascending: false })

    knowledgeCount = kCount || knowledgeItems?.length || 0
    if (knowledgeItems && knowledgeItems.length > 0) {
      latestKnowledgeTitle = knowledgeItems[0].title
      latestKnowledgeDate = new Date(knowledgeItems[0].created_at).toLocaleDateString('th-TH')
    }

    // Fetch Orders Count & Revenue Sum
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_price, status')
      .eq('shop_id', currentShopId)

    if (orders && orders.length > 0) {
      ordersCount = orders.length
      totalRevenue = orders.reduce((sum, o) => {
        if (o.status === 'completed' || o.status === 'paid' || !o.status) {
          return sum + Number(o.total_price || 0)
        }
        return sum
      }, 0)
    }
  }

  return (
    <MerchantDashboardClient
      shopName={shop?.name || 'ร้านค้าของคุณ'}
      botName={shop?.bot_name || 'น้อง Botify'}
      botStatus={shop?.status || 'active'}
      plan={(shop?.plan || 'pro').toUpperCase()}
      productsCount={productsCount}
      knowledgeCount={knowledgeCount}
      ordersCount={ordersCount}
      totalRevenue={totalRevenue}
      totalMessages={shop?.msg_used || 0}
      latestKnowledgeTitle={latestKnowledgeTitle}
      latestKnowledgeDate={latestKnowledgeDate}
    />
  )
}
