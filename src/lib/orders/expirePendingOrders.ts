import { createAdminClient } from '@/lib/supabase/admin'
import { restockOrder } from '@/lib/marketplace/inventoryManager'
import { cancelFollowUpTasks } from '@/lib/ai/proactiveFollowUp'

/** Default hours an unpaid order stays open; a shop can override with features.pending_order_expiry_hours */
export const DEFAULT_PENDING_ORDER_EXPIRY_HOURS = 24

/**
 * Cancels orders still pending past their shop's expiry window, returns the stock
 * they reserved and stops their payment reminders. Run from the follow-up cron.
 */
export async function expirePendingOrders(limit = 50): Promise<{ checked: number; expired: number }> {
  const supabase = createAdminClient()
  // Nothing can expire sooner than 1 hour, so only look at orders at least that old
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, shop_id, order_no, created_at, note')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (!orders || orders.length === 0) return { checked: 0, expired: 0 }

  const shopIds = [...new Set(orders.map((o: any) => o.shop_id).filter(Boolean))]
  const { data: shops } = await supabase.from('shops').select('id, features').in('id', shopIds)
  const expiryHours = new Map<string, number>()
  for (const s of shops || []) {
    const h = Number((s.features as Record<string, any>)?.pending_order_expiry_hours)
    expiryHours.set(s.id, Number.isFinite(h) && h >= 1 ? h : DEFAULT_PENDING_ORDER_EXPIRY_HOURS)
  }

  let expired = 0
  for (const order of orders as any[]) {
    const hours = expiryHours.get(order.shop_id) ?? DEFAULT_PENDING_ORDER_EXPIRY_HOURS
    if (Date.now() - new Date(order.created_at).getTime() < hours * 60 * 60 * 1000) continue

    // Conditional on still pending, so a payment that lands meanwhile wins
    const { data: updated } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        note: `${order.note ? `${order.note}\n` : ''}[ยกเลิกอัตโนมัติ: ไม่ได้ชำระภายใน ${hours} ชั่วโมง]`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'pending')
      .select('id')
    if (!updated || updated.length === 0) continue

    expired++
    if (order.order_no) {
      await restockOrder(order.shop_id, order.order_no)
      await cancelFollowUpTasks({ shopId: order.shop_id, referenceId: order.order_no, taskType: 'qr_recovery' })
    }
  }

  return { checked: orders.length, expired }
}
