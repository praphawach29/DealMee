'use client'

import { useState, Suspense } from 'react'
import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const urlError = searchParams.get('error')
  const [localError, setLocalError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const error = localError || urlError

  const handleTabChange = (newMode: 'login' | 'signup') => {
    setMode(newMode)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setLocalError(null)
    if (urlError) {
      router.replace(pathname)
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50/50 via-slate-50 to-slate-100 relative overflow-hidden font-body-md selection:bg-blue-600 selection:text-white p-4 sm:p-6">
      
      {/* Background Soft Floating Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] rounded-full bg-indigo-400/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 relative z-10 my-auto">
        
        {/* Left Side Showcase - Light Gradient Blue (Desktop only) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-10 flex-col justify-between min-h-[560px] shadow-2xl shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
          
          {/* Top Logo */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white text-blue-600 flex items-center justify-center font-black text-xl shadow-md">
              B
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-headline-lg">Botify AI</span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-md">
              Light Edition
            </span>
          </div>

          {/* Content */}
          <div className="relative z-10 space-y-6 my-auto">
            <h1 className="text-4xl font-black leading-tight text-white font-headline-xl">
              ระบบบอท AI อัจฉริยะ <br/>
              ตอบแชท & ปิดการขายอัตโนมัติ
            </h1>
            <p className="text-base text-blue-100 leading-relaxed font-body-lg max-w-md">
              ช่วยคุณจัดการร้านค้า ออกใบเสนอราคา PDF สรุปยอด และดูแลลูกค้าตลอด 24 ชั่วโมง
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                <span className="material-symbols-outlined text-emerald-300 text-2xl">check_circle</span>
                <span className="text-sm text-white font-medium">สร้าง Dynamic PromptPay QR Code สแกนจ่ายตามยอดจริง</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                <span className="material-symbols-outlined text-emerald-300 text-2xl">check_circle</span>
                <span className="text-sm text-white font-medium">คำนวณค่าจัดส่งแยก กทม. ต่างจังหวัด และพื้นที่ห่างไกล</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-xs text-blue-200 border-t border-white/20 pt-4 flex justify-between items-center">
            <span>© 2026 Botify AI Agent Inc.</span>
            <span className="flex items-center gap-1 text-emerald-300 font-medium">
              ● พร้อมใช้งาน 24/7
            </span>
          </div>
        </div>

        {/* Right Side - Clean White Login Card (Mobile, Tablet & Desktop) */}
        <div className="w-full lg:w-1/2 max-w-md flex flex-col items-center">
          
          {/* Top Brand Logo for Mobile & Tablet */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-lg text-white shadow-md shadow-blue-600/30">
              B
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900 font-headline-lg">Botify AI</span>
          </div>

          {/* Clean White Card */}
          <div className="w-full bg-white rounded-3xl p-6 sm:p-8 md:p-9 shadow-xl shadow-slate-200/70 border border-slate-100 space-y-6">
            
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner">
              <button
                type="button"
                onClick={() => handleTabChange('login')}
                className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>เข้าสู่ระบบ</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('signup')}
                className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>สมัครสมาชิก</span>
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                {mode === 'login'
                  ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบร้านค้าของคุณ'
                  : 'กรอกข้อมูลเพื่อเริ่มต้นใช้งานระบบจัดการบอท AI ฟรี'
                }
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs sm:text-sm text-red-600 font-medium flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[20px] shrink-0 text-red-500">error</span>
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs sm:text-sm font-bold text-slate-700">
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[20px]">mail</span>
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
                      <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                        ลืมรหัสผ่าน?
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
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
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field (Only for Signup Mode) */}
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-bold text-slate-700">
                      ยืนยันรหัสผ่าน (Confirm Password)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                      </div>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="block w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-xs sm:text-sm outline-none font-medium"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                {mode === 'login' ? (
                  <Button
                    type="submit"
                    formAction={login}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    เข้าสู่ระบบ
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    formAction={signup}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    สมัครสมาชิก & เริ่มใช้งานฟรี ➔
                  </Button>
                )}
              </div>
            </form>

            {/* Quick Switch Text */}
            <div className="text-center pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {mode === 'login' ? (
                  <>
                    ยังไม่มีบัญชีร้านค้า?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('signup')}
                      className="text-blue-600 font-bold hover:underline cursor-pointer"
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
                      className="text-blue-600 font-bold hover:underline cursor-pointer"
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
              <a href="#" className="text-slate-600 hover:underline font-medium">เงื่อนไขบริการ</a> และ{' '}
              <a href="#" className="text-slate-600 hover:underline font-medium">นโยบายความเป็นส่วนตัว</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">กำลังโหลด...</div>}>
      <LoginContent />
    </Suspense>
  )
}
