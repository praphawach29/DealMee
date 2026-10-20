import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { readSlipQr } from '@/lib/slip/readSlipQr'
import { notifyPlatformOwner, APP_URL } from '@/lib/billing/platformAlerts'
import {
  getPlatformBillingSettings,
  isPlatformPromptPayConfigured,
  verifySlipWithEasySlip,
  WALLET_TOPUP_PLAN_KEY,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
} from '@/lib/billing/manualBilling'

/**
 * Wallet top-up by PromptPay transfer: the shop sends the slip, and a slip that
 * checks out (amount, our account, never used before) is approved on the spot,
 * crediting the wallet through verify_manual_payment. Anything else, and every
 * top-up with 3% withheld (which needs the withholding certificate), waits for
 * an admin in /admin/payments.
 */

export const runtime = 'nodejs'

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

    const platformSettings = await getPlatformBillingSettings()
    if (!isPlatformPromptPayConfigured(platformSettings)) {
      return NextResponse.json({ error: 'ระบบรับชำระเงินยังไม่เปิดใช้งาน กรุณาติดต่อทีมงาน DealMee' }, { status: 503 })
    }

    const formData = await req.formData()
    const file = formData.get('slip') as File | null
    const billedAmount = Math.round(parseFloat((formData.get('amount') as string) || '0') * 100) / 100
    const withholding = formData.get('withholding') === 'true'
    const customerNotes = (formData.get('customerNotes') as string) || ''

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'กรุณาแนบรูปภาพสลิปการโอนเงิน' }, { status: 400 })
    }

    if (!Number.isFinite(billedAmount) || billedAmount < MIN_TOPUP_AMOUNT || billedAmount > MAX_TOPUP_AMOUNT) {
      return NextResponse.json(
        { error: `ยอดเติมเงินต้องอยู่ระหว่าง ฿${MIN_TOPUP_AMOUNT.toLocaleString()} ถึง ฿${MAX_TOPUP_AMOUNT.toLocaleString()}` },
        { status: 400 }
      )
    }

    // Worked out here, not taken from the browser
    const withheldAmount = withholding ? Math.round(billedAmount * 3) / 100 : 0
    const transferredAmount = Math.round((billedAmount - withheldAmount) * 100) / 100

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

    const hasSlipApiKey =
      (await platformSecret('EASYSLIP_API_KEY')) || (await platformSecret('THUNDER_API_KEY')) || (await platformSecret('SLIPOK_API_KEY'))
    if (hasSlipApiKey) {
      const easySlipResult = await verifySlipWithEasySlip(base64, mimeType, [
        platformSettings.promptpay_id,
        platformSettings.bank_account_number,
      ])

      if (easySlipResult.success && easySlipResult.data) {
        const slipData = easySlipResult.data
        // The slip's own mini-QR is the fallback when the provider returns no reference
        slipRef = slipData.transRef || slipData.ref1 || (await readSlipQr(base64))?.transRef || null
        const slipAmount = Number(slipData.amount?.amount || 0)

        // Validate amount (allow small rounding delta of 1 THB)
        const expectedAmount = transferredAmount
        const isAmountMatch = Math.abs(slipAmount - expectedAmount) <= 1.0

        // Check if receiver matches platform settings
        const cleanPromptPay = platformSettings.promptpay_id.replace(/[^0-9]/g, '')
        const receiverAccount = (slipData.receiver?.account?.value || '').replace(/[^0-9]/g, '')
        const receiverName = slipData.receiver?.displayName || ''

        // The slip usually shows the bank account behind the PromptPay, so check every account number on it
        const isReceiverMatch =
          easySlipResult.receiverCheck === 'match' ||
          !cleanPromptPay ||
          receiverAccount.includes(cleanPromptPay.slice(-4)) ||
          (platformSettings.account_name &&
            receiverName.toLowerCase().includes(platformSettings.account_name.toLowerCase()))

        if (isAmountMatch && isReceiverMatch && !slipRef) {
          // Without a reference the duplicate check below can't run, so a person must look
          easySlipMessage = 'สลิปไม่มีเลขอ้างอิงธุรกรรม รอแอดมินตรวจสอบ'
        } else if (isAmountMatch && isReceiverMatch && withholding) {
          easySlipMessage = 'หัก ณ ที่จ่าย 3% รอแอดมินตรวจหนังสือรับรองการหักภาษี'
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
        plan_key: WALLET_TOPUP_PLAN_KEY,
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
        const balance = Number(verifyResult.balance || 0)
        after(() =>
          notifyPlatformOwner(
            `💰 เติมเงินสำเร็จ\nร้าน: ${shop.name || '-'}\nยอด: ${baht(billedAmount)}\nยอดคงเหลือในกระเป๋า: ${baht(balance)}\nใบเสร็จ: ${verifiedReceiptNo || '-'}`
          )
        )
        return NextResponse.json({
          success: true,
          autoVerified: true,
          paymentId: newPayment.id,
          receiptNumber: verifiedReceiptNo,
          balance: verifyResult.balance,
          message: `เติมเงินสำเร็จ ฿${billedAmount.toLocaleString('th-TH')} ยอดคงเหลือ ฿${Number(verifyResult.balance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} 🎉`,
        })
      }

      // The slip checked out but crediting failed: keep it for an admin and leave the reason on the payment
      const reason = verifyError?.message || 'verify_manual_payment did not succeed'
      console.error('[SubmitSlip] Auto-verify failed:', reason)
      easySlipMessage = 'สลิปถูกต้อง แต่ระบบเติมเงินเข้ากระเป๋าอัตโนมัติไม่สำเร็จ รอแอดมินอนุมัติ'
      await admin
        .from('billing_payments')
        .update({ customer_notes: `${customerNotes} [Auto-verify failed: ${reason}]`.trim() })
        .eq('id', newPayment.id)
    }

    // 6. Otherwise, remains pending for admin review
    after(() =>
      notifyPlatformOwner(
        `⏳ สลิปเติมเงินรอตรวจ\nร้าน: ${shop.name || '-'}\nยอด: ${baht(billedAmount)}${withheldAmount > 0 ? ` (หัก ณ ที่จ่าย ${baht(withheldAmount)})` : ''}\nเหตุผล: ${easySlipMessage || 'ระบบตรวจสลิปอัตโนมัติไม่ได้'}\nตรวจและอนุมัติ: ${APP_URL}/admin/payments`
      )
    )

    return NextResponse.json({
      success: true,
      autoVerified: false,
      paymentId: newPayment.id,
      pendingReview: true,
      message:
        withheldAmount > 0
          ? 'บันทึกสลิปเรียบร้อยแล้ว (หัก ณ ที่จ่าย 3%) เมื่อแอดมินได้รับหนังสือรับรองการหักภาษีและตรวจยอดแล้ว เงินจะเข้ากระเป๋าเต็มจำนวนค่ะ'
          : `บันทึกสลิปเรียบร้อยแล้ว อยู่ในคิวรอแอดมินตรวจสอบ${easySlipMessage ? ` (${easySlipMessage})` : ''} เงินจะเข้ากระเป๋าเมื่ออนุมัติค่ะ`,
    })
  } catch (err: any) {
    console.error('[SubmitSlip] Error:', err)
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการประมวลผลสลิป' },
      { status: 500 }
    )
  }
}
