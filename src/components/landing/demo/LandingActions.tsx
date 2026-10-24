'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { PLAYGROUND_PATH } from '@/lib/auth/safeNext'
import { TRIAL_DAYS } from '@/lib/billing/trial'
import type { DemoPersona } from '@/lib/demo/shops'
import DemoChat from './DemoChat'

/**
 * The landing page's two calls to action, kept apart on purpose:
 *
 * - Demo ("ลองคุยกับบอท · ไม่ต้องสมัคร"): opens a chat window over the page with a sample shop.
 *   No account, nothing to fill in.
 * - Trial ("ทดลองใช้ฟรี 14 วัน"): the real sign-up, which ends in the playground of the
 *   visitor's own shop. Someone already signed in gets "ไปที่แดชบอร์ด" instead.
 *
 * Every button on the page comes from here, so the two never get mixed up again.
 */
interface LandingActionsValue {
  isLoggedIn: boolean
  openDemo: (persona?: DemoPersona) => void
}

const LandingActionsContext = createContext<LandingActionsValue>({ isLoggedIn: false, openDemo: () => {} })

export function useLandingActions() {
  return useContext(LandingActionsContext)
}

export function LandingActionsProvider({ isLoggedIn, children }: { isLoggedIn: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Mounted on first open and kept, so closing the window doesn't lose the conversation
  const [mounted, setMounted] = useState(false)
  const [persona, setPersona] = useState<DemoPersona>('shop')

  const openDemo = useCallback((p?: DemoPersona) => {
    if (p) setPersona(p)
    setMounted(true)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open])

  return (
    <LandingActionsContext.Provider value={{ isLoggedIn, openDemo }}>
      {children}

      {/* Floating launcher, like a site chat widget */}
      {!open && (
        <button
          type="button"
          onClick={() => openDemo()}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#06C755] px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/30 hover:bg-[#05b34c] active:scale-95 transition-all"
        >
          <MessageCircle className="h-5 w-5" />
          ลองคุยกับบอท
        </button>
      )}

      {mounted && (
        <div
          className={`fixed inset-0 z-50 ${open ? '' : 'hidden'}`}
          role="dialog"
          aria-modal="true"
          aria-label="ลองคุยกับบอทตัวอย่าง"
        >
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 top-10 sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[640px] sm:max-h-[calc(100vh-40px)] sm:w-[400px] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
            <DemoChat persona={persona} onPersonaChange={setPersona} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </LandingActionsContext.Provider>
  )
}

const SIZES = {
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-7 py-3 text-sm sm:text-base',
}

/** Opens the demo chat. Never asks for anything. */
export function DemoButton({
  size = 'md',
  tone = 'light',
  className = '',
  persona,
}: {
  size?: 'md' | 'lg'
  /** 'dark' on navy backgrounds */
  tone?: 'light' | 'dark'
  className?: string
  persona?: DemoPersona
}) {
  const { openDemo } = useLandingActions()
  const colors =
    tone === 'dark'
      ? 'border-white/40 text-white hover:bg-white/10 hover:border-white/70'
      : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
  return (
    <button
      type="button"
      onClick={() => openDemo(persona)}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] border-2 font-semibold transition-all duration-200 active:scale-95 ${colors} ${SIZES[size]} ${className}`}
    >
      <MessageCircle className="h-4 w-4 text-[#06C755]" />
      <span>ลองคุยกับบอท</span>
      <span className={`text-xs font-medium ${tone === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>· ไม่ต้องสมัคร</span>
    </button>
  )
}

/** The real sign-up (or the dashboard, for someone already signed in). */
export function SignupButton({ size = 'md', className = '' }: { size?: 'md' | 'lg'; className?: string }) {
  const { isLoggedIn } = useLandingActions()
  return (
    <Link
      href={isLoggedIn ? '/dashboard' : PLAYGROUND_PATH}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#2F6BFF] font-semibold text-white shadow-lg shadow-[#2F6BFF]/25 transition-all duration-200 hover:bg-[#2457d6] active:scale-95 ${SIZES[size]} ${className}`}
    >
      {isLoggedIn ? 'ไปที่แดชบอร์ด' : `ทดลองใช้ฟรี ${TRIAL_DAYS} วัน`}
    </Link>
  )
}
