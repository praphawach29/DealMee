import { createAdminClient } from '@/lib/supabase/admin'
import { salesAutomationEnabled } from '@/lib/billing/trial'
import { notifyShopAdmin } from '@/lib/billing/ownerAlerts'
import { cancelFollowUpTasks, scheduleRepurchaseFollowUp } from '@/lib/ai/proactiveFollowUp'
import { extractGoldenTrajectoryFromOrder } from '@/lib/ai/salesTrajectory'
import { claimSlipCheck } from '@/lib/billing/planLimits'
import { verifySlip, checkSlipReceiver, resolveSlipProviderAndKey } from './verifySlip'
import { readSlipQr, type SlipQr } from './readSlipQr'

const BILLING_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'}/dashboard/billing`

export type SlipPlatform = 'line' | 'facebook' | 'instagram'

export interface SettleSlipInput {
  shop: Record<string, any>
  shopId: string
  platform: SlipPlatform
  /** Platform user id (LINE userId / Messenger PSID) */
  userId: string
  image: { base64: string; mimeType: string }
  /** Platform reference for the image, kept in the order note (e.g. LINE message id) */
  imageRef: string
  /** Sends a text message to the customer on their own channel */
  sendToCustomer: (text: string) => Promise<void>
}

/**
 * Handles an image a customer sent: verifies it as a payment slip and, when every
 * check passes, marks the customer's pending order paid. Anything that can't be
 * confirmed automatically goes to the shop admin; nothing is ever marked paid on
 * a partial match. Shared by the LINE and Facebook/Instagram webhooks.
 *
 * Checks, in order: the order belongs to this customer, the amount matches, the
 * money went to the shop's own account, and the slip hasn't settled another order.
 */
