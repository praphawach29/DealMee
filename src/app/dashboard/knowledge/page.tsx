import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { isMissingKnowledgeSchema } from '@/lib/knowledge/hybrid'
import KnowledgeManager from './KnowledgeManager'

/**
 * Importing runs as a server action on this route, and fetching a page or
 * reading a PDF and then having a model turn it into Q&A comfortably exceeds
 * the 10s a Vercel function gets by default — the import would be killed
 * mid-way with nothing saved.
 */
export const maxDuration = 120

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
  let gaps: { id: string; question: string; ask_count: number; last_asked_at: string; reason: string }[] = []
  let gapsReady = true
  if (shop?.id) {
    const [{ data: kbData }, { data: trajData }, gapResult] = await Promise.all([
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
      supabase
        .from('knowledge_gaps')
        .select('id, question, ask_count, last_asked_at, reason')
        .eq('shop_id', shop.id)
        .eq('status', 'open')
        .order('last_asked_at', { ascending: false })
        .limit(50),
    ])

    items = kbData || []
    trajectories = trajData || []
    if (gapResult.error) {
      if (isMissingKnowledgeSchema(gapResult.error)) gapsReady = false
      else console.error('[knowledge-gaps]', gapResult.error.message)
    } else {
      gaps = gapResult.data || []
    }
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <KnowledgeManager items={items} trajectories={trajectories} gaps={gaps} gapsReady={gapsReady} />
    </div>
  )
}
