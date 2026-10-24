'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Loader2,
} from 'lucide-react'

export default function LoginForm({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const nextParam = searchParams.get('next') || ''
  const wantsPlayground = nextParam.includes('playground=1')

  const urlError = searchParams.get('error')
  const [localError, setLocalError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  useEffect(() => {
    // 1. Detect if URL hash has recovery token from email click
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        router.replace('/reset-password' + hash)
        return
      }
    }

    // 2. Listen for Supabase recovery event
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const error = localError || urlError

  const handleTabChange = (newMode: 'login' | 'signup') => {
    setMode(newMode)
    setLocalError(null)
    if (urlError) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('error')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setLocalError(null)
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        e.preventDefault()
        setLocalError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง')
        return
      }
    }
  }

  const handleOpenForgotModal = () => {
    setForgotEmail(email || '')
    setForgotSuccess(false)
    setForgotError(null)
    setShowForgotModal(true)
  }

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)

    const trimmedEmail = forgotEmail.trim().toLowerCase()
    if (!trimmedEmail) {
      setForgotError('กรุณากรอกอีเมลของคุณ')
      return
    }

    setForgotLoading(true)
    try {
      const supabase = createClient()
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (resetErr) {
        setForgotError(resetErr.message || 'ไม่สามารถส่งลิงก์ได้ กรุณาลองใหม่อีกครั้ง')
      } else {
        setForgotSuccess(true)
      }
    } catch (err: any) {
      setForgotError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50/50 via-slate-50 to-slate-100 relative overflow-hidden font-body-md selection:bg-blue-600 selection:text-white p-4 sm:p-6">
      
      {/* Background Soft Floating Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] rounded-full bg-indigo-400/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 relative z-10 my-auto">
        
        {/* Left Side Showcase - Light Gradient Blue (Desktop only) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-10 flex-col justify-between min-h-[570px] shadow-2xl shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
          
          {/* Top Logo */}
          <div className="flex items-center gap-3 relative z-10">
            <Image
              src="/logos/dealmee-icon.png"
              alt="DealMee Logo"
              width={40}
              height={40}
              priority
              className="w-10 h-10 object-contain drop-shadow-lg shrink-0"
            />
            <span className="text-2xl font-black tracking-tight text-white font-headline-lg">
              Deal<span className="text-cyan-300">Mee</span> AI
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-md">
              Sales Closer AI
            </span>
          </div>

          {/* Content */}
          <div className="relative z-10 space-y-6 my-auto">
            <h1 className="text-4xl font-black leading-tight text-white font-headline-xl">
              ระบบบอท AI อัจฉริยะ <br/>
              ตอบแชท & ปิดการขายอัตโนมัติ
            </h1>
            <p className="text-base text-blue-100 leading-relaxed font-body-lg max-w-md">
              ช่วยคุณจัดการร้านค้า ออกใบเสนอราคา Flex สวยหรู สรุปยอด และดูแลลูกค้าตลอด 24 ชั่วโมง
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
                <span className="text-sm text-white font-medium">สร้าง Dynamic PromptPay QR Code สแกนจ่ายตามยอดจริง</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
                <span className="text-sm text-white font-medium">คำนวณค่าจัดส่งแยก กทม. ต่างจังหวัด และพื้นที่ห่างไกล</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-xs text-blue-200 border-t border-white/20 pt-4 flex justify-between items-center">
            <span>© 2026 DealMee AI Platform (dealmee.app)</span>
            <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span> พร้อมใช้งาน 24/7
            </span>
          </div>
        </div>

        {/* Right Side - Clean White Login Card (Mobile, Tablet & Desktop) */}
        <div className="w-full lg:w-1/2 max-w-md flex flex-col items-center">
          
          {/* Top Brand Logo for Mobile & Tablet */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-6">
            <Image
              src="/logos/dealmee-icon.png"
              alt="DealMee Logo"
              width={36}
              height={36}
              className="w-9 h-9 object-contain drop-shadow-md shrink-0"
            />
            <span className="text-2xl font-black tracking-tight text-slate-900 font-headline-lg">
              <span className="text-blue-600">Deal</span><span className="text-cyan-500">Mee</span> AI
            </span>
          </div>

          {/* Clean White Card with Smooth Height Transition */}
          <div className="w-full bg-white rounded-3xl p-6 sm:p-8 md:p-9 shadow-xl shadow-slate-200/70 border border-slate-100 space-y-6 transition-all duration-300 ease-in-out">
            
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner relative">
              <button
                type="button"
                onClick={() => handleTabChange('login')}
                className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer relative z-10 min-h-[44px] ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <LogIn className="h-4 w-4" />
                <span>เข้าสู่ระบบ</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('signup')}
                className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer relative z-10 min-h-[44px] ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>สมัครสมาชิก</span>
              </button>
            </div>

            {/* Title & Subtitle with Smooth Fade */}
            <div className="space-y-1 text-center sm:text-left transition-all duration-300">
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight transition-all duration-300">
                {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed transition-all duration-300 min-h-[40px]">
                {wantsPlayground
                  ? 'หลังสมัครหรือเข้าสู่ระบบ ระบบจะเปิดหน้าทดสอบสนทนากับบอทจริงของร้านคุณทันที'
                  : mode === 'login'
                  ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบร้านค้าของคุณ'
                  : 'กรอกข้อมูลเพื่อเริ่มต้นใช้งานระบบจัดการบอท AI ฟรี'
                }
              </p>
            </div>

            {wantsPlayground && (
              <div className="rounded-[14px] border border-[#2F6BFF]/20 bg-[#2F6BFF]/5 px-4 py-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                ขั้นตอนถัดไปคือคุยกับบอทจริงในร้านของคุณ ไม่ใช่บทสนทนาตัวอย่างบนหน้าแรก
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs sm:text-sm text-red-600 font-medium flex items-start gap-2.5 transition-all duration-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="leading-relaxed">{error}</p>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={handleOpenForgotModal}
                      className="text-xs font-bold text-blue-600 hover:underline cursor-pointer block mt-1"
                    >
                      👉 คลิกที่นี่เพื่อรีเซ็ตรหัสผ่าน (Forgot Password)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="next" value={nextParam} />
              <div className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs sm:text-sm font-bold text-slate-700">
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="block w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs sm:text-sm font-bold text-slate-700">
                      รหัสผ่าน (Password)
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={handleOpenForgotModal}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Smooth Expandable Confirm Password Field */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    mode === 'signup'
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-bold text-slate-700">
                        ยืนยันรหัสผ่าน (Confirm Password)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required={mode === 'signup'}
                          className="block w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  formAction={mode === 'login' ? login : signup}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-blue-600/25 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer min-h-[48px]"
                >
                  <span className="transition-all duration-300">
                    {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก & เริ่มใช้งานฟรี ➔'}
                  </span>
                </Button>
              </div>
            </form>

            {/* Quick Switch Text */}
            <div className="text-center pt-2 border-t border-slate-100 transition-all duration-300">
              <p className="text-xs text-slate-500">
                {mode === 'login' ? (
                  <>
                    ยังไม่มีบัญชีร้านค้า?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('signup')}
                      className="text-blue-600 font-bold hover:underline cursor-pointer min-h-[44px] inline-flex items-center"
                    >
                      สมัครสมาชิกฟรี
                    </button>
                  </>
                ) : (
                  <>
                    มีบัญชีอยู่แล้ว?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('login')}
                      className="text-blue-600 font-bold hover:underline cursor-pointer min-h-[44px] inline-flex items-center"
                    >
                      เข้าสู่ระบบที่นี่
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Terms Footer */}
            <p className="text-center text-[11px] text-slate-400 leading-relaxed pt-1">
              การเข้าใช้งานถือว่าคุณยอมรับ{' '}
              <Link href="/terms" target="_blank" className="text-slate-600 hover:text-blue-600 hover:underline font-medium">เงื่อนไขบริการ</Link> และ{' '}
              <Link href="/privacy" target="_blank" className="text-slate-600 hover:text-blue-600 hover:underline font-medium">นโยบายความเป็นส่วนตัว</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-slate-900">
                ลืมรหัสผ่าน?
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
              </p>
            </div>

            {forgotSuccess ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">ส่งลิงก์สำเร็จแล้ว!</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยัง <strong className="text-emerald-950">{forgotEmail}</strong> แล้ว
                    กรุณาตรวจสอบกล่องข้อความ (Inbox) หรือโฟลเดอร์อีเมลขยะ (Spam/Junk)
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm h-10 rounded-xl font-bold cursor-pointer mt-2"
                >
                  เข้าใจแล้ว ปิดหน้าต่าง
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSendResetLink} className="space-y-4">
                {forgotError && (
                  <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-xs text-red-600 font-medium flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <p className="leading-relaxed">{forgotError}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="block text-xs sm:text-sm font-bold text-slate-700">
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="block w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/3 rounded-xl border-slate-200 text-xs sm:text-sm font-bold text-slate-700 h-11 cursor-pointer"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold h-11 shadow-md shadow-blue-600/25 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังส่ง...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>ส่งลิงก์รีเซ็ต</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


