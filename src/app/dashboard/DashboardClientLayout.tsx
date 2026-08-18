'use client'

import { useState } from 'react'
import SidebarNav from './SidebarNav'
import Link from 'next/link'
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
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs transition-opacity"
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
            className="p-1 rounded-lg text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
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
              className="lg:hidden p-1.5 rounded-xl text-on-surface hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>

            <div className="hidden sm:flex items-center gap-3">
              <span className="material-symbols-outlined text-outline text-[20px]">search</span>
              <input
                type="text"
                placeholder="ค้นหาความช่วยเหลือ..."
                className="bg-transparent border-none outline-none text-outline font-label-md text-xs placeholder:text-outline/70 w-40 md:w-56"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs font-label-md transition-all shadow-xs hover:shadow-md hover:shadow-indigo-500/20 cursor-pointer shrink-0"
              title="เปิดผู้ช่วย AI Jarvis ประจำร้าน"
            >
              <span className="material-symbols-outlined text-[16px] animate-pulse">smart_toy</span>
              <span className="hidden sm:inline">AI Copilot</span>
            </button>

            <button className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error-red rounded-full"></span>
            </button>

            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-outline-variant/50">
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold text-xs font-label-md transition-all border border-amber-500/30 shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-500">admin_panel_settings</span>
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
              <button title="ลงชื่อออก" className="p-1.5 text-on-surface-variant hover:bg-error-red/10 hover:text-error-red rounded-full transition-colors flex items-center justify-center cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </form>
          </div>
        </header>

        {/* Main Content View */}
        <main className="relative pt-16 flex-1">
          {children}
        </main>
      </div>

      {/* Floating Copilot Button */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white px-4 py-2.5 sm:py-3 rounded-full shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all cursor-pointer font-bold text-xs group"
          title="ปรึกษา Botify Jarvis AI Copilot"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          </div>
          <span className="hidden sm:inline">ถาม AI Jarvis</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
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
