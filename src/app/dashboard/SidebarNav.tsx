'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

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
    return `flex items-center px-3.5 py-2.5 rounded-xl transition-all group font-label-md text-xs sm:text-sm ${
      active
        ? 'bg-electric-blue text-white font-bold shadow-sm shadow-electric-blue/20'
        : 'text-on-surface-variant hover:bg-surface-container-high'
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
        <span className="material-symbols-outlined mr-2.5 text-[20px]">dashboard</span>
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
            <span className="material-symbols-outlined mr-2.5 text-[20px]">inventory_2</span>
            <span>สินค้า</span>
          </Link>
          <Link
            href="/dashboard/orders"
            prefetch={true}
            onMouseEnter={() => handleMouseEnter('/dashboard/orders')}
            onClick={() => handleLinkClick('/dashboard/orders')}
            className={linkClass('/dashboard/orders')}
          >
            <span className="material-symbols-outlined mr-2.5 text-[20px]">receipt_long</span>
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
            <span className="material-symbols-outlined mr-2.5 text-[20px]">calendar_month</span>
            <span>การจอง</span>
          </Link>
          <Link
            href="/dashboard/services"
            prefetch={true}
            onMouseEnter={() => handleMouseEnter('/dashboard/services')}
            onClick={() => handleLinkClick('/dashboard/services')}
            className={linkClass('/dashboard/services')}
          >
            <span className="material-symbols-outlined mr-2.5 text-[20px]">design_services</span>
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
          <span className="material-symbols-outlined mr-2.5 text-[20px]">restaurant</span>
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
        <span className="material-symbols-outlined mr-2.5 text-[20px]">credit_card</span>
        <span>แพ็กเกจและการชำระเงิน</span>
      </Link>

      <Link
        href="/dashboard/settings"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/settings')}
        onClick={() => handleLinkClick('/dashboard/settings')}
        className={linkClass('/dashboard/settings')}
      >
        <span className="material-symbols-outlined mr-2.5 text-[20px]">smart_toy</span>
        <span>ตั้งค่าบอท</span>
      </Link>

      <Link
        href="/dashboard/knowledge"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/knowledge')}
        onClick={() => handleLinkClick('/dashboard/knowledge')}
        className={linkClass('/dashboard/knowledge')}
      >
        <span className="material-symbols-outlined mr-2.5 text-[20px]">database</span>
        <span>คลังความรู้</span>
      </Link>

      <Link
        href="/dashboard/modules"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/modules')}
        onClick={() => handleLinkClick('/dashboard/modules')}
        className={linkClass('/dashboard/modules')}
      >
        <span className="material-symbols-outlined mr-2.5 text-[20px]">extension</span>
        <span>เครื่องมือ</span>
      </Link>

      <Link
        href="/dashboard/inbox"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter('/dashboard/inbox')}
        onClick={() => handleLinkClick('/dashboard/inbox')}
        className={linkClass('/dashboard/inbox')}
      >
        <span className="material-symbols-outlined mr-2.5 text-[20px]">forum</span>
        <span>กล่องข้อความ</span>
      </Link>
      
      <div className="pt-3 mt-3 border-t border-outline-variant/30 space-y-1">
        {isSuperAdmin && (
          <Link
            href="/admin"
            prefetch={true}
            onClick={() => handleLinkClick('/admin')}
            className="flex items-center px-3.5 py-2.5 rounded-xl transition-all font-label-md bg-amber-500/10 text-amber-600 font-bold text-xs sm:text-sm border border-amber-500/30 hover:bg-amber-500/20"
          >
            <span className="material-symbols-outlined mr-2.5 text-[20px] text-amber-500">
              admin_panel_settings
            </span>
            <span>พอร์ทัล Super Admin</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
