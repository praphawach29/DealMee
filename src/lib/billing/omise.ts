import { createAdminClient } from '@/lib/supabase/admin'

const OMISE_API = 'https://api.omise.co'

function getAuthHeader(): string | null {
  const secretKey = process.env.OMISE_SECRET_KEY
  if (!secretKey) return null
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64')
}

/**
 * Creates a one-time Omise PromptPay charge for a shop's monthly plan fee.
 * Omise has no native recurring-subscription object like Stripe — the shop
 * owner must manually re-checkout before plan_expires_at each month
 * (Phase 3 TODO: email reminder before expiry).
 */
export async function createPromptPayCharge(
  shop: { id: string },
  planKey: string
): Promise<{ qrImageUrl: string; chargeId: string } | { error: string }> {
  const authHeader = getAuthHeader()
  if (!authHeader) {
    return { error: 'ยังไม่ได้ตั้งค่า Payment Gateway (Omise) — กรุณาตั้งค่า OMISE_SECRET_KEY' }
  }

  try {
    const admin = createAdminClient()
    const { data: plan } = await admin
      .from('plans')
      .select('key, name, price')
      .eq('key', planKey)
      .maybeSingle()

    if (!plan) {
      return { error: `ไม่พบแพ็กเกจ "${planKey}"` }
    }
    if (!plan.price || plan.price <= 0) {
      return { error: `แพ็กเกจ "${plan.name}" ไม่มีค่าใช้จ่าย ไม่ต้องชำระเงิน` }
    }

    const res = await fetch(`${OMISE_API}/charges`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(Math.round(plan.price * 100)), // satang
        currency: 'thb',
        'source[type]': 'promptpay',
        'metadata[shop_id]': shop.id,
        'metadata[plan_key]': planKey,
      }),
    })

    const charge = await res.json()

    if (!res.ok) {
      console.error('[Omise createPromptPayCharge] Error:', charge)
      return { error: charge.message || 'ไม่สามารถสร้างรายการชำระเงินได้' }
    }

    const qrImageUrl = charge.source?.scannable_code?.image?.download_uri
    if (!qrImageUrl) {
      return { error: 'ไม่สามารถสร้าง QR Code สำหรับชำระเงินได้' }
    }

    await admin.from('billing_payments').insert({
      shop_id: shop.id,
      provider: 'omise',
      plan_key: planKey,
      amount: plan.price,
      currency: 'THB',
      status: 'pending',
      provider_ref: charge.id,
    })

    return { qrImageUrl, chargeId: charge.id }
  } catch (err: any) {
    console.error('[Omise createPromptPayCharge] Exception:', err)
    return { error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Omise' }
  }
}

/**
 * Re-fetches a charge's authoritative status from Omise's API. Omise does not
 * HMAC-sign webhook payloads the way Stripe does — never trust a webhook
 * payload's status field directly, always re-verify via this call.
 */
export async function getCharge(chargeId: string): Promise<any | { error: string }> {
  const authHeader = getAuthHeader()
  if (!authHeader) {
    return { error: 'ยังไม่ได้ตั้งค่า Payment Gateway (Omise) — กรุณาตั้งค่า OMISE_SECRET_KEY' }
  }

  try {
    const res = await fetch(`${OMISE_API}/charges/${chargeId}`, {
      headers: { Authorization: authHeader },
    })
    const charge = await res.json()
    if (!res.ok) {
      console.error('[Omise getCharge] Error:', charge)
      return { error: charge.message || 'ไม่สามารถตรวจสอบสถานะการชำระเงินได้' }
    }
    return charge
  } catch (err: any) {
    console.error('[Omise getCharge] Exception:', err)
    return { error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Omise' }
  }
}
