'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Package,
  Receipt,
  Calendar,
  Sparkles,
  Utensils,
  CreditCard,
  Bot,
  Database,
  FileSpreadsheet,
  Blocks,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react'

interface SidebarNavProps {
  bizType: string
  features?: Record<string, boolean>
  isSuperAdmin?: boolean
  onNavClick?: () => void
}

export default function SidebarNav({ bizType, features = {}, isSuperAdmin = false, onNavClick }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [activePath, setActivePath] = useState(pathname)

  useEffect(() => {
    setActivePath(pathname)
  }, [pathname])

  const showBookingTools = bizType === 'booking' || bizType === 'restaurant' || features.booking_system === true

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return activePath === '/dashboard'
    }
    return activePath.startsWith(path)
  }

  const handleLinkClick = (path: string) => {
    setActivePath(path)
    if (onNavClick) onNavClick()
  }

  const handleMouseEnter = (path: string) => {
    try {
      router.prefetch(path)
    } catch (_) {}
  }

  const linkClass = (path: string) => {
    const active = isActive(path)
    return `flex items-center px-3.5 py-2.5 rounded-xl transition-all duration-150 group font-label-md text-xs sm:text-sm active:scale-[0.98] ${
      active
        ? 'bg-electric-blue text-white font-bold shadow-sm shadow-electric-blue/25'
        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
    }`
  }

  return (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-3">
      <Link
        href="/dashboard"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard')}
        onClick={() => handleLinkClick('/dashboard')}
        className={linkClass('/dashboard')}
      >
        <LayoutDashboard className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>แดชบอร์ด</span>
      </Link>
      
      {(bizType === 'retail' || bizType === 'restaurant') && (
        <>
          <Link
            href="/dashboard/products"
            prefetch={true}
            onMouseEnter={() => handleMouseEnter('/dashboard/products')}
            onClick={() => handleLinkClick('/dashboard/products')}
            className={linkClass('/dashboard/products')}
          >
            <Package className="mr-2.5 h-[18px] w-[18px] shrink-0" />
            <span>สินค้า</span>
          </Link>
          <Link
            href="/dashboard/orders"
            prefetch={true}
            onMouseEnter={() => handleMouseEnter('/dashboard/orders')}
            onClick={() => handleLinkClick('/dashboard/orders')}
            className={linkClass('/dashboard/orders')}
          >
            <Receipt className="mr-2.5 h-[18px] w-[18px] shrink-0" />
            <span>ออเดอร์</span>
          </Link>
        </>
      )}

      {showBookingTools && (
        <>
          <Link
            href="/dashboard/bookings"
            prefetch={true}
            onMouseEnter={() => handleMouseEnter('/dashboard/bookings')}
            onClick={() => handleLinkClick('/dashboard/bookings')}
            className={linkClass('/dashboard/bookings')}
          >
            <Calendar className="mr-2.5 h-[18px] w-[18px] shrink-0" />
            <span>การจอง</span>
          </Link>
          <Link
            href="/dashboard/services"
            prefetch={true}
            onMouseEnter={() => handleMouseEnter('/dashboard/services')}
            onClick={() => handleLinkClick('/dashboard/services')}
            className={linkClass('/dashboard/services')}
          >
            <Sparkles className="mr-2.5 h-[18px] w-[18px] shrink-0" />
            <span>บริการ</span>
          </Link>
        </>
      )}

      {bizType === 'restaurant' && (
        <Link
          href="/dashboard/menu"
          prefetch={true}
          onMouseEnter={() => handleMouseEnter('/dashboard/menu')}
          onClick={() => handleLinkClick('/dashboard/menu')}
          className={linkClass('/dashboard/menu')}
        >
          <Utensils className="mr-2.5 h-[18px] w-[18px] shrink-0" />
          <span>เมนูอาหาร</span>
        </Link>
      )}

      <Link
        href="/dashboard/billing"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/billing')}
        onClick={() => handleLinkClick('/dashboard/billing')}
        className={linkClass('/dashboard/billing')}
      >
        <CreditCard className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>แพ็กเกจและการชำระเงิน</span>
      </Link>

      <Link
        href="/dashboard/settings"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/settings')}
        onClick={() => handleLinkClick('/dashboard/settings')}
        className={linkClass('/dashboard/settings')}
      >
        <Bot className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>ตั้งค่าบอท</span>
      </Link>

      <Link
        href="/dashboard/knowledge"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/knowledge')}
        onClick={() => handleLinkClick('/dashboard/knowledge')}
        className={linkClass('/dashboard/knowledge')}
      >
        <Database className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>คลังความรู้</span>
      </Link>

      <Link
        href="/dashboard/documents"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/documents')}
        onClick={() => handleLinkClick('/dashboard/documents')}
        className={linkClass('/dashboard/documents')}
      >
        <FileSpreadsheet className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>เอกสาร & ใบเสนอราคา</span>
      </Link>

      <Link
        href="/dashboard/modules"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/modules')}
        onClick={() => handleLinkClick('/dashboard/modules')}
        className={linkClass('/dashboard/modules')}
      >
        <Blocks className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>เครื่องมือ</span>
      </Link>

      <Link
        href="/dashboard/inbox"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/inbox')}
        onClick={() => handleLinkClick('/dashboard/inbox')}
        className={linkClass('/dashboard/inbox')}
      >
        <MessageSquare className="mr-2.5 h-[18px] w-[18px] shrink-0" />
        <span>กล่องข้อความ</span>
      </Link>
      
      <div className="pt-3 mt-3 border-t border-outline-variant/30 space-y-1">
        {isSuperAdmin && (
          <Link
            href="/admin"
            prefetch={true}
            onClick={() => handleLinkClick('/admin')}
            className="flex items-center px-3.5 py-2.5 rounded-xl transition-all font-label-md bg-amber-500/10 text-amber-600 font-bold text-xs sm:text-sm border border-amber-500/30 hover:bg-amber-500/20 active:scale-[0.98]"
          >
            <ShieldAlert className="mr-2.5 h-[18px] w-[18px] text-amber-500 shrink-0" />
            <span>พอร์ทัล Super Admin</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
