'use client'

import { useState, Suspense } from 'react'
import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const error = searchParams.get('error')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleTabChange = (newMode: 'login' | 'signup') => {
    setMode(newMode)
    setEmail('')
    setPassword('')
    if (error) {
      router.replace(pathname)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 lg:bg-merchant-bg relative overflow-hidden font-body-md selection:bg-electric-blue selection:text-white">
      {/* Background Ambient Glows for Mobile/Tablet/Desktop */}
      <div className="absolute top-[-15%] right-[-10%] w-[450px] sm:w-[600px] h-[450px] sm:h-[600px] rounded-full bg-electric-blue/15 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] rounded-full bg-purple-600/15 blur-[120px] pointer-events-none"></div>

      <div className="w-full min-h-screen lg:min-h-0 flex flex-col lg:flex-row max-w-7xl mx-auto lg:rounded-3xl lg:my-8 overflow-hidden lg:shadow-2xl lg:border lg:border-slate-800/80">
        
        {/* Left Side (Desktop Hero Showcase) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white relative p-12 flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent)] pointer-events-none"></div>
          
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-electric-blue flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-electric-blue/30">
              B
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-headline-lg">Botify AI</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              SaaS v2.5
            </span>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 my-auto py-12 space-y-6">
            <h1 className="text-4xl xl:text-5xl font-black leading-tight text-white font-headline-xl">
              ยกระดับการขายด้วย <br/>
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                บอท AI อัจฉริยะ 24 ชม.
              </span>
            </h1>
            <p className="text-base xl:text-lg text-slate-300 leading-relaxed font-body-lg max-w-md">
              ตอบแชทลูกค้าอัตโนมัติ ออกใบเสนอราคา PDF สรุปยอด และวิเคราะห์ลูกค้าครบจบในระบบเดียว
            </p>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="bg-slate-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                </div>
                <div>
                  <div className="text-xs text-slate-400">AI Sales Agent</div>
                  <div className="text-xs font-bold text-white">ปิดการขาย 24/7</div>
                </div>
              </div>
              <div className="bg-slate-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                </div>
                <div>
                  <div className="text-xs text-slate-400">PromptPay QR</div>
                  <div className="text-xs font-bold text-white">ส่ง QR จ่ายตามยอดจริง</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Badge */}
          <div className="relative z-10 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-6">
            <span>© 2026 Botify AI Agent Inc.</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ระบบทำงานปกติ
            </span>
          </div>
        </div>

        {/* Right Side (Form Container - Mobile, Tablet & Desktop Responsive) */}
        <div className="w-full lg:w-1/2 bg-slate-950 lg:bg-slate-900/90 flex flex-col justify-center items-center p-4 sm:p-8 md:p-12 relative z-10">
          
          {/* Mobile & Tablet Top Branding Banner */}
          <div className="lg:hidden w-full max-w-md text-center mb-6 pt-4 sm:pt-0">
            <div className="inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/30 text-white shadow-lg mb-3">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-500 to-electric-blue flex items-center justify-center font-bold text-sm text-white shadow-md">
                B
              </div>
              <span className="font-extrabold text-base tracking-tight text-white">Botify AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              ระบบบอท AI อัจฉริยะจัดการร้านค้าออนไลน์
            </p>
          </div>

          {/* Main Card Container */}
          <div className="w-full max-w-md bg-slate-900/95 sm:bg-slate-900/80 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-slate-800/90 shadow-2xl space-y-6">
            
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-950/80 p-1.5 rounded-2xl flex items-center border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => handleTabChange('login')}
                className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-electric-blue text-white shadow-lg shadow-electric-blue/25 scale-[1.01]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
                    ? 'bg-electric-blue text-white shadow-lg shadow-electric-blue/25 scale-[1.01]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>สมัครสมาชิก</span>
              </button>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {mode === 'login' ? 'ยินดีต้อนรับกลับมา 👋' : 'สร้างบัญชีร้านค้าใหม่ 🚀'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-normal leading-relaxed">
                {mode === 'login'
                  ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบจัดการร้านค้า'
                  : 'ลงทะเบียนใช้งานฟรีเพื่อเริ่มต้นตั้งค่า AI Agent ร้านค้าของคุณ'
                }
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-xs sm:text-sm text-red-400 font-medium flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] shrink-0 text-red-400">error</span>
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {/* Form */}
            <form className="space-y-4">
              <div className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs sm:text-sm font-bold text-slate-200">
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <span className="material-symbols-outlined text-[20px]">mail</span>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="block w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/30 transition-all text-xs sm:text-sm outline-none font-medium"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs sm:text-sm font-bold text-slate-200">
                      รหัสผ่าน (Password)
                    </label>
                    {mode === 'login' && (
                      <a href="#" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                        ลืมรหัสผ่าน?
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full pl-11 pr-11 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder:text-slate-600 focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/30 transition-all text-xs sm:text-sm outline-none font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                {mode === 'login' ? (
                  <Button
                    type="submit"
                    formAction={login}
                    className="w-full bg-gradient-to-r from-blue-600 via-electric-blue to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white h-12 rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-electric-blue/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    เข้าสู่ระบบ
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    formAction={signup}
                    className="w-full bg-gradient-to-r from-blue-600 via-electric-blue to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white h-12 rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-electric-blue/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    สมัครสมาชิก & เริ่มตั้งค่าร้านค้า ➔
                  </Button>
                )}
              </div>
            </form>

            {/* Quick Switch Text */}
            <div className="text-center pt-2 border-t border-slate-800/60">
              <p className="text-xs text-slate-400">
                {mode === 'login' ? (
                  <>
                    ยังไม่มีบัญชีร้านค้า?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('signup')}
                      className="text-blue-400 font-bold hover:underline cursor-pointer"
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
                      className="text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      เข้าสู่ระบบที่นี่
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Terms Footer */}
            <p className="text-center text-[11px] text-slate-500 leading-relaxed pt-1">
              การเข้าใช้งานถือว่าคุณยอมรับ{' '}
              <a href="#" className="text-slate-400 hover:underline">เงื่อนไขบริการ</a> และ{' '}
              <a href="#" className="text-slate-400 hover:underline">นโยบายความเป็นส่วนตัว</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">กำลังโหลด...</div>}>
      <LoginContent />
    </Suspense>
  )
}
