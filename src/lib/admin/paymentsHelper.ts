import qrcode from 'qrcode'

export interface RawPaymentRecord {
  id: string
  shop_id: string
  plan_key: string
  amount: number
  billed_amount?: number | null
  withheld_amount?: number | null
  transferred_amount?: number | null
  currency: string
  status: 'pending' | 'verified' | 'rejected' | 'succeeded' | 'failed'
  slip_url?: string | null
  slip_reference?: string | null
  receipt_number?: string | null
  verified_at?: string | null
  verified_by?: string | null
  rejected_reason?: string | null
  customer_notes?: string | null
  created_at: string
  shops?: {
    name?: string | null
    bot_name?: string | null
  } | null
}

export function formatPaymentRecord(
  p: RawPaymentRecord,
  signedUrls: Map<string, string>
) {
  return {
    ...p,
    slip_url: p.slip_url ? signedUrls.get(p.slip_url) || '' : '',
    shop_name: p.shops?.name || 'ไม่ระบุชื่อร้าน',
    shop_bot_name: p.shops?.bot_name,
  }
}

export async function buildPlatformLineDeepLinkAndQr(
  botBasicId: string | null | undefined,
  linkCode: string
): Promise<{ deepLink: string | null; qrDataUrl: string | null }> {
  if (!botBasicId) {
    return { deepLink: null, qrDataUrl: null }
  }

  const deepLink = `https://line.me/R/oaMessage/@${botBasicId}/?${encodeURIComponent('/admin-link ' + linkCode)}`
  let qrDataUrl: string | null = null

  try {
    qrDataUrl = await qrcode.toDataURL(deepLink, {
      width: 280,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
  } catch (err) {
    console.error('[AdminPayments] Failed to generate QR code for deepLink:', err)
  }

  return { deepLink, qrDataUrl }
}

