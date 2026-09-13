'use client'

import { useState } from 'react'
import SidebarNav from './SidebarNav'
import Link from 'next/link'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  return (
    <div className="bg-merchant-bg text-on-surface font-body-md min-h-screen">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white z-50 flex-col border-r border-outline-variant/30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-outline-variant/20">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white shadow-xs">B</div>
          <span className="font-headline-md text-primary font-bold tracking-tight text-lg">Botify AI</span>
        </div>
        <SidebarNav bizType={bizType} features={features} isSuperAdmin={isSuperAdmin} />
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
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white shadow-xs">B</div>
            <span className="font-headline-md text-primary font-bold tracking-tight text-lg">Botify AI</span>
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
          <SidebarNav bizType={bizType} features={features} isSuperAdmin={isSuperAdmin} onNavClick={() => setIsMobileMenuOpen(false)} />
        </div>
      </aside>

      {/* 4. Main Wrapper */}
      <div className="lg:pl-64 flex flex-col min-h-screen relative">
        {/* Top Navigation Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 flex items-center justify-between px-4 lg:px-8 shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-on-surface hover:bg-surface-container transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-container/60 border border-outline-variant/30">
              <Search className="h-4 w-4 text-outline" />
              <input
                type="text"
                placeholder="ค้นหาความช่วยเหลือ..."
                className="bg-transparent border-none outline-none text-on-surface font-label-md text-xs placeholder:text-outline w-40 md:w-56"
              />
            </div>
            
            {/* Mobile Brand Title */}
            <span className="sm:hidden font-headline-md text-primary font-bold text-base">
              Botify AI
            </span>
          </div>

          <div className="flex items-center gap-3 lg:gap-5">
            {/* AI Jarvis Copilot Button in Header */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs transition-all active:scale-[0.98] shadow-xs hover:shadow-md hover:shadow-indigo-500/25 cursor-pointer shrink-0 min-h-[36px] border border-indigo-400/30"
              title="เปิดผู้ช่วย Botify Jarvis (AI Copilot วิเคราะห์ร้านค้า)"
            >
              <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <span className="hidden sm:inline">Jarvis Copilot</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs"></span>
            </button>

            <button
              className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error-red rounded-full"></span>
            </button>

            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-outline-variant/50">
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold text-xs font-label-md transition-all border border-amber-500/30 shrink-0 active:scale-[0.98]"
                >
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <span className="hidden sm:inline">Super Admin</span>
                </Link>
              )}
              <div className="hidden md:block text-right">
                <p className="font-label-md text-on-surface text-xs font-semibold">{userEmail}</p>
                <p className="text-[10px] text-outline uppercase tracking-wider font-bold">Pro Plan</p>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-primary-fixed bg-surface-container-high flex items-center justify-center font-bold text-primary text-xs shadow-xs">
                {userEmail?.charAt(0).toUpperCase()}
              </div>
            </div>

            <form action="/auth/signout" method="post" className="ml-1">
              <button
                title="ลงชื่อออก"
                className="p-2 text-on-surface-variant hover:bg-error-red/10 hover:text-error-red rounded-full transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        {/* Main Content View */}
        <main className="relative pt-16 flex-1">
          {children}
        </main>
      </div>

      {/* Floating Jarvis Copilot FAB Button */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white px-4 py-3 rounded-full shadow-xl shadow-indigo-600/30 hover:shadow-2xl hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer font-bold text-xs border border-white/20 group"
          title="ปรึกษา Botify Jarvis AI Copilot (วิเคราะห์ยอดขาย, สต็อก, ออเดอร์, คิวจอง)"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="inline">ถาม AI Jarvis</span>
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
