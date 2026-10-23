import type { LucideIcon } from 'lucide-react'
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
  Radar,
  Radio,
  BookOpen,
} from 'lucide-react'

export type DashboardNavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  tone?: 'admin'
}

export function dashboardNavItems(opts: {
  bizType: string
  features?: Record<string, boolean>
  isSuperAdmin?: boolean
}): { main: DashboardNavItem[]; footer: DashboardNavItem[] } {
  const { bizType, features = {}, isSuperAdmin = false } = opts
  const isBookingBiz = bizType === 'booking' || bizType === 'service'
  const showBookingTools = isBookingBiz || features.booking_system === true
  const main: DashboardNavItem[] = [
    { href: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, exact: true },
  ]

  if (bizType === 'retail' || bizType === 'restaurant') {
    main.push(
      { href: '/dashboard/products', label: 'สินค้า', icon: Package },
      { href: '/dashboard/orders', label: 'ออเดอร์', icon: Receipt },
      { href: '/dashboard/competitors', label: 'ส่องร้านคู่แข่ง', icon: Radar },
    )
    if (features.live_studio === true) {
      main.push({ href: '/dashboard/live-studio', label: 'AI Live Studio', icon: Radio })
    }
  }

  if (showBookingTools) {
    main.push(
      { href: '/dashboard/bookings', label: 'การจอง', icon: Calendar },
      { href: '/dashboard/services', label: 'บริการ', icon: Sparkles },
    )
  }

  if (bizType === 'restaurant') {
    main.push({ href: '/dashboard/menu', label: 'เมนูอาหาร', icon: Utensils })
  }

  main.push(
    { href: '/dashboard/billing', label: 'แพ็กเกจและการชำระเงิน', icon: CreditCard },
    { href: '/dashboard/settings', label: 'ตั้งค่าบอท', icon: Bot },
    { href: '/dashboard/knowledge', label: 'คลังความรู้', icon: Database },
    { href: '/dashboard/documents', label: 'เอกสาร & ใบเสนอราคา', icon: FileSpreadsheet },
    { href: '/dashboard/modules', label: 'เครื่องมือ', icon: Blocks },
    { href: '/dashboard/inbox', label: 'กล่องข้อความ', icon: MessageSquare },
  )

  const footer: DashboardNavItem[] = [
    { href: '/dashboard/help', label: 'คู่มือการใช้งาน', icon: BookOpen },
  ]
  if (isSuperAdmin) {
    footer.push({ href: '/admin', label: 'พอร์ทัล Super Admin', icon: ShieldAlert, tone: 'admin' })
  }

  return { main, footer }
}
