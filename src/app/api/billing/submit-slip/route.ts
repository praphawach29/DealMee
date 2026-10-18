import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { readSlipQr } from '@/lib/slip/readSlipQr'
import {
  getPlatformBillingSettings,
  verifySlipWithEasySlip,
} from '@/lib/billing/manualBilling'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 })
    }

    const shop = await getOrCreateShopForUser(supabase, user)
    if (!shop?.id) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลร้านค้า' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('slip') as File | null
    const planKey = (formData.get('planKey') as string) || 'pro'
    const billedAmount = parseFloat((formData.get('billedAmount') as string) || '0')
    const withheldAmount = parseFloat((formData.get('withheldAmount') as string) || '0')
    const transferredAmount = parseFloat((formData.get('transferredAmount') as string) || '0')
    const customerNotes = (formData.get('customerNotes') as string) || ''

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'กรุณาแนบรูปภาพสลิปการโอนเงิน' }, { status: 400 })
    }

    if (transferredAmount <= 0) {
      return NextResponse.json({ error: 'ยอดเงินที่โอนต้องมากกว่า 0 บาท' }, { status: 400 })
    }

    // 1. Convert file to Buffer and base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // 2. Upload file to Supabase Storage (payment-slips bucket)
    const admin = createAdminClient()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${shop.id}/${Date.now()}-${safeFileName}`

    const { error: uploadError } = await admin.storage
      .from('payment-slips')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      })

    let slipUrl = ''
    if (!uploadError) {
      const { data: publicUrlData } = admin.storage
        .from('payment-slips')
        .getPublicUrl(filePath)
      slipUrl = publicUrlData.publicUrl
    }

    // 3. Check EasySlip if key exists
    let autoVerified = false
    let verifiedReceiptNo: string | null = null
    let slipRef: string | null = null
    let easySlipMessage = ''

    const hasSlipApiKey = process.env.EASYSLIP_API_KEY || process.env.THUNDER_API_KEY || process.env.SLIPOK_API_KEY
    if (hasSlipApiKey) {
      const easySlipResult = await verifySlipWithEasySlip(base64, mimeType)

      if (easySlipResult.success && easySlipResult.data) {
        const slipData = easySlipResult.data
        // The slip's own mini-QR is the fallback when the provider returns no reference
        slipRef = slipData.transRef || slipData.ref1 || (await readSlipQr(base64))?.transRef || null
        const slipAmount = Number(slipData.amount?.amount || 0)

        // Validate amount (allow small rounding delta of 1 THB)
        const expectedAmount = withheldAmount > 0 ? transferredAmount : billedAmount
        const isAmountMatch = Math.abs(slipAmount - expectedAmount) <= 1.0

        // Check if receiver matches platform settings
        const platformSettings = await getPlatformBillingSettings()
        const cleanPromptPay = platformSettings.promptpay_id.replace(/[^0-9]/g, '')
        const receiverAccount = (slipData.receiver?.account?.value || '').replace(/[^0-9]/g, '')
        const receiverName = slipData.receiver?.displayName || ''

        const isReceiverMatch =
          !cleanPromptPay ||
          receiverAccount.includes(cleanPromptPay.slice(-4)) ||
          (platformSettings.account_name &&
            receiverName.toLowerCase().includes(platformSettings.account_name.toLowerCase()))

        if (isAmountMatch && isReceiverMatch && !slipRef) {
          // Without a reference the duplicate check below can't run, so a person must look
          easySlipMessage = 'สลิปไม่มีเลขอ้างอิงธุรกรรม รอแอดมินตรวจสอบ'
        } else if (isAmountMatch && isReceiverMatch) {
          autoVerified = true
        } else {
          easySlipMessage = !isAmountMatch
            ? `ยอดเงินในสลิป (฿${slipAmount}) ไม่ตรงกับยอดที่ระบุ (฿${expectedAmount})`
            : 'ชื่อหรือเลขบัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีของระบบ'
        }
      } else {
        easySlipMessage = easySlipResult.message || 'ไม่สามารถอ่านข้อมูลสลิปได้'
      }
    }

    // 4. Record payment in billing_payments
    // Check if duplicate slip_reference exists
    if (slipRef) {
      const { data: existingRef } = await admin
        .from('billing_payments')
        .select('id, status, receipt_number')
        .eq('slip_reference', slipRef)
        .neq('status', 'rejected')
        .maybeSingle()

      if (existingRef) {
        return NextResponse.json(
          {
            error:
              'สลิปโอนเงินนี้เคยถูกใช้งานในระบบแล้ว กรุณาตรวจสอบหรือใช้สลิปการโอนเงินใหม่นะคะ',
          },
          { status: 400 }
        )
      }
    }

    // Insert pending payment
    const { data: newPayment, error: insertError } = await admin
      .from('billing_payments')
      .insert({
        shop_id: shop.id,
        provider: 'promptpay',
        plan_key: planKey,
        amount: transferredAmount,
        billed_amount: billedAmount,
        withheld_amount: withheldAmount,
        transferred_amount: transferredAmount,
        currency: 'THB',
        status: 'pending',
        slip_url: slipUrl,
        slip_reference: slipRef,
        customer_notes: customerNotes + (easySlipMessage ? ` [EasySlip Info: ${easySlipMessage}]` : ''),
      })
      .select('id')
      .single()

    if (insertError || !newPayment?.id) {
      console.error('[SubmitSlip] Insert error:', insertError)
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกข้อมูลการชำระเงินได้: ' + (insertError?.message || '') },
        { status: 500 }
      )
    }

    // 5. If Auto-verified, trigger verify_manual_payment RPC
    if (autoVerified) {
      const { data: verifyResult, error: verifyError } = await admin.rpc(
        'verify_manual_payment',
        {
          p_payment_id: newPayment.id,
          p_admin_id: null,
        }
      )

      if (!verifyError && verifyResult?.success) {
        verifiedReceiptNo = verifyResult.receipt_number
        return NextResponse.json({
          success: true,
          autoVerified: true,
          paymentId: newPayment.id,
          receiptNumber: verifiedReceiptNo,
          message: 'ชำระเงินและตรวจสอบสลิปสำเร็จ! ระบบได้เปิดใช้งานแพ็กเกจให้คุณทันที 🎉',
        })
      }
    }

    // 6. Otherwise, remains pending for admin review
    return NextResponse.json({
      success: true,
      autoVerified: false,
      paymentId: newPayment.id,
      pendingReview: true,
      message:
        withheldAmount > 0
          ? 'บันทึกข้อมูลและสลิปการโอนเงิน (หัก ณ ที่จ่าย 3%) เรียบร้อยแล้ว แอดมินกำลังตรวจสอบยอดเงินและออกใบเสร็จให้ค่ะ'
          : 'บันทึกสลิปเรียบร้อยแล้ว อยู่ในคิวรอตรวจสอบ แอดมินจะดำเนินการอนุมัติให้อย่างรวดเร็วค่ะ',
    })
  } catch (err: any) {
    console.error('[SubmitSlip] Error:', err)
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการประมวลผลสลิป' },
      { status: 500 }
    )
  }
}
