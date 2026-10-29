'use server'

import { createClient } from '@/utils/supabase/server'
import { restockOrder } from '@/lib/marketplace/inventoryManager'
import { cancelFollowUpTasks } from '@/lib/ai/proactiveFollowUp'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { shippedMessage } from '@/lib/orders/tracking'
import { normalizePlatform } from '@/types/omnichannel'

export async function createSampleOrder() {
  return { error: 'ออเดอร์ตัวอย่างถูกปิดใช้งานสำหรับร้านจริง เพื่อป้องกันยอดขายปลอม' }
}

/**
 * Saves the carrier and tracking number, marks the order shipped and, when asked,
 * sends them to the customer in the chat the order came from (LINE or Messenger).
 * Saving succeeds even when the message can't be sent; `notice` says why.
 */
export async function markOrderShipped(input: {
  orderId: string
  carrier: string
  trackingNo: string
  trackingUrl?: string
  notifyCustomer: boolean
}): Promise<{ success: true; notice: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) return { error: 'ไม่พบข้อมูลร้านค้า' }

  const trackingNo = input.trackingNo.trim()
  const carrier = input.carrier.trim()
  const trackingUrl = (input.trackingUrl || '').trim()
  if (!trackingNo) return { error: 'กรุณาใส่เลขพัสดุ' }
  if (!carrier) return { error: 'กรุณาเลือกขนส่ง' }
  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) return { error: 'ลิงก์ติดตามต้องขึ้นต้นด้วย http:// หรือ https://' }

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_no, conversation_id, shipped_at')
    .eq('id', input.orderId)
    .eq('shop_id', shop.id)
    .maybeSingle()
  if (!order) return { error: 'ไม่พบออเดอร์นี้' }

  const { error } = await supabase
    .from('orders')
    .update({
      tracking_no: trackingNo,
      tracking_carrier: carrier,
      tracking_url: trackingUrl || null,
      status: 'shipped',
      shipped_at: order.shipped_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard')

  if (!input.notifyCustomer) return { success: true, notice: 'บันทึกเลขพัสดุแล้ว' }
  if (!order.conversation_id) return { success: true, notice: 'บันทึกแล้ว แต่ไม่ได้ส่งให้ลูกค้า: ออเดอร์นี้ไม่ได้มาจากแชท' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, user_id, platform')
    .eq('id', order.conversation_id)
    .eq('shop_id', shop.id)
    .maybeSingle()
  if (!conv?.user_id) return { success: true, notice: 'บันทึกแล้ว แต่ไม่ได้ส่งให้ลูกค้า: ไม่พบแชทของออเดอร์นี้' }

  const text = shippedMessage({ order_no: order.order_no, tracking_no: trackingNo, tracking_carrier: carrier, tracking_url: trackingUrl })
  const platform = normalizePlatform(conv.platform)
  let sendError = ''

  if (platform === 'line') {
    const token = shop.line_token?.trim()
    if (!token) {
      sendError = 'ร้านยังไม่ได้ตั้งค่า LINE'
    } else {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: conv.user_id, messages: [{ type: 'text', text }] }),
      }).catch(() => null)
      if (!res?.ok) sendError = `LINE ตอบกลับ ${res?.status ?? 'ไม่ได้'}`
    }
  } else if (platform === 'facebook' || platform === 'instagram') {
    const token = shop.facebook_page_token?.trim()
    if (!token) {
      sendError = 'ร้านยังไม่ได้ตั้งค่า Facebook'
    } else {
      const { sendFacebookMessage } = await import('@/lib/facebook/messengerHelper')
      const res = await sendFacebookMessage(conv.user_id, text, token)
      if (!res.success) sendError = res.error || 'Facebook ส่งไม่สำเร็จ'
    }
  } else {
    sendError = 'ช่องทางนี้ยังส่งเลขพัสดุอัตโนมัติไม่ได้'
  }

  if (sendError) {
    console.error('[markOrderShipped] notify failed:', sendError)
    return { success: true, notice: `บันทึกแล้ว แต่ส่งให้ลูกค้าไม่สำเร็จ (${sendError}) แจ้งเลขพัสดุในกล่องข้อความได้` }
  }

  await supabase.from('chat_messages').insert({
    conversation_id: conv.id,
    shop_id: shop.id,
    sender_type: 'bot',
    sender_name: 'แจ้งจัดส่ง',
    message: text,
    platform,
  })
  return { success: true, notice: 'บันทึกแล้ว และส่งเลขพัสดุให้ลูกค้าในแชทแล้ว' }
}

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const supabase = await createClient()

  const { data: before } = await supabase
    .from('orders')
    .select('shop_id, order_no, status')
    .eq('id', orderId)
    .maybeSingle()

  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: error.message }

  // Cancelling an unpaid order gives back the stock it reserved and stops its reminders
  if (newStatus === 'cancelled' && before?.status === 'pending' && before.order_no && before.shop_id) {
    await restockOrder(before.shop_id, before.order_no)
    await cancelFollowUpTasks({ shopId: before.shop_id, referenceId: before.order_no, taskType: 'qr_recovery' })
  }

  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard')
  return { success: true }
}
