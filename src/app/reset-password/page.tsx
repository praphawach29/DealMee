'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Without a recovery session updateUser() can only fail ("Auth session missing!"), so a form
  // shown here would be a dead end. /auth/callback sends ?error=link when the link could not be
  // exchanged — opened in another browser than the one that asked for it (the PKCE verifier lives
  // in that browser's cookies), already used, or expired.
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const linkFailed = searchParams.get('error') === 'link'

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setCheckingAuth(false)
      }
    })

    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      }
      setCheckingAuth(false)
    }
    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = resendEmail.trim()
    if (!email) return
    setResendLoading(true)
    setResendError(null)
    try {
      const supabase = createClient()
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })
      if (resetErr) setResendError(resetErr.message || 'ไม่สามารถส่งลิงก์ได้ กรุณาลองใหม่อีกครั้ง')
      else setResendSent(true)
    } catch (err: any) {
      setResendError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      return
    }

    if (password !== confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง')
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push('/admin')
        }, 2000)
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>กำลังตรวจสอบความปลอดภัย...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50/50 via-slate-50 to-slate-100 relative overflow-hidden font-body-md selection:bg-blue-600 selection:text-white p-4 sm:p-6">
      {/* Background Soft Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] rounded-full bg-indigo-400/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md mx-auto relative z-10">
        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-9 shadow-xl shadow-slate-200/70 border border-slate-100 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {userEmail ? (
                <>สำหรับบัญชี: <strong className="text-slate-700">{userEmail}</strong></>
              ) : (
                'กรอกรหัสผ่านใหม่ที่คุณต้องการใช้งาน'
              )}
            </p>
          </div>

          {/* Success Notification */}
          {success ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-900">เปลี่ยนรหัสผ่านสำเร็จแล้ว!</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  กำลังนำคุณเข้าสู่ระบบผู้ดูแลระบบ/แดชบอร์ด...
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.push('/admin')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm h-10 mt-2 font-bold cursor-pointer"
              >
                เข้าสู่ระบบทันที <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          ) : !userEmail ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs sm:text-sm text-amber-800 flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-bold">{linkFailed ? 'ลิงก์นี้ใช้ไม่ได้แล้ว' : 'ยังไม่ได้ยืนยันตัวตนจากลิงก์ในอีเมล'}</p>
                  <p>
                    ลิงก์รีเซ็ตรหัสผ่านใช้ได้ครั้งเดียว และต้องเปิดใน<strong>เบราว์เซอร์เดียวกับที่กดขอลิงก์</strong>
                    (ถ้าเปิดจากแอปอีเมลแล้วไปเปิดในเบราว์เซอร์อื่น ลิงก์จะใช้ไม่ได้) กรุณาขอลิงก์ใหม่ด้านล่าง
                  </p>
                </div>
              </div>
              {resendSent ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs sm:text-sm text-emerald-800">
                  ถ้าอีเมลนี้มีบัญชีในระบบ ลิงก์ใหม่จะถูกส่งไปให้ กรุณาเปิดลิงก์ล่าสุดในเบราว์เซอร์นี้
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-3">
                  {resendError && <p className="text-xs text-red-600 font-medium">{resendError}</p>}
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    placeholder="อีเมลที่ใช้เข้าสู่ระบบ"
                    className="block w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                  />
                  <Button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    {resendLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ส่งลิงก์รีเซ็ตใหม่'}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs sm:text-sm text-red-600 font-medium flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="block text-xs sm:text-sm font-bold text-slate-700">
                  รหัสผ่านใหม่ (New Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                    placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label htmlFor="confirm-new-password" className="block text-xs sm:text-sm font-bold text-slate-700">
                  ยืนยันรหัสผ่านใหม่ (Confirm Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                    placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-blue-600/25 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>กำลังบันทึกรหัสผ่านใหม่...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>บันทึกรหัสผ่านใหม่ & เข้าสู่ระบบ</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Back to Login Link */}
          <div className="text-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-xs text-blue-600 font-bold hover:underline cursor-pointer min-h-[44px] inline-flex items-center"
            >
              กลับสู่หน้าเข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">
          กำลังโหลด...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
