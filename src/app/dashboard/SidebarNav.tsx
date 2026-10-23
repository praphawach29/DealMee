'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { dashboardNavItems, type DashboardNavItem } from '@/lib/dashboard/nav'

interface SidebarNavProps {
  bizType: string
  features?: Record<string, boolean>
  isSuperAdmin?: boolean
  onNavClick?: () => void
  onNavStart?: () => void
}

function NavLink({
  item,
  active,
  onClick,
  onHover,
}: {
  item: DashboardNavItem
  active: boolean
  onClick: () => void
  onHover: () => void
}) {
  const Icon = item.icon
  const admin = item.tone === 'admin'
  return (
    <Link
      href={item.href}
      prefetch
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
        admin
          ? 'bg-amber-50 font-semibold text-amber-700 hover:bg-amber-100'
          : active
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${admin ? 'text-amber-600' : active ? 'text-primary' : 'text-outline'}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export default function SidebarNav({ bizType, features = {}, isSuperAdmin = false, onNavClick, onNavStart }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [activePath, setActivePath] = useState(pathname)
  const { main, footer } = dashboardNavItems({ bizType, features, isSuperAdmin })

  useEffect(() => {
    setActivePath(pathname)
  }, [pathname])

  const isActive = (item: DashboardNavItem) => (item.exact ? activePath === item.href : activePath.startsWith(item.href))

  const handleClick = (href: string) => {
    setActivePath(href)
    if (href !== pathname) onNavStart?.()
    onNavClick?.()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="dm-scroll flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {main.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item)}
            onClick={() => handleClick(item.href)}
            onHover={() => {
              try {
                router.prefetch(item.href)
              } catch {
                /* prefetch is best-effort */
              }
            }}
          />
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-4">
        <div className="space-y-1 border-t border-outline-variant pt-3">
          {footer.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              onClick={() => handleClick(item.href)}
              onHover={() => {
                try {
                  router.prefetch(item.href)
                } catch {
                  /* prefetch is best-effort */
                }
              }}
            />
          ))}
        </div>

        <Link
          href="/dashboard/billing"
          onClick={() => handleClick('/dashboard/billing')}
          className="group block rounded-2xl border border-primary/15 bg-gradient-to-br from-[#EAF2FF] to-[#F4FBFF] p-4"
        >
          <p className="text-sm font-semibold text-on-surface">เติบโตไปด้วยกันกับ DealMee</p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">เครื่องมือครบสำหรับผู้ขายไทย</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            ดูแพ็กเกจ
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-3 flex h-8 items-end gap-1" aria-hidden>
            <span className="h-3 w-2 rounded-sm bg-primary/25" />
            <span className="h-5 w-2 rounded-sm bg-primary/45" />
            <span className="h-4 w-2 rounded-sm bg-cyan-400/70" />
            <span className="h-7 w-2 rounded-sm bg-primary" />
            <span className="h-6 w-2 rounded-sm bg-primary/70" />
          </span>
        </Link>
      </div>
    </div>
  )
}
