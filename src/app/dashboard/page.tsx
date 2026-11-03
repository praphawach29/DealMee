import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { planLabel } from '@/lib/billing/planLabel'
import MerchantDashboardClient from './MerchantDashboardClient'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { loginUrl, PLAYGROUND_PATH } from '@/lib/auth/safeNext'

import { getLinePushQuotaInfo } from '@/lib/billing/pushQuota'
import type { SetupChecklistItem } from './components/SetupChecklistCard'
import type { DashboardOrder, DashboardProduct } from '@/lib/dashboard/metrics'
import { SAMPLE_ORDER_EXCLUSION_PATTERN } from '@/lib/orders/sampleOrders'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ playground?: string }>
}) {
  const openPlayground = (await searchParams)?.playground === '1'
  const supabase = await createClient()

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(loginUrl({ next: openPlayground ? PLAYGROUND_PATH : '/dashboard' }))
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

  let recentOrders: DashboardOrder[] = []
  let catalog: DashboardProduct[] = []
  let pendingSkillProposals = 0

  if (currentShopId) {
    const [
      prodRes,
      kbRes,
      msgRes,
      orderRes,
      productRes,
      quotaInfo,
      reviewProposals,
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('shop_id', currentShopId),
      supabase.from('knowledge_base').select('title, created_at', { count: 'exact' }).eq('shop_id', currentShopId).order('created_at', { ascending: false }).limit(1),
      supabase.from('chat_messages').select('*', { count: 'exact', head: true }).eq('shop_id', currentShopId),
      supabase
        .from('orders')
        .select('id, order_no, customer_name, total_amount, status, items_summary, product_name, quantity, created_at')
        .eq('shop_id', currentShopId)
        .not('order_no', 'match', SAMPLE_ORDER_EXCLUSION_PATTERN)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('products')
        .select('id, name, price, stock, image_url, category')
        .eq('shop_id', currentShopId)
        .order('stock', { ascending: true }),
      getLinePushQuotaInfo(supabase, currentShopId, shop?.plan || 'pro'),
      supabase
        .from('shop_skill_review_proposals')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', currentShopId)
        .eq('status', 'pending'),
    ])

    productsCount = prodRes.count || 0
    if (!reviewProposals.error) pendingSkillProposals = reviewProposals.count || 0
    catalog = (productRes.data || []).map((product) => ({
      id: product.id,
      name: product.name || 'สินค้า',
      price: Number(product.price || 0),
      stock: product.stock == null ? null : Number(product.stock),
      image_url: product.image_url,
      category: product.category,
    }))
    recentOrders = (orderRes.data || []).map((order) => ({
      id: order.id,
      order_no: order.order_no || '',
      customer_name: order.customer_name || 'ลูกค้า',
      total_amount: Number(order.total_amount || 0),
      status: order.status || 'pending',
      items_summary: order.items_summary,
      product_name: order.product_name,
      quantity: order.quantity,
      created_at: order.created_at,
    }))

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

  // "Ready to sell" checklist, derived from what the shop has actually configured
  const features = (shop?.features as Record<string, any>) || {}
  const setupChecklist: SetupChecklistItem[] = shop
    ? [
        {
          key: 'line',
          label: 'เชื่อม LINE OA',
          hint: 'ใส่ Channel Access Token และ Channel Secret แล้วตั้ง Webhook URL ใน LINE Developers',
          done: Boolean(shop.line_token && shop.line_secret),
          href: '/dashboard/settings?tab=channels',
        },
        {
          key: 'products',
          label: 'เพิ่มสินค้า',
          hint: 'บอทสร้างออเดอร์และใบเสนอราคาได้เฉพาะสินค้าที่อยู่ในระบบ',
          done: productsCount > 0,
          href: '/dashboard/products',
        },
        {
          key: 'payment',
          label: 'ใส่บัญชีรับเงิน (พร้อมเพย์หรือธนาคาร)',
          hint: 'ใช้สร้าง QR และตรวจว่าสลิปโอนเข้าบัญชีร้านจริง',
          done: Boolean(shop.promptpay_number || shop.payment_promptpay || shop.bank_account_number || shop.payment_bank_account),
          href: '/dashboard/settings?tab=payment',
        },
        {
          key: 'admin_line',
          label: 'ผูก LINE ของแอดมินเพื่อรับแจ้งเตือน',
          hint: 'รับแจ้งเตือนออเดอร์ใหม่ การชำระเงิน และสลิปที่รอตรวจ',
          done: Boolean(shop.owner_line_id || features.admin_line_user_id),
          href: '/dashboard/settings?tab=channels',
        },
        {
          key: 'knowledge',
          label: 'ใส่คลังความรู้อย่างน้อย 5 ข้อ',
          hint: 'เช่น การจัดส่ง การรับประกัน การคืนสินค้า เวลาทำการ',
          done: knowledgeCount >= 5,
          href: '/dashboard/knowledge',
        },
      ]
    : []

  return (
    <MerchantDashboardClient
      setupChecklist={setupChecklist}
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
      orders={recentOrders}
      products={catalog}
      initialPlaygroundOpen={openPlayground}
      pendingSkillProposals={pendingSkillProposals}
    />
  )
}
