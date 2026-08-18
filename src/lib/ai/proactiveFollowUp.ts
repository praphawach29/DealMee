import { createAdminClient } from '@/lib/supabase/admin'

export interface FollowUpConfig {
  qr_recovery_enabled?: boolean
  qr_recovery_delay_mins?: number
  booking_reminder_enabled?: boolean
  repurchase_enabled?: boolean
  repurchase_delay_days?: number
}

export interface FollowUpTask {
  id: string
  shop_id: string
  conversation_id: string | null
  customer_user_id: string
  task_type: 'qr_recovery' | 'booking_reminder' | 'repurchase_check'
  reference_id: string | null
  trigger_at: string
  status: 'pending' | 'completed' | 'cancelled' | 'skipped' | 'failed'
  payload: Record<string, any>
  created_at: string
  executed_at?: string | null
  error_message?: string | null
}

/**
 * Schedule a QR Code / Payment Follow-up (15-30 mins after QR is issued)
 */
export async function scheduleQrFollowUp({
  shopId,
  conversationId,
  userId,
  orderNumber,
  amount,
  customerName,
  delayMinutes = 20,
}: {
  shopId: string
  conversationId?: string | null
  userId: string
  orderNumber: string
  amount: number
  customerName?: string
  delayMinutes?: number
}) {
  try {
    const supabase = createAdminClient()

    // 1. Check shop config
    const { data: shop } = await supabase
      .from('shops')
      .select('follow_up_config')
      .eq('id', shopId)
      .single()

    const config: FollowUpConfig = shop?.follow_up_config || {}
    if (config.qr_recovery_enabled === false) {
      return { success: false, reason: 'QR recovery disabled in shop config' }
    }

    const effectiveDelay = config.qr_recovery_delay_mins || delayMinutes
    const triggerAt = new Date(Date.now() + effectiveDelay * 60 * 1000).toISOString()

    // 2. Cancel any existing pending qr_recovery tasks for this order
    await cancelFollowUpTasks({ shopId, referenceId: orderNumber, taskType: 'qr_recovery' })

    // 3. Insert new follow-up task
    const { data, error } = await supabase
      .from('follow_up_tasks')
      .insert({
        shop_id: shopId,
        conversation_id: conversationId || null,
        customer_user_id: userId,
        task_type: 'qr_recovery',
        reference_id: orderNumber,
        trigger_at: triggerAt,
        status: 'pending',
        payload: {
          orderNumber,
          amount,
          customerName: customerName || 'คุณลูกค้า',
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ProactiveFollowUp] Error scheduling QR follow-up:', error)
      return { success: false, error: error.message }
    }

    return { success: true, taskId: data.id }
  } catch (err: any) {
    console.error('[ProactiveFollowUp] Exception scheduling QR follow-up:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Schedule Booking Reminders (24 hours and 3 hours before booking slot)
 */
export async function scheduleBookingReminder({
  shopId,
  conversationId,
  userId,
  bookingId,
  bookingDate,
  bookingTime,
  serviceName,
  customerName,
}: {
  shopId: string
  conversationId?: string | null
  userId: string
  bookingId: string
  bookingDate: string // YYYY-MM-DD
  bookingTime: string // HH:mm
  serviceName?: string
  customerName?: string
}) {
  try {
    const supabase = createAdminClient()

    const { data: shop } = await supabase
      .from('shops')
      .select('follow_up_config')
      .eq('id', shopId)
      .single()

    const config: FollowUpConfig = shop?.follow_up_config || {}
    if (config.booking_reminder_enabled === false) {
      return { success: false, reason: 'Booking reminders disabled in shop config' }
    }

    // Parse booking target datetime (Assume UTC+7 Thai Time)
    const bookingDateTimeStr = `${bookingDate}T${bookingTime}:00+07:00`
    const bookingTimeMs = new Date(bookingDateTimeStr).getTime()
    const now = Date.now()

    if (isNaN(bookingTimeMs)) {
      return { success: false, error: 'Invalid booking date/time format' }
    }

    const tasksToInsert: any[] = []

    // 1. Reminder 24h before
    const trigger24h = bookingTimeMs - 24 * 60 * 60 * 1000
    if (trigger24h > now) {
      tasksToInsert.push({
        shop_id: shopId,
        conversation_id: conversationId || null,
        customer_user_id: userId,
        task_type: 'booking_reminder',
        reference_id: bookingId,
        trigger_at: new Date(trigger24h).toISOString(),
        status: 'pending',
        payload: {
          bookingId,
          bookingDate,
          bookingTime,
          serviceName: serviceName || 'บริการ',
          customerName: customerName || 'คุณลูกค้า',
          reminderType: '24h',
        },
      })
    }

    // 2. Reminder 3h before
    const trigger3h = bookingTimeMs - 3 * 60 * 60 * 1000
    if (trigger3h > now) {
      tasksToInsert.push({
        shop_id: shopId,
        conversation_id: conversationId || null,
        customer_user_id: userId,
        task_type: 'booking_reminder',
        reference_id: bookingId,
        trigger_at: new Date(trigger3h).toISOString(),
        status: 'pending',
        payload: {
          bookingId,
          bookingDate,
          bookingTime,
          serviceName: serviceName || 'บริการ',
          customerName: customerName || 'คุณลูกค้า',
          reminderType: '3h',
        },
      })
    }

    if (tasksToInsert.length === 0) {
      return { success: true, count: 0, message: 'Booking time is too soon for scheduled reminders' }
    }

    const { error } = await supabase.from('follow_up_tasks').insert(tasksToInsert)
    if (error) {
      console.error('[ProactiveFollowUp] Error scheduling booking reminders:', error)
      return { success: false, error: error.message }
    }

    return { success: true, count: tasksToInsert.length }
  } catch (err: any) {
    console.error('[ProactiveFollowUp] Exception scheduling booking reminder:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Schedule a Re-purchase / Feedback Follow-up (14-30 days after completed purchase)
 */
export async function scheduleRepurchaseFollowUp({
  shopId,
  conversationId,
  userId,
  orderNumber,
  productSummary,
  customerName,
  daysDelay = 21,
}: {
  shopId: string
  conversationId?: string | null
  userId: string
  orderNumber: string
  productSummary?: string
  customerName?: string
  daysDelay?: number
}) {
  try {
    const supabase = createAdminClient()

    const { data: shop } = await supabase
      .from('shops')
      .select('follow_up_config')
      .eq('id', shopId)
      .single()

    const config: FollowUpConfig = shop?.follow_up_config || {}
    if (config.repurchase_enabled === false) {
      return { success: false, reason: 'Repurchase follow-up disabled in shop config' }
    }

    const effectiveDelay = config.repurchase_delay_days || daysDelay
    const triggerAt = new Date(Date.now() + effectiveDelay * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('follow_up_tasks')
      .insert({
        shop_id: shopId,
        conversation_id: conversationId || null,
        customer_user_id: userId,
        task_type: 'repurchase_check',
        reference_id: orderNumber,
        trigger_at: triggerAt,
        status: 'pending',
        payload: {
          orderNumber,
          productSummary: productSummary || 'สินค้า',
          customerName: customerName || 'คุณลูกค้า',
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ProactiveFollowUp] Error scheduling repurchase follow-up:', error)
      return { success: false, error: error.message }
    }

    return { success: true, taskId: data.id }
  } catch (err: any) {
    console.error('[ProactiveFollowUp] Exception scheduling repurchase follow-up:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Cancel pending follow-up tasks when conditions are fulfilled (e.g. customer paid or booking cancelled)
 */
export async function cancelFollowUpTasks({
  shopId,
  referenceId,
  taskType,
}: {
  shopId: string
  referenceId: string
  taskType?: 'qr_recovery' | 'booking_reminder' | 'repurchase_check'
}) {
  try {
    const supabase = createAdminClient()
    let query = supabase
      .from('follow_up_tasks')
      .update({ status: 'cancelled', executed_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .eq('reference_id', referenceId)
      .eq('status', 'pending')

    if (taskType) {
      query = query.eq('task_type', taskType)
    }

    const { error } = await query
    if (error) {
      console.error('[ProactiveFollowUp] Error cancelling follow-up tasks:', error)
    }
  } catch (err) {
    console.error('[ProactiveFollowUp] Exception cancelling tasks:', err)
  }
}

/**
 * Generate a personalized Thai follow-up message matching the shop's tone
 */
export function generateProactiveMessage({
  task,
  shop,
}: {
  task: FollowUpTask
  shop: { name: string; personality?: string }
}): string {
  const { payload } = task
  const shopName = shop.name || 'ทางร้าน'

  switch (task.task_type) {
    case 'qr_recovery': {
      const orderNo = payload.orderNumber ? `#${payload.orderNumber}` : ''
      const amount = payload.amount ? `${Number(payload.amount).toLocaleString('th-TH')} บาท` : ''
      return `สวัสดีค่ะคุณลูกค้า ${shopName} มาแจ้งเตือนนะคะ ตอนนี้ออเดอร์ ${orderNo} ${amount ? `ยอด ${amount}` : ''} ยังรอชำระอยู่นะคะ 📦\n\nทางร้านกำลังเตรียมแพ็กสินค้าพร้อมจัดส่งรอบวันนี้แล้วค่ะ หากโอนแล้วสามารถส่งรูปสลิปเข้ามาในห้องแชทนี้ได้เลยนะคะ หรือหากติดปัญหาตรงไหนแจ้งแอดมินได้เลยค่ะ ขอบคุณมากนะคะ 🙏✨`
    }

    case 'booking_reminder': {
      const service = payload.serviceName || 'บริการ'
      const date = payload.bookingDate || ''
      const time = payload.bookingTime || ''
      const is3h = payload.reminderType === '3h'

      if (is3h) {
        return `สวัสดีค่ะคุณลูกค้า ${shopName} ขอแจ้งเตือนนัดหมาย ${service} ในอีก 3 ชั่วโมงข้างหน้า (เวลา ${time} น.) นะคะ ⏰\n\nหากเดินทางมาถึงแล้วสามารถแจ้งเจ้าหน้าที่ได้เลยค่ะ แล้วพบกันนะคะ 😊`
      }

      return `สวัสดีค่ะคุณลูกค้า ${shopName} ขอแจ้งเตือนนัดหมาย ${service} ในวันพรุ่งนี้ วันที่ ${date} เวลา ${time} น. นะคะ 🗓️\n\nหากคุณลูกค้าต้องการเลื่อนเวลาหรือสอบถามข้อมูลเพิ่มเติม สามารถแจ้งแอดมินได้ตลอดเลยนะคะ ขอบคุณค่ะ 🙏`
    }

    case 'repurchase_check': {
      const product = payload.productSummary || 'สินค้า'
      return `สวัสดีค่ะคุณลูกค้า ${shopName} ขอสอบถามความพึงพอใจหน่อยนะคะ ไม่ทราบว่า ${product} ที่ได้รับไปเป็นอย่างไรบ้างคะ ใช้งานถูกใจไหมคะ? 🥰\n\nหากคุณลูกค้าสนใจสั่งซื้อเพิ่ม หรือต้องการสินค้ารอบใหม่ ทางร้านมีสิทธิ์พิเศษและส่วนลดสำหรับลูกค้าเก่ามอบให้เลยนะคะ สอบถามแอดมินได้ตลอดเลยค่ะ 💖`
    }

    default:
      return `สวัสดีค่ะคุณลูกค้า ${shopName} ยินดีให้บริการนะคะ หากมีคำถามหรือต้องการสอบถามเพิ่มเติม สามารถพิมพ์แจ้งแอดมินได้เลยค่ะ 🙏`
  }
}

/**
 * Process all due follow-up tasks and send LINE push messages
 */
export async function processDueFollowUpTasks(limit = 25): Promise<{
  processed: number
  sent: number
  cancelled: number
  failed: number
}> {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()

  // 1. Fetch pending tasks due for execution
  const { data: tasks, error } = await supabase
    .from('follow_up_tasks')
    .select('*')
    .eq('status', 'pending')
    .lte('trigger_at', nowIso)
    .order('trigger_at', { ascending: true })
    .limit(limit)

  if (error || !tasks || tasks.length === 0) {
    return { processed: 0, sent: 0, cancelled: 0, failed: 0 }
  }

  let sent = 0
  let cancelled = 0
  let failed = 0

  for (const task of tasks as FollowUpTask[]) {
    try {
      // 2. Fetch shop details with line token
      const { data: shop } = await supabase
        .from('shops')
        .select('id, name, line_token, follow_up_config, personality')
        .eq('id', task.shop_id)
        .single()

      if (!shop || !shop.line_token) {
        await supabase
          .from('follow_up_tasks')
          .update({ status: 'failed', error_message: 'Shop or LINE Token not found' })
          .eq('id', task.id)
        failed++
        continue
      }

      // 3. Pre-flight verification (Do not send if conditions no longer require it)
      if (task.task_type === 'qr_recovery' && task.reference_id) {
        const { data: order } = await supabase
          .from('orders')
          .select('payment_status')
          .eq('shop_id', task.shop_id)
          .eq('order_number', task.reference_id)
          .maybeSingle()

        if (order && (order.payment_status === 'paid' || order.payment_status === 'verified')) {
          await supabase
            .from('follow_up_tasks')
            .update({ status: 'cancelled', executed_at: nowIso, error_message: 'Order already paid' })
            .eq('id', task.id)
          cancelled++
          continue
        }
      }

      if (task.task_type === 'booking_reminder' && task.reference_id) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('status')
          .eq('shop_id', task.shop_id)
          .eq('id', task.reference_id)
          .maybeSingle()

        if (booking && (booking.status === 'cancelled' || booking.status === 'rejected')) {
          await supabase
            .from('follow_up_tasks')
            .update({ status: 'cancelled', executed_at: nowIso, error_message: 'Booking was cancelled' })
            .eq('id', task.id)
          cancelled++
          continue
        }
      }

      // 4. Generate message text
      const messageText = generateProactiveMessage({ task, shop })

      // 5. Send LINE push message
      const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${shop.line_token.trim()}`,
        },
        body: JSON.stringify({
          to: task.customer_user_id,
          messages: [{ type: 'text', text: messageText }],
        }),
      })

      if (!pushRes.ok) {
        const errText = await pushRes.text()
        console.error(`[ProactiveFollowUp] LINE Push failed for task ${task.id}:`, errText)
        await supabase
          .from('follow_up_tasks')
          .update({ status: 'failed', error_message: errText })
          .eq('id', task.id)
        failed++
        continue
      }

      // 6. Record message in chat_messages so it appears in Inbox
      if (task.conversation_id) {
        await supabase.from('chat_messages').insert({
          conversation_id: task.conversation_id,
          sender_type: 'bot',
          message: messageText,
        })

        await supabase
          .from('conversations')
          .update({
            last_message: messageText,
            last_message_at: nowIso,
          })
          .eq('id', task.conversation_id)
      }

      // 7. Mark task completed
      await supabase
        .from('follow_up_tasks')
        .update({
          status: 'completed',
          executed_at: nowIso,
        })
        .eq('id', task.id)

      sent++
    } catch (taskErr: any) {
      console.error(`[ProactiveFollowUp] Error processing task ${task.id}:`, taskErr)
      await supabase
        .from('follow_up_tasks')
        .update({ status: 'failed', error_message: taskErr.message })
        .eq('id', task.id)
      failed++
    }
  }

  return { processed: tasks.length, sent, cancelled, failed }
}
