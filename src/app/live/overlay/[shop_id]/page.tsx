import { getLiveSessionState } from '@/lib/live/liveStudioEngine'
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
  const initialState = await getLiveSessionState(shop_id)

  return (
    <main className="w-screen h-screen bg-transparent overflow-hidden select-none">
      <LiveOverlayClient shopId={shop_id} initialState={initialState} />
    </main>
  )
}
