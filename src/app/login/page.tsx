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
    <div className="min-h-screen w-full flex bg-merchant-bg">
      {/* Left side - Branding & Illustration */}
      <div className="hidden lg:flex w-1/2 bg-deep-indigo text-white relative overflow-hidden items-center justify-center p-12">
        {/* Abstract glowing backgrounds */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-electric-blue/20 blur-[80px] pointer-events-none"></div>
        
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-electric-blue flex items-center justify-center font-bold text-xl">B</div>
            <span className="text-2xl font-bold tracking-tight">Botify AI</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6 text-white font-headline-xl">
            ยกระดับการดูแลลูกค้าด้วย <br/> AI อัจฉริยะ
          </h1>
          <p className="text-xl text-primary-fixed mb-12 font-body-lg">
            ระบบจัดการข้อความและบอท AI ที่ช่วยให้การขายและการบริการลูกค้าง่ายขึ้น พร้อมให้คุณปรับแต่งได้ดั่งใจ
          </p>
          
          <div className="flex items-center gap-4 text-sm font-label-md bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <span className="material-symbols-outlined text-success-green text-3xl">check_circle</span>
            <p className="text-primary-fixed">การตั้งค่าบอทที่ยืดหยุ่น เชื่อมต่อได้หลากหลายแพลตฟอร์ม ใช้งานง่ายไม่ต้องเขียนโค้ด</p>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          
          {/* Prominent Tab Switcher */}
          <div className="bg-surface-container-high p-1.5 rounded-2xl flex items-center shadow-inner border border-outline-variant/40">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                mode === 'login'
                  ? 'bg-electric-blue text-white shadow-md shadow-electric-blue/30 scale-[1.01]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              เข้าสู่ระบบ (Log in)
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                mode === 'signup'
                  ? 'bg-electric-blue text-white shadow-md shadow-electric-blue/30 scale-[1.01]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              สร้างบัญชีใหม่ (Sign up)
            </button>
          </div>

          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-electric-blue flex items-center justify-center font-bold text-white">B</div>
              <span className="text-xl font-bold tracking-tight text-deep-indigo">Botify AI</span>
            </div>
            
            <h2 className="text-3xl font-bold text-on-surface font-headline-lg tracking-tight">
              {mode === 'login' ? 'เข้าสู่ระบบ' : 'ลงทะเบียนใช้งาน'}
            </h2>
            <p className="mt-2 text-on-surface-variant font-body-md">
              {mode === 'login' 
                ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบจัดการร้านค้า'
                : 'สร้างบัญชีใหม่เพื่อเริ่มต้นตั้งค่า AI Agent สำหรับธุรกิจของคุณ'
              }
            </p>
          </div>
          
          {error && (
            <div className="rounded-xl bg-error-red/10 p-4 text-sm text-error-red font-label-md flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <p className="mt-0.5">{error}</p>
            </div>
          )}

          <form className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-on-surface font-label-md">
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline-variant text-[20px]">mail</span>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-10 rounded-xl border border-outline-variant px-4 py-3 text-on-surface bg-surface placeholder:text-outline focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition-all sm:text-sm outline-none"
                    placeholder="name@company.com"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-on-surface font-label-md">
                    รหัสผ่าน (Password)
                  </label>
                  {mode === 'login' && (
                    <a href="#" className="text-sm font-medium text-electric-blue hover:text-primary transition-colors font-label-md">
                      ลืมรหัสผ่าน?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline-variant text-[20px]">lock</span>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-10 rounded-xl border border-outline-variant px-4 py-3 text-on-surface bg-surface placeholder:text-outline focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition-all sm:text-sm outline-none"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-electric-blue transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-4 pt-2">
              {mode === 'login' ? (
                <Button 
                  type="submit" 
                  formAction={login} 
                  className="w-full bg-electric-blue hover:bg-primary text-white py-6 rounded-xl font-label-md text-base shadow-sm shadow-electric-blue/20 transition-all hover:-translate-y-0.5"
                >
                  เข้าสู่ระบบ
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  formAction={signup} 
                  className="w-full bg-electric-blue hover:bg-primary text-white py-6 rounded-xl font-label-md text-base shadow-sm shadow-electric-blue/20 transition-all hover:-translate-y-0.5"
                >
                  สมัครสมาชิก & ตั้งค่าร้านค้า ➔
                </Button>
              )}
            </div>
          </form>
          
          <p className="text-center text-xs text-outline font-label-md mt-8">
            การเข้าสู่ระบบถือว่าคุณยอมรับ <a href="#" className="text-electric-blue hover:underline">เงื่อนไขการใช้งาน</a> และ <a href="#" className="text-electric-blue hover:underline">นโยบายความเป็นส่วนตัว</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}