export async function settleSlipImage(input: SettleSlipInput): Promise<void> {
  const { shop, shopId, platform, userId, image, imageRef, sendToCustomer } = input
  const supabase = createAdminClient()
  const botName = (shop.bot_name && !/botify/i.test(shop.bot_name)) ? shop.bot_name : 'น้อง DealMee'

  const { data: convRows } = await supabase
    .from('conversations')
    .select('id, customer_name')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
  const conv = convRows?.[0] || null
  const customerLabel = conv?.customer_name || userId

  const logCustomerImage = async (detail = '') => {
    if (!conv?.id) return
    await supabase.from('chat_messages').insert({
      conversation_id: conv.id, shop_id: shopId, sender_type: 'user', sender_name: 'ลูกค้า',
      message: `[ลูกค้าส่งรูปภาพ${detail}]`, platform,
    })
  }

  const replyAndLog = async (text: string) => {
    await sendToCustomer(text)
    if (conv?.id) {
      await supabase.from('chat_messages').insert({
        conversation_id: conv.id, shop_id: shopId, sender_type: 'bot', sender_name: botName, message: text, platform,
      })
    }
  }

  // Read from the slip's own mini-QR further down, before any paid check
  let slipQr: SlipQr | null = null

  // A slip that couldn't be confirmed automatically goes to a human: tell the customer
  // it's being checked and alert the shop admin, but never mark anything paid.
  const sendToManualReview = async (reason: string, orderNo?: string) => {
    await replyAndLog(`ได้รับสลิปแล้วค่ะ 🙏 ระบบยังยืนยันอัตโนมัติไม่ได้ (${reason})\nแอดมินจะตรวจสอบและแจ้งกลับโดยเร็วที่สุดนะคะ`)
    await notifyShopAdmin(shop, `⚠️ สลิปรอตรวจสอบ\nลูกค้า: ${customerLabel}\n${orderNo ? `ออเดอร์: ${orderNo}\n` : ''}${slipQr ? `เลขอ้างอิงสลิป: ${slipQr.transRef}\n` : ''}เหตุผล: ${reason}\nกรุณาตรวจสอบใน Inbox ก่อนยืนยันออเดอร์`)
  }

  const notPaymentReply = 'ได้รับรูปภาพแล้วค่ะ 😊 ถ้าสนใจสินค้าในรูป พิมพ์บอกชื่อสินค้าหรือรายละเอียดเพิ่มได้เลยนะคะ\nถ้าเป็นสลิปโอนเงิน แอดมินจะตรวจสอบและแจ้งกลับให้ค่ะ 🙏'

  // Free plan (incl. ended trials): slips go to the admin without automatic checks
  if (!salesAutomationEnabled(shop)) {
    await logCustomerImage()
    await replyAndLog('ได้รับรูปภาพแล้วค่ะ 🙏 แอดมินจะตรวจสอบและแจ้งกลับให้โดยเร็วนะคะ')
    await notifyShopAdmin(shop, `📷 ลูกค้า ${customerLabel} ส่งรูปภาพ/สลิปเข้ามา กรุณาตรวจสอบใน Inbox\n(แพ็กเกจ Free: ระบบตรวจสลิปอัตโนมัติยังไม่เปิดใช้งาน — อัปเกรดเพื่อให้บอทตรวจสลิปและยืนยันออเดอร์ให้อัตโนมัติ)`)
    return
  }

  // Only this customer's own pending order may be settled by their slip
  let pendingOrder: any = null
  if (conv?.id) {
    const { data: ords } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', shopId)
      .eq('conversation_id', conv.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
    pendingOrder = ords?.[0] || null
  }

  // Free local pre-check: Thai bank slips carry a mini-QR with the transaction reference
  slipQr = await readSlipQr(image.base64)
  console.log('[SlipVerify] Slip QR:', slipQr ? JSON.stringify(slipQr) : 'none')

  // No slip QR and no order waiting for payment: almost always a product photo or a
  // question, so answer it without spending a paid slip check
  if (!slipQr && !pendingOrder) {
    await logCustomerImage()
    await replyAndLog(notPaymentReply)
    return
  }

  // A slip that already settled an order is refused before the paid check runs
  if (slipQr) {
    const used = await findSlipUse(shopId, slipQr.transRef)
    if (used) {
      await logCustomerImage(' — สลิปที่เคยใช้แล้ว')
      await replyAndLog(`❌ สลิปนี้ถูกใช้ยืนยันออเดอร์ ${used.orderNo || 'อื่น'} ไปแล้วค่ะ กรุณาส่งสลิปของการโอนครั้งนี้นะคะ 🙏`)
      await notifyShopAdmin(shop, `⚠️ มีการส่งสลิปซ้ำ\nลูกค้า: ${customerLabel}\nสลิปเคยใช้กับ: ${used.orderNo || '-'}\nส่งมาอีกครั้งสำหรับ: ${pendingOrder?.order_no || '-'}`)
      return
    }
  }

  // Checks on the platform's provider key count against the plan's monthly slip
  // allowance, then slip add-on packs; a shop using its own key isn't counted
  const shopSlipSettings = shop?.features?.slip_verification
  if (!resolveSlipProviderAndKey(shopSlipSettings).isShopCustomKey && (await claimSlipCheck(shop)) === 'none') {
    await logCustomerImage(' — รอแอดมินตรวจสลิป')
    await replyAndLog('ได้รับสลิปแล้วค่ะ 🙏 แอดมินจะตรวจสอบและยืนยันออเดอร์ให้โดยเร็วที่สุดนะคะ')
    await notifyShopAdmin(shop, `⚠️ สลิปรอตรวจสอบ\nลูกค้า: ${customerLabel}\n${pendingOrder ? `ออเดอร์: ${pendingOrder.order_no}\n` : ''}${slipQr ? `เลขอ้างอิงสลิป: ${slipQr.transRef}\n` : ''}เหตุผล: โควตาตรวจสลิปอัตโนมัติของร้านเดือนนี้หมดแล้ว\nซื้อแพ็กตรวจสลิปเพิ่มได้ที่ ${BILLING_URL}`)
    return
  }

  const expectedAmount = pendingOrder ? Number(pendingOrder.total_amount) : undefined
  const verifyResult = await verifySlip({
    imageBase64: image.base64,
    mimeType: image.mimeType,
    shopSettings: shopSlipSettings,
    expectedAmount,
  })
  console.log('[SlipVerify] Verification result:', JSON.stringify({ ...verifyResult, data: undefined }))

  // Keep a trace in the Inbox: the image itself isn't stored, so admins otherwise can't see it
  await logCustomerImage(verifyResult.success ? ` — สลิปยอด ${Number(verifyResult.amount || 0).toLocaleString('th-TH')} บาท` : '')

  // No order waiting for payment and the picture isn't a readable slip: most likely a
  // product photo or a question, so don't answer it as a failed payment
  if (!pendingOrder && (verifyResult.manualReview || !verifyResult.success)) {
    await replyAndLog(notPaymentReply)
    return
  }

  if (verifyResult.manualReview) {
    await sendToManualReview('ร้านยังไม่ได้ตั้งค่าระบบตรวจสลิปอัตโนมัติ', pendingOrder?.order_no)
    return
  }

  // Every provider was unreachable or erroring: that says nothing about the slip itself
  if (!verifyResult.success && (verifyResult.statusCode ?? 500) >= 500) {
    await sendToManualReview('ระบบตรวจสลิปขัดข้องชั่วคราว', pendingOrder?.order_no)
    return
  }

  if (!verifyResult.success) {
    const reason = verifyResult.rawMessage ?? 'ไม่สามารถอ่านข้อมูลสลิปได้'
    await replyAndLog(
      `❌ ตรวจสอบสลิปไม่สำเร็จค่ะ (${reason})\n\nกรุณาตรวจสอบ:\n• ถ่ายหน้าจอสลิปให้ชัดเจน ไม่ตัดขอบหรือ QR Code\n• ต้องเป็นสลิปโอนเงินจริงจากธนาคาร\n• ยอดเงินตรงกับยอดในออเดอร์\n\nหากท่านโอนเงินเรียบร้อยแล้ว สามารถแจ้งแอดมินให้ตรวจสอบได้เลยนะคะ 🙏`
    )
    return
  }

  const slipAmount = Number(verifyResult.amount || 0)
  const amountThai = slipAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })

  if (!pendingOrder) {
    await sendToManualReview(`ไม่พบออเดอร์ที่รอชำระของลูกค้ารายนี้ (ยอดในสลิป ${amountThai} บาท)`)
    return
  }

  // The slip must cover this order's total
  if (expectedAmount !== undefined && Math.abs(slipAmount - expectedAmount) > 1) {
    const expectedThai = expectedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })
    await replyAndLog(`❌ ยอดในสลิป (${amountThai} บาท) ไม่ตรงกับยอดออเดอร์ ${pendingOrder.order_no} (${expectedThai} บาท) ค่ะ\nรบกวนตรวจสอบยอดโอนอีกครั้ง หรือรอแอดมินติดต่อกลับนะคะ 🙏`)
    await notifyShopAdmin(shop, `⚠️ ยอดสลิปไม่ตรง\nออเดอร์: ${pendingOrder.order_no}\nยอดออเดอร์: ${expectedThai} บาท\nยอดในสลิป: ${amountThai} บาท`)
    return
  }

  // The money must have gone to this shop's own account
  const receiverCheck = checkSlipReceiver(verifyResult, [
    shop.promptpay_number, shop.payment_promptpay, shop.bank_account_number, shop.payment_bank_account,
  ])
  if (receiverCheck === 'mismatch') {
    await replyAndLog('❌ บัญชีผู้รับในสลิปไม่ตรงกับบัญชีของร้านค่ะ\nกรุณาตรวจสอบว่าโอนเข้าบัญชีร้านถูกต้อง หรือรอแอดมินติดต่อกลับนะคะ 🙏')
    await notifyShopAdmin(shop, `⚠️ สลิปโอนเข้าบัญชีอื่น\nออเดอร์: ${pendingOrder.order_no}\nผู้รับในสลิป: ${verifyResult.receiverName || '-'}`)
    return
  }
  if (receiverCheck === 'unknown') {
    await sendToManualReview('ตรวจบัญชีผู้รับอัตโนมัติไม่ได้', pendingOrder.order_no)
    return
  }

  // A slip can settle only one order
  const transRef = (verifyResult.transRef || slipQr?.transRef || '').trim()
  if (!transRef) {
    await sendToManualReview('สลิปไม่มีเลขอ้างอิงธุรกรรม', pendingOrder.order_no)
    return
  }
  const claim = await claimSlip({
    shopId, transRef, orderId: pendingOrder.id, orderNo: pendingOrder.order_no,
    provider: verifyResult.provider, amount: slipAmount, platform,
  })
  if (claim.status === 'used') {
    await replyAndLog(`❌ สลิปนี้ถูกใช้ยืนยันออเดอร์ ${claim.orderNo || 'อื่น'} ไปแล้วค่ะ กรุณาส่งสลิปของการโอนครั้งนี้นะคะ 🙏`)
    await notifyShopAdmin(shop, `⚠️ มีการส่งสลิปซ้ำ\nสลิปเคยใช้กับ: ${claim.orderNo || '-'}\nส่งมาอีกครั้งสำหรับ: ${pendingOrder.order_no}`)
    return
  }

  // Mark the order paid (only if it is still pending)
  const { data: updatedRows, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      note: (pendingOrder.note ? `${pendingOrder.note}\n` : '') +
        `[ตรวจสลิปผ่านโดย ${verifyResult.provider}]: ยอด ${amountThai} บ. [slip-ref:${transRef}] (${platform}-image:${imageRef})`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingOrder.id)
    .eq('status', 'pending')
    .select('id')

  if (updateError || !updatedRows || updatedRows.length === 0) {
    console.error('[SlipVerify] Could not mark order paid:', updateError)
    // Free the slip again so the admin (or a resend) can still use it for this order
    if (claim.status === 'claimed') {
      await supabase.from('payment_slips').delete().eq('shop_id', shopId).eq('trans_ref', transRef).eq('order_id', pendingOrder.id)
    }
    await sendToManualReview('บันทึกสถานะการชำระเงินไม่สำเร็จ', pendingOrder.order_no)
    return
  }

  await cancelFollowUpTasks({ shopId, referenceId: pendingOrder.order_no, taskType: 'qr_recovery' })

  // Follow-up messages are delivered over LINE only
  if (platform === 'line') {
    await scheduleRepurchaseFollowUp({
      shopId, userId, orderNumber: pendingOrder.order_no, productSummary: pendingOrder.product_name, daysDelay: 21,
    })
  }

  extractGoldenTrajectoryFromOrder({
    shopId, orderId: pendingOrder.id, conversationId: pendingOrder.conversation_id, revenue: slipAmount,
  }).catch((err) => console.error('[SalesTrajectory Error]:', err))

  await replyAndLog(
    `✅ ตรวจสอบสลิปสำเร็จค่ะ!\n` +
    `💰 ยอดโอน: ${amountThai} บาท\n` +
    `👤 ผู้รับ: ${verifyResult.receiverName || shop.promptpay_name || 'ร้านค้า'}\n` +
    (verifyResult.date ? `📅 วันที่: ${verifyResult.date} ${verifyResult.time || ''}\n` : '') +
    `📋 อ้างอิง: ${transRef}\n` +
    `📦 ออเดอร์: ${pendingOrder.order_no}` +
    `\n\nออเดอร์ได้รับการยืนยันเรียบร้อยแล้วค่ะ 🎉 ขอบพระคุณที่ใช้บริการนะคะ 🙏`
  )
  await notifyShopAdmin(shop, `💰 ลูกค้าชำระเงินแล้ว\nออเดอร์: ${pendingOrder.order_no}\nยอด: ${amountThai} บาท (ตรวจสลิปผ่าน${platform === 'line' ? '' : ` ทาง ${platform}`})`)
}

