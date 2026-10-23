'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarRange,
  ChevronDown,
  ShoppingCart,
  Banknote,
  BadgePercent,
  PackageX,
  Plus,
  MessageSquare,
  Send,
  Megaphone,
} from 'lucide-react'
import ChatPlaygroundModal from './components/ChatPlaygroundModal'
import SetupChecklistCard, { type SetupChecklistItem } from './components/SetupChecklistCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MiniSparkline, SalesChart } from '@/components/dashboard/SalesChart'
import { DeltaPill, OrderStatusChip } from '@/components/dashboard/StatusChip'
import type { PushQuotaInfo } from '@/lib/billing/pushQuota'
import {
  type DashboardOrder,
  type DashboardProduct,
  type PeriodPreset,
  countOrders,
  formatBaht,
  formatThaiRange,
  formatWhen,
  lowStockProducts,
  orderQty,
  ordersInRange,
  paidRate,
  percentDelta,
  rangeForCustom,
  rangeForPreset,
  salesSeries,
  sumRevenue,
  topProducts,
} from '@/lib/dashboard/metrics'

export interface MerchantDashboardProps {
  shopName: string
  botName: string
  botStatus: string
  plan: string
  productsCount: number
  knowledgeCount: number
  ordersCount: number
  totalRevenue: number
  totalMessages: number
  latestKnowledgeTitle: string
  latestKnowledgeDate: string
  pushQuotaInfo?: PushQuotaInfo
  setupChecklist?: SetupChecklistItem[]
  orders?: DashboardOrder[]
  products?: DashboardProduct[]
}

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: '7', label: '7 วัน' },
  { id: '30', label: '30 วัน' },
  { id: '90', label: '90 วัน' },
  { id: 'year', label: 'ปีนี้' },
]

