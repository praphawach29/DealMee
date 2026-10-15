import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getCompetitors } from '@/lib/competitors/competitorStore'
import CompetitorDashboardClient from './CompetitorDashboardClient'

export const metadata = {
  title: 'ส่องร้านคู่แข่ง (Competitor Intelligence) — DealMee AI',
  description: 'วิเคราะห์ราคา คอนเทนต์ไวรัล และแฮชแท็กคู่แข่งบน TikTok, IG, FB เพื่อชิงยอดขายให้ธุรกิจคุณ',
}

export default async function CompetitorsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)

  let initialCompetitors: any[] = []
  let shopProducts: any[] = []

  if (shop?.id) {
    initialCompetitors = await getCompetitors(shop.id)

    const { data: prods } = await supabase
      .from('products')
      .select('id, name, price, stock, category, image_url')
      .eq('shop_id', shop.id)
      .limit(10)

    shopProducts = prods || []
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <CompetitorDashboardClient
        shop={shop}
        initialCompetitors={initialCompetitors}
        shopProducts={shopProducts}
      />
    </div>
  )
}