/**
 * Looks up whether a slip's transaction reference already settled an order, in
 * payment_slips or, for slips settled before that table existed, orders.note.
 */
async function findSlipUse(shopId: string, transRef: string): Promise<{ orderNo: string | null } | null> {
  const supabase = createAdminClient()
  const legacyOrderNo = await findLegacySlipOrder(shopId, transRef)
  if (legacyOrderNo) return { orderNo: legacyOrderNo }

  const { data: existing } = await supabase
    .from('payment_slips')
    .select('order_id')
    .eq('shop_id', shopId)
    .eq('trans_ref', transRef)
    .maybeSingle()
  if (!existing) return null
  return { orderNo: await orderNoFor(existing.order_id) }
}

async function findLegacySlipOrder(shopId: string, transRef: string): Promise<string | null> {
  const { data: legacy } = await createAdminClient()
    .from('orders')
    .select('order_no')
    .eq('shop_id', shopId)
    .ilike('note', `%[slip-ref:${transRef}]%`)
    .limit(1)
  return legacy?.[0]?.order_no || null
}

async function orderNoFor(orderId: string | null | undefined): Promise<string | null> {
  if (!orderId) return null
  const { data: ord } = await createAdminClient().from('orders').select('order_no').eq('id', orderId).maybeSingle()
  return ord?.order_no || null
}

