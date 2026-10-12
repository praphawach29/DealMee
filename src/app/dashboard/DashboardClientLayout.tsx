'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import SidebarNav from './SidebarNav'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  X,
  Search,
  Bot,
  Bell,
  ShieldAlert,
  LogOut,
} from 'lucide-react'
import MerchantCopilotDrawer from '@/components/dashboard/MerchantCopilotDrawer'

interface DashboardClientLayoutProps {
  bizType: string
  features?: Record<string, boolean>
  userEmail: string
  isSuperAdmin?: boolean
  children: React.ReactNode
}

export default function DashboardClientLayout({
  bizType,
  features = {},
  userEmail,
  isSuperAdmin = false,
  children,
}: DashboardClientLayoutProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)

  // Reset loading indicator whenever pathname changes
  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  return (
    <div className="bg-merchant-bg text-on-surface font-body-md min-h-screen relative">
      {/* Top Navigation Progress Indicator for instant feedback */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-electric-blue via-indigo-500 to-purple-500 z-[99999] shadow-[0_0_12px_rgba(59,130,246,0.9)] animate-pulse" />
      )}

      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white z-50 flex-col border-r border-outline-variant/30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="px-6 py-5 flex items-center gap-3 border-b border-outline-variant/20">
          <Image
            src="/logos/concept-d1.jpg"
            alt="DealMee Logo"
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl object-cover shadow-xs border border-outline-variant/30 shrink-0"
            priority
          />
          <div className="flex flex-col">
            <span className="font-headline-md font-extrabold tracking-tight text-lg leading-tight">
              <span className="text-blue-600">Deal</span><span className="text-cyan-500">Mee</span> <span className="text-xs font-bold text-slate-500 uppercase">AI</span>
            </span>
            <span className="text-[10px] text-outline font-medium">Sales Copilot • Omnichannel</span>
          </div>
        </div>
        <SidebarNav
          bizType={bizType}
          features={features}
          isSuperAdmin={isSuperAdmin}
          onNavStart={() => setIsNavigating(true)}
        />
      </aside>

      {/* 2. Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        />
      )}

      {/* 3. Mobile Sliding Drawer Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col shadow-2xl border-r border-outline-variant/30 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 flex items-center justify-between border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/concept-d1.jpg"
              alt="DealMee Logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-cover shadow-xs border border-outline-variant/30"
            />
            <div className="flex flex-col">
              <span className="font-headline-md font-extrabold tracking-tight text-base leading-tight">
                <span className="text-blue-600">Deal</span><span className="text-cyan-500">Mee</span> <span className="text-xs font-bold text-slate-500 uppercase ml-1">AI</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-outline hover:text-on-surface min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="py-3 flex-1 overflow-y-auto">
          <SidebarNav
            bizType={bizType}
            features={features}
            isSuperAdmin={isSuperAdmin}
            onNavClick={() => setIsMobileMenuOpen(false)}
            onNavStart={() => setIsNavigating(true)}
          />
        </div>
      </aside>

      {/* 4. Main Wrapper */}
      <div className="lg:pl-64 flex flex-col min-h-screen relative">
        {/* Top Navigation Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 flex items-center justify-between px-3.5 sm:px-4 lg:px-8 shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-outline-variant/30">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-xl text-on-surface hover:bg-surface-container transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Search Box */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-container/60 border border-outline-variant/30">
              <Search className="h-4 w-4 text-outline" />
              <input
                type="text"
                placeholder="ค้นหาความช่วยเหลือ..."
                className="bg-transparent border-none outline-none text-on-surface font-label-md text-xs placeholder:text-outline w-40 md:w-56"
              />
            </div>
            
            {/* Mobile Logo Only (Clean & Compact) */}
            <Link href="/dashboard" className="sm:hidden flex items-center gap-2 shrink-0">
              <Image
                src="/logos/concept-d1.jpg"
                alt="DealMee Logo"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg object-cover shadow-xs border border-outline-variant/30"
                priority
              />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 lg:gap-5">
            {/* AI Copilot Button in Header (Desktop only - Mobile uses floating FAB button) */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs transition-all active:scale-[0.98] shadow-xs hover:shadow-md hover:shadow-indigo-500/25 cursor-pointer shrink-0 min-h-[36px] border border-indigo-400/30"
              title="เปิดผู้ช่วย DealMee Copilot (AI วิเคราะห์ร้านค้า)"
            >
              <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <span className="hidden sm:inline">DealMee Copilot</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs"></span>
            </button>

            {/* Notifications Bell */}
            <button
              className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-error-red rounded-full"></span>
            </button>

            {/* Super Admin Badge (Desktop only on Header - on Mobile it's in the Hamburger Menu) */}
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold text-xs font-label-md transition-all border border-amber-500/30 shrink-0 active:scale-[0.98]"
              >
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Super Admin</span>
              </Link>
            )}

            {/* User Profile Avatar */}
            <div className="flex items-center gap-2 pl-1 sm:pl-4 sm:border-l border-outline-variant/50">
              <div className="hidden md:block text-right">
                <p className="font-label-md text-on-surface text-xs font-semibold">{userEmail}</p>
                <p className="text-[10px] text-outline uppercase tracking-wider font-bold">Pro Plan</p>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-primary-fixed bg-surface-container-high flex items-center justify-center font-bold text-primary text-xs shadow-xs shrink-0">
                {userEmail?.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Sign Out (Desktop only on Header - on Mobile it's in the Hamburger Menu) */}
            <form action="/auth/signout" method="post" className="hidden sm:block ml-1">
              <button
                title="ลงชื่อออก"
                className="p-2 text-on-surface-variant hover:bg-error-red/10 hover:text-error-red rounded-full transition-colors flex items-center justify-center cursor-pointer min-h-[40px] min-w-[40px]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        {/* Main Content View */}
        <main className="relative pt-16 flex-1 pb-10 sm:pb-14">
          {children}
        </main>
      </div>

      {/* Floating Copilot FAB Button */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white px-4 py-3 rounded-full shadow-xl shadow-indigo-600/30 hover:shadow-2xl hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer font-bold text-xs border border-white/20 group"
          title="ปรึกษา DealMee AI Copilot (วิเคราะห์ยอดขาย, สต็อก, ออเดอร์, คิวจอง)"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="inline">ถาม Copilot</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
        </button>
      )}

      {/* Copilot Drawer */}
      <MerchantCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  )
}
