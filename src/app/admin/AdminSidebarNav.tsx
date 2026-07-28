'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AdminSidebarNavProps {
  onNavClick?: () => void
}

export default function AdminSidebarNav({ onNavClick }: AdminSidebarNavProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'ภาพรวมระบบ',
      href: '/admin',
      icon: 'query_stats',
      exact: true,
    },
    {
      label: 'จัดการร้านค้า',
      href: '/admin/shops',
      icon: 'storefront',
    },
    {
      label: 'แพ็กเกจและราคา',
      href: '/admin/plans',
      icon: 'loyalty',
    },
    {
      label: 'Margin Dashboard',
      href: '/admin/margin',
      icon: 'monitoring',
    },
    {
      label: 'ประวัติระบบ',
      href: '/admin/logs',
      icon: 'history',
    },
  ]

  const isActive = (itemHref: string, exact?: boolean) => {
    if (exact) {
      return pathname === itemHref
    }
    return pathname.startsWith(itemHref)
  }

  return (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto font-label-md py-3">
      <div className="px-3 pb-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest">
        ส่วนควบคุม Super Admin
      </div>

      {navItems.map((item) => {
        const active = isActive(item.href, item.exact)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all font-medium text-xs sm:text-sm ${
              active
                ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-colors ${
                active ? 'text-amber-500' : 'text-slate-400'
              }`}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
