'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  X,
  Search,
  Bell,
  Sparkles,
  Store,
  ChevronDown,
  LogOut,
  Settings,
  CreditCard,
  Command,
} from 'lucide-react'
import SidebarNav from './SidebarNav'
import MerchantCopilotDrawer from '@/components/dashboard/MerchantCopilotDrawer'
import { dashboardNavItems } from '@/lib/dashboard/nav'

export type ShellNotification = {
  id: string
  customer_name: string
  last_message: string | null
  unread_count: number
}

interface DashboardClientLayoutProps {
  bizType: string
  features?: Record<string, boolean>
  userEmail: string
  isSuperAdmin?: boolean
  planName?: string
  shopName?: string
  notifications?: ShellNotification[]
  children: React.ReactNode
}

export default function DashboardClientLayout({
  bizType,
  features = {},
  userEmail,
  isSuperAdmin = false,
  planName = 'FREE',
  shopName = 'ร้านค้าของคุณ',
  notifications = [],
  children,
}: DashboardClientLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [shopOpen, setShopOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    setIsNavigating(false)
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        setQuery('')
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setShopOpen(false)
        setNotesOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nav = useMemo(() => {
    const groups = dashboardNavItems({ bizType, features, isSuperAdmin })
    return [...groups.main, ...groups.footer]
  }, [bizType, features, isSuperAdmin])

  const results = nav.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  const unread = notifications.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)

  const go = (href: string) => {
    setPaletteOpen(false)
    setQuery('')
    if (href !== pathname) setIsNavigating(true)
    router.push(href)
  }

  return (
    <div className="min-h-screen bg-merchant-bg font-sans text-on-surface">
      {isNavigating && <div className="fixed inset-x-0 top-0 z-[80] h-0.5 animate-pulse bg-primary" />}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-outline-variant bg-white lg:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b border-outline-variant px-5">
          <Image src="/logos/dealmee-logo-horizontal.png" alt="DealMee" width={124} height={32} className="h-8 w-auto" priority />
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">AI</span>
        </Link>
        <SidebarNav bizType={bizType} features={features} isSuperAdmin={isSuperAdmin} onNavStart={() => setIsNavigating(true)} />
      </aside>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-outline-variant bg-white shadow-xl transition-transform duration-200 lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-outline-variant px-4">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
            <Image src="/logos/dealmee-icon.png" alt="DealMee" width={28} height={28} className="h-7 w-7" />
            <span className="font-heading text-sm font-semibold text-primary">DealMee</span>
          </Link>
          <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-on-surface-variant" aria-label="ปิดเมนู">
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav
          bizType={bizType}
          features={features}
          isSuperAdmin={isSuperAdmin}
          onNavClick={() => setIsMobileMenuOpen(false)}
          onNavStart={() => setIsNavigating(true)}
        />
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-outline-variant bg-white/90 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="rounded-xl p-2 text-on-surface hover:bg-surface-container lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setPaletteOpen(true)
              setQuery('')
            }}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 text-left text-sm text-outline sm:max-w-md"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">ค้นหาสินค้า คำสั่งซื้อ ลูกค้า หรือเมนู...</span>
            <span className="ml-auto hidden items-center gap-1 rounded-md border border-outline-variant bg-white px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant sm:inline-flex">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotesOpen((open) => !open)
                  setShopOpen(false)
                }}
                className="relative rounded-xl p-2 text-on-surface-variant hover:bg-surface-container"
                aria-label="การแจ้งเตือน"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />}
              </button>
              {notesOpen && (
                <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-card">
                  <div className="border-b border-outline-variant px-4 py-3">
                    <p className="text-sm font-semibold">การแจ้งเตือน</p>
                    <p className="text-xs text-on-surface-variant">{unread > 0 ? `${unread} ข้อความที่ยังไม่ได้อ่าน` : 'ไม่มีข้อความค้างอ่าน'}</p>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-on-surface-variant">ยังไม่มีการแจ้งเตือนใหม่</p>
                  ) : (
                    <ul>
                      {notifications.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setNotesOpen(false)
                              go('/dashboard/inbox')
                            }}
                            className="block w-full px-4 py-3 text-left hover:bg-surface-container-low"
                          >
                            <p className="text-sm font-semibold text-on-surface">{item.customer_name}</p>
                            <p className="truncate text-xs text-on-surface-variant">{item.last_message || 'มีข้อความใหม่'}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCopilotOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/30 bg-white px-2.5 text-sm font-semibold text-primary hover:bg-primary/5 sm:px-3"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">ผู้ช่วย AI</span>
            </button>

            {isSuperAdmin && (
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 md:inline-flex"
              >
                Super Admin
              </Link>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShopOpen((open) => !open)
                  setNotesOpen(false)
                }}
                className="flex h-10 items-center gap-2 rounded-xl border border-outline-variant bg-white py-1 pl-1 pr-2 hover:bg-surface-container-low"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Store className="h-4 w-4" />
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[140px] truncate text-xs font-semibold text-on-surface">{shopName}</span>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-outline">{planName}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-outline sm:block" />
              </button>
              {shopOpen && (
                <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-outline-variant bg-white p-1.5 shadow-card">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold">{shopName}</p>
                    <p className="truncate text-xs text-on-surface-variant">{userEmail}</p>
                  </div>
                  <MenuLink href="/dashboard/settings" icon={Settings} label="ตั้งค่าร้าน" onClick={() => setShopOpen(false)} />
                  <MenuLink href="/dashboard/profile" icon={Store} label="บัญชีของฉัน" onClick={() => setShopOpen(false)} />
                  <MenuLink href="/dashboard/billing" icon={CreditCard} label="แพ็กเกจและการชำระเงิน" onClick={() => setShopOpen(false)} />
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                      <LogOut className="h-4 w-4" />
                      ออกจากระบบ
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>

      {(shopOpen || notesOpen) && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => {
            setShopOpen(false)
            setNotesOpen(false)
          }}
        />
      )}

      {paletteOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]" onClick={() => setPaletteOpen(false)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-outline-variant px-4">
              <Search className="h-4 w-4 text-outline" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาเมนู หรือคู่มือการใช้งาน"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-outline"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {results.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => go(item.href)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-container"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </button>
                )
              })}
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => go(`/dashboard/help?q=${encodeURIComponent(query.trim())}`)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface-container"
                >
                  <Search className="h-4 w-4 text-outline" />
                  ค้นหาในคู่มือ: {query.trim()}
                </button>
              )}
              {results.length === 0 && !query.trim() && <p className="px-3 py-6 text-sm text-on-surface-variant">พิมพ์เพื่อค้นหาเมนู</p>}
            </div>
          </div>
        </div>
      )}

      <MerchantCopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  )
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string
  icon: typeof Settings
  label: string
  onClick: () => void
}) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-on-surface hover:bg-surface-container">
      <Icon className="h-4 w-4 text-outline" />
      {label}
    </Link>
  )
}
