'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  KeyRound,
  Store,
  CreditCard,
  Receipt,
  TrendingUp,
  History,
  Sparkles,
  Landmark,
} from 'lucide-react'

interface AdminSidebarNavProps {
  onNavClick?: () => void
}

export default function AdminSidebarNav({ onNavClick }: AdminSidebarNavProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'ภาพรวมระบบ',
      href: '/admin',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'รายการชำระเงิน',
      href: '/admin/payments',
      icon: Receipt,
    },
    {
      label: 'ตั้งค่าบัญชีรับเงิน',
      href: '/admin/payment-settings',
      icon: Landmark,
    },
    {
      label: 'ตั้งค่าระบบ (API Keys)',
      href: '/admin/system-settings',
      icon: KeyRound,
    },
    {
      label: 'จัดการร้านค้า',
      href: '/admin/shops',
      icon: Store,
    },
    {
      label: 'แพ็กเกจและราคา',
      href: '/admin/plans',
      icon: CreditCard,
    },
    {
      label: 'Margin Dashboard',
      href: '/admin/margin',
      icon: TrendingUp,
    },
    {
      label: 'AI Evaluation & CSAT',
      href: '/admin/evaluation',
      icon: Sparkles,
    },
    {
      label: 'ประวัติระบบ',
      href: '/admin/logs',
      icon: History,
    },
  ]

  const isActive = (itemHref: string, exact?: boolean) => {
    if (exact) {
      return pathname === itemHref
    }
    return pathname.startsWith(itemHref)
  }

  return (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-3">
      <div className="px-3 pb-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
        DealMee AI Super Admin
      </div>

      {navItems.map((item) => {
        const active = isActive(item.href, item.exact)
        const IconComponent = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors text-sm ${
              active
                ? 'bg-amber-50 text-amber-700 font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <IconComponent
              className={`h-[18px] w-[18px] shrink-0 ${
                active ? 'text-amber-600' : 'text-outline'
              }`}
            />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
