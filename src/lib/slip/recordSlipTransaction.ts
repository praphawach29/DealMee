import { createAdminClient } from '@/lib/supabase/admin'
import { verifySlip } from '@/lib/slip/verifySlip'

export interface SlipTransactionResult {
  success: boolean
  transactionId?: string
  amount?: number
  ref?: string
  error?: string
}

/**
 * Read a slip from a LINE image message and create a transaction record.
 * Does NOT require a matching order — just records the payment evidence.
 */
export async function recordSlipTransaction({
  shopId,
  conversationId,
  messageId,
  lineToken,
  shopSettings,
}: {
  shopId: string
  conversationId?: string | null
  messageId: string
  lineToken: string
  shopSettings?: any
}): Promise<SlipTransactionResult> {
  try {
    const supabase = createAdminClient()

    // Download image from LINE
    const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken.trim()}` },
    })
    if (!imageRes.ok) {
      return { success: false, error: 'ไม่สามารถดาวน์โหลดรูปภาพได้' }
    }
    const imageBuffer = await imageRes.arrayBuffer()
    const base64 = Buffer.from(imageBuffer).toString('base64')

    // Verify slip (reads amount, ref, date, etc.)
    const result = await verifySlip({
      imageBase64: base64,
      shopSettings: shopSettings || {},
    })

    if (!result.success || !result.amount) {
      return { success: false, error: result.rawMessage || 'ไม่สามารถอ่านสลิปได้ กรุณาส่งรูปที่ชัดเจนขึ้น' }
    }

    // Create transaction record
    const { data: txn, error: insertErr } = await supabase
      .from('slip_transactions')
      .insert({
        shop_id: shopId,
        conversation_id: conversationId || null,
        amount: result.amount,
        trans_ref: result.transRef || null,
        trans_date: result.date ? new Date(result.date).toISOString() : null,
        sender_name: result.senderName || null,
        receiver_name: result.receiverName || null,
        bank: result.receiverAccount || null,
        source: 'line_photo',
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertErr || !txn) {
      console.error('[SlipTransaction] insert failed:', insertErr?.message)
      return { success: false, error: 'บันทึกข้อมูลไม่สำเร็จ' }
    }

    return {
      success: true,
      transactionId: txn.id,
      amount: result.amount,
      ref: result.transRef,
    }
  } catch (err: any) {
    console.error('[SlipTransaction] exception:', err)
    return { success: false, error: err.message || 'เกิดข้อผิดพลาด' }
  }
}
