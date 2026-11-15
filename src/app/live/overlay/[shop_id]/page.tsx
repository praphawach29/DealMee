import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getLiveSessionState } from '@/lib/live/liveStudioEngine'
import { redactLivePayment } from '@/lib/live/redactLivePayment'
import { liveStudioEnabled } from '@/lib/live/liveStudioAccess'
import { verifyOverlayKey } from '@/lib/live/overlayKey'
import LiveOverlayClient from './LiveOverlayClient'

export const metadata = {
  title: 'DealMee OBS Live Overlay',
  description: 'Dynamic 60fps Product Card Widget for OBS Studio Browser Source',
}

/**
 * OBS loads this page in a browser source with no DealMee login, so the URL from
 * Live Studio carries ?key= (see lib/live/overlayKey). The path shop id is not a
 * credential: without a valid key, only the signed-in owner of that shop may open
 * it, and anyone else gets a 404 without that shop's session being loaded.
 */
export default async function LiveOverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ shop_id: string }>
  searchParams: Promise<{ key?: string }>
}) {
  const { shop_id } = await params
  const { key } = await searchParams

  let shopId: string
  let overlayKey: string | null = null

  if (key) {
    if (!verifyOverlayKey(shop_id, key)) notFound()
    const { data: shop } = await createAdminClient().from('shops').select('id, features').eq('id', shop_id).maybeSingle()
    if (!shop?.id || !liveStudioEnabled(shop.features)) notFound()
    shopId = shop.id
    overlayKey = key
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const shop = await getOrCreateShopForUser(supabase, user)
    if (!shop?.id || shop.id !== shop_id || !liveStudioEnabled(shop.features)) notFound()
    shopId = shop.id
  }

  const initialState = redactLivePayment(await getLiveSessionState(shopId))

  return (
    <main className="w-screen h-screen bg-transparent overflow-hidden select-none">
      <LiveOverlayClient shopId={shopId} overlayKey={overlayKey} initialState={initialState} />
    </main>
  )
}
