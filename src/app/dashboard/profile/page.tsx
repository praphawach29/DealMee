import { createClient } from '@/utils/supabase/server'
import { planLabel } from '@/lib/billing/planLabel'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id, role, name')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) {
    redirect('/onboarding')
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', profile.workspace_id)
    .single()

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 max-w-[1440px] mx-auto w-full flex flex-col relative">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">ข้อมูลบัญชีและแพ็กเกจ</h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
          จัดการข้อมูลร้านค้า ดูโควต้าการใช้งาน และรายละเอียดสมาชิกของคุณ
        </p>
      </div>

      {/* Card 1: Shop Profile */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
            <span className="material-symbols-outlined text-[20px]">storefront</span>
          </div>
          <div>
            <h2 className="font-heading text-base sm:text-lg font-semibold text-on-surface">ข้อมูลร้านค้า</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">รหัสอ้างอิงร้านค้าและประเภทธุรกิจปัจจุบัน</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 text-xs sm:text-sm">
          <div className="space-y-1">
            <span className="text-xs text-outline">ชื่อร้านค้า</span>
            <p className="font-bold text-on-surface">{shop?.name || '-'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-outline">ประเภทธุรกิจ</span>
            <p className="font-bold text-electric-blue capitalize">{shop?.business_type || 'Retail'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-outline">Shop ID (UUID)</span>
            <p className="font-mono text-xs text-on-surface-variant truncate">{shop?.id || '-'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-outline">สถานะร้านค้า</span>
            <div>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                ● Active (ปกติ)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card 2: Subscription & Usage */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <span className="material-symbols-outlined text-[20px]">diamond</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-on-surface truncate">แพ็กเกจและการใช้งาน</h2>
              <p className="text-[11px] sm:text-xs text-on-surface-variant truncate">โควต้าข้อความและสถานะสมาชิกปัจจุบัน</p>
            </div>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-electric-blue text-white shadow-xs shrink-0">
            {planLabel(shop)} PLAN
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold gap-2">
              <span>การใช้งานข้อความแชท</span>
              <span className="shrink-0">142 / 10,000 ข้อความ (1.4%)</span>
            </div>
            <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-electric-blue w-[1.4%] rounded-full"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1 text-xs">
            <div className="p-3 sm:p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
              <span className="text-outline block mb-0.5">จำนวน Tokens ที่ใช้ในเดือนนี้</span>
              <span className="text-sm sm:text-base font-bold text-on-surface">45,210 Tokens</span>
            </div>
            <div className="p-3 sm:p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
              <span className="text-outline block mb-0.5">วันหมดอายุแพ็กเกจ</span>
              <span className="text-sm sm:text-base font-bold text-emerald-600">ไม่มีวันหมดอายุ</span>
            </div>
          </div>
        </div>
      </section>

      {/* Card 3: Admin Profile */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5 sm:pb-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div>
            <h2 className="font-heading text-base sm:text-lg font-semibold text-on-surface">ผู้ใช้งานบัญชีนี้</h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">อีเมลและบทบาทการเข้าถึงระบบ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 text-xs sm:text-sm">
          <div className="space-y-1">
            <span className="text-xs text-outline">อีเมลผู้ใช้</span>
            <p className="font-bold text-on-surface truncate">{user.email}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-outline">สิทธิ์การใช้งาน (Role)</span>
            <p className="font-bold text-purple-600 capitalize">{profile?.role || 'Admin / Owner'}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-outline-variant/30 flex justify-end">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-error-red/10 hover:bg-error-red/20 text-error-red font-bold text-xs sm:text-sm rounded-xl transition-all border border-error-red/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>ลงชื่อออกจากระบบ</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

