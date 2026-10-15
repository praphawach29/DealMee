import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getLiveSessionState } from '@/lib/live/liveStudioEngine'
import LiveStudioClient from './LiveStudioClient'

export const metadata = {
  title: 'DealMee AI Live Studio — 24/7 Virtual Commerce Streamer',
  description: 'ระบบ AI ไลฟ์สดขายของอัตโนมัติ 24 ชม. ตอบสด สลับตะกร้า ปิดการขาย สำหรับ TikTok, FB, Shopee Live',
}

export default async function LiveStudioPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  const liveState = await getLiveSessionState(shop.id)

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <LiveStudioClient shop={shop} initialLiveState={liveState} />
    </div>
  )
}