/**
 * Reserves a slip's transaction reference for one order. The unique
 * (shop_id, trans_ref) index in payment_slips makes this safe against two
 * deliveries of the same slip racing each other. Slips settled before the table
 * existed are still found through the [slip-ref:...] tag in orders.note.
 */
async function claimSlip(args: {
  shopId: string; transRef: string; orderId: string; orderNo: string; provider: string; amount: number; platform: SlipPlatform
}): Promise<{ status: 'claimed' | 'untracked' } | { status: 'used'; orderNo: string | null }> {
  const supabase = createAdminClient()

  const legacyOrderNo = await findLegacySlipOrder(args.shopId, args.transRef)
  if (legacyOrderNo) return { status: 'used', orderNo: legacyOrderNo }

  const { error } = await supabase.from('payment_slips').insert({
    shop_id: args.shopId,
    trans_ref: args.transRef,
    order_id: args.orderId,
    provider: args.provider,
    amount: args.amount,
    platform: args.platform,
  })
  if (!error) return { status: 'claimed' }
  if (error.code === '23505') {
    const used = await findSlipUse(args.shopId, args.transRef)
    return { status: 'used', orderNo: used?.orderNo ?? null }
  }
  // Table missing or another database problem: the note check above still guards reuse
  console.warn('[SlipVerify] payment_slips insert failed, relying on order note check:', error.message)
  return { status: 'untracked' }
}
