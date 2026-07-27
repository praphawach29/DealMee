import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminClientLayout from './AdminClientLayout'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

export const SUPER_ADMIN_EMAILS = [
  'praphawach@gmail.com',
  'admin@botify.ai',
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Check if current user email is in superadmin list
  let isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email || '')

  // Check if role is superadmin in public.users table
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'superadmin') {
    isSuperAdmin = true
  }

  // Server Action to grant superadmin role if requested by user
  async function grantSuperAdminAction() {
    'use server'
    const supabaseServer = await createClient()
    const { data: { user: currentUser } } = await supabaseServer.auth.getUser()
    if (currentUser) {
      await supabaseServer
        .from('users')
        .update({ role: 'superadmin' })
        .eq('id', currentUser.id)
      revalidatePath('/admin')
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-merchant-bg text-on-surface flex items-center justify-center p-4">
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-3xl">
            🔒
          </div>

          <div>
            <h1 className="text-xl font-bold text-on-surface font-headline-md">
              สิทธิ์เข้าถึงพอร์ทัล Super Admin
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-2 leading-relaxed">
              คุณกำลังเข้าใช้งานด้วยอีเมล <strong className="text-on-surface">{user.email}</strong> ซึ่งยังไม่ได้เปิดใช้งานสิทธิ์ Super Admin
            </p>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-700 text-left space-y-1">
            <p className="font-bold">💡 คำแนะนำ:</p>
            <p>คุณสามารถกดปุ่มเปิดใช้งานสิทธิ์ Super Admin ด้านล่างเพื่อปรับเปลี่ยนสิทธิ์บัญชีนี้เป็น Super Admin ทันที</p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <form action={grantSuperAdminAction}>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">verified</span>
                <span>เปิดใช้งานสิทธิ์ Super Admin บัญชีนี้</span>
              </button>
            </form>

            <Link
              href="/dashboard"
              className="w-full py-2.5 px-4 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs sm:text-sm rounded-xl transition-all border border-outline-variant/40 text-center"
            >
              กลับสู่หน้าร้านค้าปกติ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AdminClientLayout userEmail={user.email || ''}>
      {children}
    </AdminClientLayout>
  )
}
