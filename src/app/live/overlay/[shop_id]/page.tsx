import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getLiveSessionState } from '@/lib/live/liveStudioEngine'
import { redactLivePayment } from '@/lib/live/redactLivePayment'
import { liveStudioEnabled } from '@/lib/live/liveStudioAccess'
import LiveOverlayClient from './LiveOverlayClient'

export const metadata = {
  title: 'DealMee OBS Live Overlay',
  description: 'Dynamic 60fps Product Card Widget for OBS Studio Browser Source',
}

export default async function LiveOverlayPage({
  params,
}: {
  params: Promise<{ shop_id: string }>
}) {
  const { shop_id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const shop = await getOrCreateShopForUser(supabase, user)
  // The path shop id is not a credential. Another shop's overlay is a 404,
  // and we do not load that shop's session to answer it.
  if (!shop?.id || shop.id !== shop_id || !liveStudioEnabled(shop.features)) notFound()

  const initialState = redactLivePayment(await getLiveSessionState(shop.id))

  return (
    <main className="w-screen h-screen bg-transparent overflow-hidden select-none">
      <LiveOverlayClient shopId={shop.id} initialState={initialState} />
    </main>
  )
}
