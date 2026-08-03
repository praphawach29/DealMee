import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { getLinePushQuotaInfo } from '@/lib/billing/pushQuota'
import { fetchBroadcastHistory } from './actions'
import BroadcastClientView from './BroadcastClientView'

export const dynamic = 'force-dynamic'

export default async function BroadcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shop = await getOrCreateShopForUser(supabase, user)

  const broadcasts = await fetchBroadcastHistory()
  const pushQuotaInfo = await getLinePushQuotaInfo(supabase, shop?.id || '', shop?.plan || 'pro')

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Smart Broadcast (บรอดแคสต์ตรงกลุ่มเป้าหมาย)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ส่งข้อความโปรโมชันหรือบรอดแคสต์หาลูกค้าเฉพาะกลุ่ม โดยกรองจาก Tags และความชอบที่ AI บันทึกไว้
        </p>
      </div>

      <BroadcastClientView initialBroadcasts={broadcasts} pushQuotaInfo={pushQuotaInfo} />
    </div>
  )
}
