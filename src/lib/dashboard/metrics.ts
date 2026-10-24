export type DashboardOrder = {
  id: string
  order_no: string
  customer_name: string
  total_amount: number
  status: string
  items_summary: string | null
  product_name: string | null
  quantity: string | number | null
  created_at: string
}

export type DashboardProduct = {
  id: string
  name: string
  price: number
  stock: number | null
  image_url: string | null
  category: string | null
}

export type PeriodPreset = '7' | '30' | '90' | 'year'

export type DateRange = { start: Date; end: Date }

export const LOW_STOCK_THRESHOLD = 5

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function rangeForPreset(preset: PeriodPreset, now = new Date()): { current: DateRange; previous: DateRange } {
  const end = endOfDay(now)
  const start =
    preset === '7'
      ? startOfDay(addDays(now, -6))
      : preset === '30'
        ? startOfDay(addDays(now, -29))
        : preset === '90'
          ? startOfDay(addDays(now, -89))
          : startOfDay(new Date(now.getFullYear(), 0, 1))
  return withPrevious({ start, end })
}

export function rangeForCustom(from: string, to: string): { current: DateRange; previous: DateRange } | null {
  if (!from || !to) return null
  const start = startOfDay(new Date(`${from}T00:00:00`))
  const end = endOfDay(new Date(`${to}T00:00:00`))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null
  return withPrevious({ start, end })
}

function withPrevious(current: DateRange): { current: DateRange; previous: DateRange } {
  const span = Math.max(0, current.end.getTime() - current.start.getTime())
  const prevEnd = new Date(current.start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - span)
  return { current, previous: { start: prevStart, end: prevEnd } }
}

export function inRange(iso: string, range: DateRange) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= range.start.getTime() && t <= range.end.getTime()
}

export function isOpenOrder(status: string | null | undefined) {
  return status !== 'cancelled'
}

export function isPaidOrder(status: string | null | undefined) {
  return status === 'paid' || status === 'shipped'
}

export function orderAmount(order: DashboardOrder) {
  const n = Number(order.total_amount || 0)
  return Number.isFinite(n) ? n : 0
}

export function orderQty(order: DashboardOrder) {
  const raw = typeof order.quantity === 'number' ? order.quantity : parseInt(String(order.quantity ?? ''), 10)
  if (Number.isFinite(raw) && raw > 0) return raw
  if (order.items_summary) {
    const parts = order.items_summary.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts.length
  }
  return order.product_name || order.items_summary ? 1 : 0
}

export function formatBaht(value: number) {
  return `฿${Math.round(value).toLocaleString('th-TH')}`
}

export function formatThaiDate(d: Date) {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatThaiRange(range: DateRange) {
  return `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}`
}

export type Delta = { label: string; tone: 'up' | 'down' | 'flat' | 'new' }

export function percentDelta(current: number, previous: number): Delta | null {
  if (current === 0 && previous === 0) return null
  if (previous === 0 && current > 0) return { label: 'ใหม่', tone: 'new' }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (pct === 0) return { label: '0%', tone: 'flat' }
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : 'down' }
}

export function ordersInRange(orders: DashboardOrder[], range: DateRange) {
  return orders.filter((order) => inRange(order.created_at, range))
}

export function countOrders(orders: DashboardOrder[]) {
  return orders.filter((order) => isOpenOrder(order.status)).length
}

export function sumRevenue(orders: DashboardOrder[]) {
  return orders.filter((order) => isPaidOrder(order.status)).reduce((sum, order) => sum + orderAmount(order), 0)
}

export function paidRate(orders: DashboardOrder[]) {
  const open = orders.filter((order) => isOpenOrder(order.status))
  if (open.length === 0) return 0
  const paid = open.filter((order) => isPaidOrder(order.status)).length
  return Math.round((paid / open.length) * 1000) / 10
}

export type ChartPoint = { label: string; current: number; previous: number }

