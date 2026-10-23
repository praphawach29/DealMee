'use client'

import { useState } from 'react'
import Image from 'next/image'
import AdminSidebarNav from './AdminSidebarNav'
import { Crown, Menu, X, LogOut } from 'lucide-react'

interface AdminClientLayoutProps {
  userEmail: string
  children: React.ReactNode
}

export default function AdminClientLayout({
  userEmail,
  children,
}: AdminClientLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="bg-merchant-bg text-on-surface font-body-md min-h-screen">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[248px] bg-white text-on-surface z-50 flex-col border-r border-outline-variant">
        <div className="px-5 h-16 flex items-center justify-between border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/dealmee-icon.png"
              alt="DealMee Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain shrink-0"
              priority
            />
            <div>
              <span className="font-heading font-semibold tracking-tight text-sm block leading-none text-on-surface">
                DealMee
              </span>
              <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block mt-1 flex items-center gap-1">
                <Crown className="h-3 w-3 inline text-amber-500" />
                <span>Super Admin</span>
              </span>
            </div>
          </div>
        </div>
        <AdminSidebarNav />
      </aside>

      {/* 2. Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 transition-opacity animate-fade-in"
        />
      )}

      {/* 3. Mobile Sliding Drawer Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[248px] bg-white text-on-surface flex flex-col shadow-xl border-r border-outline-variant transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/dealmee-icon.png"
              alt="DealMee Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain shrink-0"
            />
            <div>
              <span className="font-heading font-semibold tracking-tight text-sm block leading-none text-on-surface">
                DealMee
              </span>
              <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block mt-1 flex items-center gap-1">
                <Crown className="h-3 w-3 inline text-amber-500" />
                <span>Super Admin</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close admin menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="py-3 flex-1 overflow-y-auto">
          <AdminSidebarNav onNavClick={() => setIsMobileMenuOpen(false)} />
        </div>
      </aside>

      {/* 4. Main Wrapper */}
      <div className="lg:pl-[248px] flex flex-col min-h-screen relative">
        <header className="sticky top-0 h-16 bg-white/90 backdrop-blur-xl z-40 flex items-center justify-between px-4 lg:px-8 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-on-surface hover:bg-surface-container transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open admin navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Super Admin Badge Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-bold font-label-md">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>ผู้ดูแลระบบ Super Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-5">
            <div className="flex items-center gap-3 pl-2 sm:pl-4">
              <div className="hidden md:block text-right">
                <p className="font-label-md text-on-surface text-xs font-bold">{userEmail}</p>
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">System Owner</p>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-amber-500 bg-amber-500/10 flex items-center justify-center font-bold text-amber-600 text-xs shadow-xs">
                <Crown className="h-4 w-4" />
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

        {/* Page Main Body Container */}
        <main className="flex-1">
          <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
