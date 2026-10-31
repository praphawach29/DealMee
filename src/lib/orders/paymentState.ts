/**
 * Whether an order has been paid, read from `orders.status` alone.
 *
 * Production's orders table has no `payment_status` column (the migration that adds it never
 * reached the live database; see supabase/schema/production.md). Code that selected it got an
 * error and no rows back, quietly: the QR payment reminder treated paid orders as unpaid and
 * nagged customers who had already transferred, and the bot couldn't report an order's status.
 * The slip flow records payment by setting status = 'paid', and later steps move it on to
 * shipped/delivered/completed, so status carries the answer.
 */
export const PAID_ORDER_STATUSES = ['paid', 'verified', 'shipped', 'delivered', 'completed'] as const

/** Statuses after which a payment reminder must not go out */
export const SETTLED_ORDER_STATUSES = [...PAID_ORDER_STATUSES, 'cancelled', 'canceled'] as const

export function isOrderPaid(status: string | null | undefined): boolean {
  return (PAID_ORDER_STATUSES as readonly string[]).includes(String(status || ''))
}

export function isOrderSettled(status: string | null | undefined): boolean {
  return (SETTLED_ORDER_STATUSES as readonly string[]).includes(String(status || ''))
}

/** Thai label for the payment part of an order, for the bot's answers */
export function orderPaymentLabel(status: string | null | undefined): string {
  if (isOrderPaid(status)) return 'ชำระแล้ว'
  if (status === 'cancelled' || status === 'canceled') return 'ยกเลิก'
  return 'รอชำระ'
}
