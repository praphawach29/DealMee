import { createAdminClient } from '@/lib/supabase/admin'
import generatePayload from 'promptpay-qr'
import qrcode from 'qrcode'

export interface PlatformBillingSettings {
  id: string
  account_name: string
  promptpay_id: string
  bank_name: string
  bank_account_number: string
  is_vat_registered: boolean
  payee_tax_id: string
  company_address: string
  company_phone: string
  company_email: string
  updated_at?: string
}

export interface EnhancedBillingPayment {
  id: string
  shop_id: string
  plan_key: string
  billed_amount: number
  withheld_amount: number
  transferred_amount: number
  amount: number
  currency: string
  provider: string
  status: 'pending' | 'verified' | 'rejected' | 'succeeded' | 'failed'
  slip_url?: string
  slip_reference?: string
  receipt_number?: string
  verified_at?: string
  verified_by?: string
  rejected_reason?: string
  customer_notes?: string
  created_at: string
  shop_name?: string
  shop_email?: string
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformBillingSettings = {
  id: 'default',
  account_name: 'DealMee Co., Ltd.',
  promptpay_id: '0812345678',
  bank_name: 'ธนาคารกสิกรไทย (KBANK)',
  bank_account_number: '123-4-56789-0',
  is_vat_registered: false,
  payee_tax_id: '0105567000000',
  company_address: 'อาคารดิจิทัลเทค ชั้น 12 ถนนสุขุมวิท คลองเตย กรุงเทพมหานคร 10110',
  company_phone: '02-000-0000',
  company_email: 'billing@dealmee.app',
}

/**
 * Fetch platform owner's billing settings from database
 */
export async function getPlatformBillingSettings(): Promise<PlatformBillingSettings> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('platform_billing_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return DEFAULT_PLATFORM_SETTINGS
    }

    let accountName = data.account_name || DEFAULT_PLATFORM_SETTINGS.account_name
    let companyEmail = data.company_email || DEFAULT_PLATFORM_SETTINGS.company_email

    // Ensure legacy Botify references are migrated to DealMee
    if (accountName && /botify/i.test(accountName)) {
      accountName = 'DealMee Co., Ltd.'
      admin.from('platform_billing_settings').update({ account_name: accountName }).eq('id', data.id).then()
    }
    if (companyEmail && /botify/i.test(companyEmail)) {
      companyEmail = 'billing@dealmee.app'
      admin.from('platform_billing_settings').update({ company_email: companyEmail }).eq('id', data.id).then()
    }

    return {
      id: data.id,
      account_name: accountName,
      promptpay_id: data.promptpay_id || DEFAULT_PLATFORM_SETTINGS.promptpay_id,
      bank_name: data.bank_name || DEFAULT_PLATFORM_SETTINGS.bank_name,
      bank_account_number: data.bank_account_number || DEFAULT_PLATFORM_SETTINGS.bank_account_number,
      is_vat_registered: Boolean(data.is_vat_registered),
      payee_tax_id: data.payee_tax_id || DEFAULT_PLATFORM_SETTINGS.payee_tax_id,
      company_address: data.company_address || DEFAULT_PLATFORM_SETTINGS.company_address,
      company_phone: data.company_phone || DEFAULT_PLATFORM_SETTINGS.company_phone,
      company_email: companyEmail,
      updated_at: data.updated_at,
    }
  } catch (err) {
    console.error('[ManualBilling] Error getting platform settings:', err)
    return DEFAULT_PLATFORM_SETTINGS
  }
}

/**
 * Generate PromptPay QR Code as base64 data URL
 */
export async function generatePromptPayQRImage(
  promptpayId: string,
  amount?: number
): Promise<{ payload: string; qrDataUrl: string }> {
  const sanitizedId = promptpayId.replace(/[^0-9]/g, '')
  const payload = generatePayload(sanitizedId, {
    amount: amount && amount > 0 ? Number(amount.toFixed(2)) : undefined,
  })

  const qrDataUrl = await qrcode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 380,
    color: {
      dark: '#1e1b4b', // deep indigo
      light: '#ffffff',
    },
  })

  return { payload, qrDataUrl }
}

/**
 * Call EasySlip API to verify slip
 */
export async function verifySlipWithEasySlip(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{
  success: boolean
  status: number
  data?: {
    transRef?: string
    date?: string
    time?: string
    amount?: { amount: number; local?: { amount: number } }
    sender?: { displayName?: string; account?: { value: string } }
    receiver?: { displayName?: string; account?: { value: string } }
    ref1?: string
  }
  message?: string
}> {
  try {
    const { verifySlip } = await import('@/lib/slip/verifySlip')
    const result = await verifySlip({ imageBase64, mimeType })
    if (result.success) {
      return {
        success: true,
        status: 200,
        data: {
          transRef: result.transRef,
          date: result.date,
          time: result.time,
          amount: { amount: result.amount || 0 },
          sender: { displayName: result.senderName },
          receiver: { displayName: result.receiverName, account: { value: result.receiverAccount || '' } },
          ref1: result.transRef,
        },
      }
    }
    return {
      success: false,
      status: result.statusCode || 400,
      message: result.rawMessage || 'ไม่สามารถตรวจสอบความถูกต้องของสลิปได้',
    }
  } catch (err: any) {
    console.error('[ManualBilling] verifySlip error:', err)
    return {
      success: false,
      status: 500,
      message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป',
    }
  }
}
