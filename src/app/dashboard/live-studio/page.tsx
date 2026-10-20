import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getLiveSessionState } from '@/lib/live/liveStudioEngine'
import LiveStudioClient from './LiveStudioClient'
import { liveStudioEnabled } from '@/lib/live/liveStudioAccess'

export const metadata = {
  title: 'AI Live Studio — DealMee AI',
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
  if (!liveStudioEnabled(shop?.features)) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-10 max-w-xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Live Studio — เร็ว ๆ นี้</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ระบบช่วยไลฟ์ขายของกำลังพัฒนา จะเปิดให้ใช้เมื่อรับคอมเมนต์จากไลฟ์จริงได้
          </p>
        </div>
      </div>
    )
  }
  const liveState = await getLiveSessionState(shop.id)

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <LiveStudioClient shop={shop} initialLiveState={liveState} />
    </div>
  )
}
