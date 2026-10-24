import Link from 'next/link'
import { trialStatus, TRIAL_MESSAGE_LIMIT } from '@/lib/billing/trial'

/**
 * Trial countdown shown across the dashboard. In the last 3 days and after the
 * trial ends it turns into an upgrade prompt, since that is when sales automation
 * is about to stop (or has stopped).
 */
export default function TrialBanner({ shop }: { shop: { plan?: string | null; plan_key?: string | null; trial_expires_at?: string | null } }) {
  const trial = trialStatus(shop)
  if (!trial.isTrial) return null

  if (trial.expired) {
    return (
      <div className="mx-4 mt-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-card sm:mx-6 sm:flex-row sm:items-center lg:mx-8">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-rose-800">ช่วงทดลองหมดแล้ว — ร้านใช้แพ็กเกจ Free อยู่</p>
          <p className="text-[11px] sm:text-xs text-rose-700 mt-0.5">
            บอทยังตอบคำถามลูกค้าได้ แต่การรับออเดอร์ ส่ง QR และตรวจสลิปอัตโนมัติหยุดไว้ ออเดอร์ใหม่จะส่งให้แอดมินดูแลเอง
          </p>
        </div>
        <Link href="/dashboard/billing" className="shrink-0 rounded-xl bg-rose-600 px-4 py-2 text-center text-xs font-bold text-white hover:bg-rose-700">
          อัปเกรดเพื่อเปิดใช้งานอีกครั้ง
        </Link>
      </div>
    )
  }

  const urgent = trial.daysLeft <= 3
  return (
    <div className={`mx-4 mt-5 flex flex-col gap-3 rounded-2xl border p-4 shadow-card sm:mx-6 sm:flex-row sm:items-center lg:mx-8 ${urgent ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${urgent ? 'text-amber-800' : 'text-sky-800'}`}>
          ช่วงทดลองใช้ฟรี เหลืออีก {trial.daysLeft} วัน
        </p>
        <p className={`text-[11px] sm:text-xs mt-0.5 ${urgent ? 'text-amber-700' : 'text-sky-700'}`}>
          ใช้ได้ทุกฟีเจอร์ระดับ Pro สูงสุด {TRIAL_MESSAGE_LIMIT} ข้อความ AI
          {urgent ? ' — อัปเกรดก่อนหมดเวลา เพื่อให้บอทรับออเดอร์และตรวจสลิปต่อได้ไม่สะดุด' : ''}
        </p>
      </div>
      {urgent && (
        <Link href="/dashboard/billing" className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-center text-xs font-bold text-white hover:bg-amber-600">
          ดูแพ็กเกจ
        </Link>
      )}
    </div>
  )
}
