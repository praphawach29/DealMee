import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import KnowledgeManager from './KnowledgeManager'

/**
 * Importing runs as a server action on this route, and fetching a page or
 * reading a PDF and then having a model turn it into Q&A comfortably exceeds
 * the 10s a Vercel function gets by default — the import would be killed
 * mid-way with nothing saved.
 */
export const maxDuration = 60

export default async function KnowledgePage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)

  let items: any[] = []
  let trajectories: any[] = []
  if (shop?.id) {
    const [{ data: kbData }, { data: trajData }] = await Promise.all([
      supabase
        .from('knowledge_base')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('sales_trajectories')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
    ])

    items = kbData || []
    trajectories = trajData || []
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <KnowledgeManager items={items} trajectories={trajectories} />
    </div>
  )
}