export function salesSeries(orders: DashboardOrder[], current: DateRange, previous: DateRange): ChartPoint[] {
  const days = Math.max(
    1,
    Math.round((startOfDay(current.end).getTime() - startOfDay(current.start).getTime()) / 86400000) + 1,
  )
  const granularity: 'day' | 'week' | 'month' = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
  const currentBuckets = buckets(current.start, current.end, granularity)
  const previousBuckets = buckets(previous.start, previous.end, granularity)

  const add = (list: { start: Date; end: Date; total: number }[], order: DashboardOrder) => {
    if (!isPaidOrder(order.status)) return
    const t = new Date(order.created_at).getTime()
    if (Number.isNaN(t)) return
    const bucket = list.find((item) => t >= item.start.getTime() && t <= item.end.getTime())
    if (bucket) bucket.total += orderAmount(order)
  }

  for (const order of orders) {
    add(currentBuckets, order)
    add(previousBuckets, order)
  }

  const len = Math.max(currentBuckets.length, previousBuckets.length)
  return Array.from({ length: len }, (_, i) => ({
    label: currentBuckets[i]?.label ?? '',
    current: currentBuckets[i]?.total ?? 0,
    previous: previousBuckets[i]?.total ?? 0,
  }))
}

function buckets(start: Date, end: Date, granularity: 'day' | 'week' | 'month') {
  const out: { start: Date; end: Date; total: number; label: string }[] = []
  if (granularity === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      const bStart = cursor < start ? start : startOfDay(cursor)
      const bEnd = endOfDay(new Date(Math.min(end.getTime(), next.getTime() - 1)))
      out.push({
        start: bStart,
        end: bEnd,
        total: 0,
        label: cursor.toLocaleDateString('th-TH', { month: 'short' }),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return out
  }

  const step = granularity === 'week' ? 7 : 1
  let cursor = startOfDay(start)
  while (cursor <= end) {
    const bEndCandidate = endOfDay(addDays(cursor, step - 1))
    const bEnd = bEndCandidate > end ? end : bEndCandidate
    out.push({
      start: new Date(cursor),
      end: bEnd,
      total: 0,
      label: cursor.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
    })
    cursor = startOfDay(addDays(cursor, step))
  }
  return out
}

export type TopProduct = {
  name: string
  imageUrl: string | null
  revenue: number
  quantity: number
}

export function topProducts(orders: DashboardOrder[], products: DashboardProduct[], range: DateRange): TopProduct[] {
  const map = new Map<string, TopProduct>()
  for (const order of orders) {
    if (!isPaidOrder(order.status) || !inRange(order.created_at, range)) continue
    const attributed = attributeProduct(order, products)
    if (!attributed) continue
    const prev = map.get(attributed.name) || {
      name: attributed.name,
      imageUrl: attributed.imageUrl,
      revenue: 0,
      quantity: 0,
    }
    prev.revenue += orderAmount(order)
    prev.quantity += Math.max(1, orderQty(order))
    if (!prev.imageUrl && attributed.imageUrl) prev.imageUrl = attributed.imageUrl
    map.set(attributed.name, prev)
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 5)
}

function attributeProduct(order: DashboardOrder, products: DashboardProduct[]): { name: string; imageUrl: string | null } | null {
  const named = (order.product_name || '').trim()
  if (named) {
    const match = products.find((product) => product.name.trim() === named)
    return { name: named, imageUrl: match?.image_url || null }
  }
  const summary = (order.items_summary || '').trim()
  if (!summary) return null
  const hit = [...products].sort((a, b) => b.name.length - a.name.length).find((product) => product.name && summary.includes(product.name))
  if (hit) return { name: hit.name, imageUrl: hit.image_url }
  const first = summary.split(',')[0].replace(/\(.*?\)/g, '').replace(/x\s*\d+/gi, '').trim()
  if (!first) return null
  return { name: first, imageUrl: null }
}

export function lowStockProducts(products: DashboardProduct[]) {
  return products.filter((product) => product.stock != null && product.stock <= LOW_STOCK_THRESHOLD)
}

export function orderStatusMeta(status: string | null | undefined): {
  label: string
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'
} {
  switch (status) {
    case 'paid':
      return { label: 'ชำระแล้ว', tone: 'success' }
    case 'shipped':
      return { label: 'จัดส่งแล้ว', tone: 'info' }
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', tone: 'danger' }
    case 'pending':
    default:
      return { label: 'รอชำระเงิน', tone: 'warning' }
  }
}

export function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