export default function MerchantDashboardClient({
  shopName,
  botName,
  botStatus,
  plan,
  productsCount,
  knowledgeCount,
  totalMessages,
  setupChecklist = [],
  pushQuotaInfo = {
    totalQuota: 300,
    usedCount: 0,
    remainingCount: 300,
    period: new Date().toISOString().slice(0, 7),
    planName: 'PRO',
  },
  orders = [],
  products = [],
}: MerchantDashboardProps) {
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false)
  const [preset, setPreset] = useState<PeriodPreset | 'custom'>('30')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rangeOpen, setRangeOpen] = useState(false)

  const ranges = useMemo(() => {
    if (preset === 'custom') {
      return rangeForCustom(customFrom, customTo) || rangeForPreset('30')
    }
    return rangeForPreset(preset)
  }, [preset, customFrom, customTo])

  const currentOrders = useMemo(() => ordersInRange(orders, ranges.current), [orders, ranges])
  const previousOrders = useMemo(() => ordersInRange(orders, ranges.previous), [orders, ranges])
  const orderCount = countOrders(currentOrders)
  const previousOrderCount = countOrders(previousOrders)
  const revenue = sumRevenue(currentOrders)
  const previousRevenue = sumRevenue(previousOrders)
  const rate = paidRate(currentOrders)
  const previousRate = paidRate(previousOrders)
  const series = useMemo(() => salesSeries(orders, ranges.current, ranges.previous), [orders, ranges])
  const leaders = useMemo(() => topProducts(orders, products, ranges.current), [orders, products, ranges])
  const lowStock = lowStockProducts(products)
  const latest = [...currentOrders].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5)
  const revenueDelta = percentDelta(revenue, previousRevenue)
  const active = botStatus === 'active'
  const usedPercentage = Math.min(100, Math.round((pushQuotaInfo.usedCount / Math.max(1, pushQuotaInfo.totalQuota)) * 100))
  const remainingPercentage = 100 - usedPercentage

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-on-surface">ภาพรวมร้านค้า</h1>
          <p className="mt-1 text-sm text-on-surface-variant">สรุปผลการดำเนินงาน และความเคลื่อนไหวล่าสุดของร้านคุณ · {shopName}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setRangeOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 text-sm font-medium text-on-surface shadow-card"
            >
              <CalendarRange className="h-4 w-4 text-primary" />
              <span className="truncate">{formatThaiRange(ranges.current)}</span>
              <ChevronDown className="h-4 w-4 text-outline" />
            </button>
            {rangeOpen && (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-outline-variant bg-white p-3 shadow-card">
                <p className="mb-2 text-xs font-semibold text-on-surface-variant">ช่วงวันที่</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-on-surface-variant">
                    จาก
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(event) => {
                        setCustomFrom(event.target.value)
                        setPreset('custom')
                      }}
                      className="mt-1 h-9 w-full rounded-lg border border-outline-variant px-2 text-sm text-on-surface"
                    />
                  </label>
                  <label className="text-xs text-on-surface-variant">
                    ถึง
                    <input
                      type="date"
                      value={customTo}
                      onChange={(event) => {
                        setCustomTo(event.target.value)
                        setPreset('custom')
                      }}
                      className="mt-1 h-9 w-full rounded-lg border border-outline-variant px-2 text-sm text-on-surface"
                    />
                  </label>
                </div>
                <button type="button" onClick={() => setRangeOpen(false)} className="mt-3 h-9 w-full rounded-xl bg-primary text-sm font-semibold text-white">
                  ใช้ช่วงนี้
                </button>
              </div>
            )}
          </div>

          <div className="inline-flex h-10 items-center rounded-xl bg-surface-container p-1">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreset(item.id)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold sm:text-sm ${
                  preset === item.id ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsPlaygroundOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-white px-3 text-sm font-semibold text-on-surface"
          >
            <MessageSquare className="h-4 w-4 text-primary" />
            ทดสอบสนทนา
          </button>
          <Link
            href="/dashboard/products"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            เพิ่มสินค้า
          </Link>
        </div>
      </div>

      <SetupChecklistCard items={setupChecklist} />

      <section className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white px-4 py-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <div>
              <p className="text-sm font-semibold text-on-surface">{active ? 'พนักงาน AI กำลังทำงาน' : 'พนักงาน AI หยุดพักชั่วคราว'}</p>
              <p className="text-xs text-on-surface-variant">
                {botName} · แพ็กเกจ {plan}
              </p>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3 sm:max-w-xl">
            <StripStat label="ข้อความตอบสะสม" value={totalMessages.toLocaleString('th-TH')} />
            <StripStat label="ออเดอร์ช่วงนี้" value={orderCount.toLocaleString('th-TH')} />
            <StripStat label="ยอดขายช่วงนี้" value={formatBaht(revenue)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <MiniSparkline values={series.map((point) => point.current)} />
          <div className="text-right">
            {revenueDelta ? <DeltaPill label={revenueDelta.label} tone={revenueDelta.tone} /> : <span className="text-xs text-outline">ยังไม่มียอดขาย</span>}
            <p className="mt-1 text-[11px] text-outline">เทียบช่วงก่อนหน้า</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-white p-4 shadow-card sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-semibold text-on-surface">ยอดขาย</h2>
            <p className="text-xs text-on-surface-variant">เทียบออเดอร์ที่ชำระแล้วหรือจัดส่งแล้ว กับช่วงก่อนหน้าเท่ากัน</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-primary" /> ช่วงนี้
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-slate-300" /> ช่วงก่อนหน้า
            </span>
          </div>
        </div>
        <SalesChart points={series} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={ShoppingCart}
          iconClass="bg-primary/10 text-primary"
          label="คำสั่งซื้อ"
          value={orderCount.toLocaleString('th-TH')}
          hint={`จากช่วงก่อนหน้า ${previousOrderCount.toLocaleString('th-TH')}`}
          delta={percentDelta(orderCount, previousOrderCount)}
        />
        <KpiCard
          icon={Banknote}
          iconClass="bg-emerald-50 text-emerald-600"
          label="ยอดขายรวม"
          value={formatBaht(revenue)}
          hint={`จากช่วงก่อนหน้า ${formatBaht(previousRevenue)}`}
          delta={revenueDelta}
        />
        <KpiCard
          icon={BadgePercent}
          iconClass="bg-sky-50 text-sky-600"
          label="อัตราชำระเงิน"
          value={`${rate}%`}
          hint={`จากช่วงก่อนหน้า ${previousRate}%`}
          delta={percentDelta(rate, previousRate)}
        />
        <KpiCard
          icon={PackageX}
          iconClass="bg-amber-50 text-amber-600"
          label="สินค้าใกล้หมด"
          value={`${lowStock.length.toLocaleString('th-TH')} รายการ`}
          hint={`สต็อกไม่เกิน 5 จากสินค้าทั้งหมด ${productsCount.toLocaleString('th-TH')} รายการ`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-card">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="font-heading text-base font-semibold">คำสั่งซื้อล่าสุด</h2>
            <Link href="/dashboard/orders" className="text-sm font-semibold text-primary">
              ดูทั้งหมด
            </Link>
          </header>
          {latest.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-sm text-on-surface-variant">ยังไม่มีคำสั่งซื้อในช่วงนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-on-surface-variant">
                  <tr className="border-y border-outline-variant">
                    <th className="px-5 py-2.5 font-medium">#คำสั่งซื้อ</th>
                    <th className="px-3 py-2.5 font-medium">ลูกค้า</th>
                    <th className="px-3 py-2.5 font-medium">สินค้า</th>
                    <th className="px-3 py-2.5 font-medium">ยอดชำระ</th>
                    <th className="px-3 py-2.5 font-medium">สถานะ</th>
                    <th className="px-5 py-2.5 font-medium">เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((order) => (
                    <tr key={order.id} className="border-b border-outline-variant/70 last:border-0">
                      <td className="px-5 py-3 font-medium text-on-surface">{order.order_no}</td>
                      <td className="px-3 py-3 text-on-surface-variant">{order.customer_name}</td>
                      <td className="px-3 py-3 text-on-surface-variant" title={order.items_summary || order.product_name || ''}>
                        {orderQty(order) > 0 ? `${orderQty(order)} รายการ` : '—'}
                      </td>
                      <td className="px-3 py-3 font-semibold">{formatBaht(Number(order.total_amount || 0))}</td>
                      <td className="px-3 py-3">
                        <OrderStatusChip status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-on-surface-variant">{formatWhen(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-card">
          <header className="flex items-center justify-between px-5 py-4">
            <h2 className="font-heading text-base font-semibold">สินค้าขายดี</h2>
            <Link href="/dashboard/products" className="text-sm font-semibold text-primary">
              ดูทั้งหมด
            </Link>
          </header>
          {leaders.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-sm text-on-surface-variant">ยังไม่มีข้อมูลสินค้าที่ขายได้ในช่วงนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-on-surface-variant">
                  <tr className="border-y border-outline-variant">
                    <th className="px-5 py-2.5 font-medium">สินค้า</th>
                    <th className="px-3 py-2.5 font-medium">ยอดขาย</th>
                    <th className="px-5 py-2.5 font-medium">จำนวนที่ขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((product, index) => (
                    <tr key={product.name} className="border-b border-outline-variant/70 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-xs font-semibold text-outline">{index + 1}</span>
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {product.name.slice(0, 1)}
                            </span>
                          )}
                          <span className="font-medium text-on-surface">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold">{formatBaht(product.revenue)}</td>
                      <td className="px-5 py-3 text-on-surface-variant">{product.quantity.toLocaleString('th-TH')} ชิ้น</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">โควต้า LINE Push</h2>
              <p className="text-xs text-on-surface-variant">
                แพ็กเกจ {pushQuotaInfo.planName} · {pushQuotaInfo.period} · ใช้ไป {pushQuotaInfo.usedCount.toLocaleString('th-TH')} จาก{' '}
                {pushQuotaInfo.totalQuota.toLocaleString('th-TH')}
              </p>
            </div>
          </div>
          <Link href="/dashboard/broadcast" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white">
            <Megaphone className="h-4 w-4" />
            ส่งบรอดแคสต์หาลูกค้า
          </Link>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full ${remainingPercentage > 50 ? 'bg-primary' : remainingPercentage > 15 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${Math.max(2, remainingPercentage)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          คงเหลือ {pushQuotaInfo.remainingCount.toLocaleString('th-TH')} ข้อความ ({remainingPercentage}%) · ตอบแชท AI ปกติไม่ถูกหักโควต้านี้
          {knowledgeCount > 0 ? ` · คลังความรู้ ${knowledgeCount.toLocaleString('th-TH')} รายการ` : ''}
        </p>
      </section>

      <ChatPlaygroundModal isOpen={isPlaygroundOpen} onClose={() => setIsPlaygroundOpen(false)} initialBotName={botName} />
    </div>
  )
}

function StripStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-outline">{label}</p>
      <p className="truncate text-sm font-bold text-on-surface">{value}</p>
    </div>
  )
}
