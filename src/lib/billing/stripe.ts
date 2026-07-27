import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

let stripeClient: Stripe | null = null

/** Lazily creates the Stripe client. Throws a clear config error instead of silently mocking — never fake a paid upgrade. */
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Payment Gateway (Stripe) — กรุณาตั้งค่า STRIPE_SECRET_KEY')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }
  return stripeClient
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function createCheckoutSession(
  shop: { id: string; name?: string; stripe_customer_id?: string | null },
  planKey: string,
  ownerEmail?: string | null
): Promise<{ url: string } | { error: string }> {
  try {
    const stripe = getStripe()
    const admin = createAdminClient()

    const { data: plan } = await admin
      .from('plans')
      .select('key, name, price, stripe_price_id')
      .eq('key', planKey)
      .maybeSingle()

    if (!plan) {
      return { error: `ไม่พบแพ็กเกจ "${planKey}"` }
    }
    if (!plan.stripe_price_id) {
      return { error: `ยังไม่ได้ตั้งค่าราคาสำหรับแพ็กเกจ "${plan.name}" ใน Stripe กรุณาติดต่อทีมงาน` }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: shop.stripe_customer_id || undefined,
      customer_email: shop.stripe_customer_id ? undefined : ownerEmail || undefined,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${APP_URL}/dashboard/billing?success=1`,
      cancel_url: `${APP_URL}/dashboard/billing?canceled=1`,
      metadata: { shop_id: shop.id, plan_key: planKey },
      subscription_data: {
        metadata: { shop_id: shop.id, plan_key: planKey },
      },
    })

    if (!session.url) {
      return { error: 'ไม่สามารถสร้างหน้าชำระเงินได้ กรุณาลองใหม่อีกครั้ง' }
    }

    return { url: session.url }
  } catch (err: any) {
    console.error('[Stripe createCheckoutSession] Error:', err)
    return { error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Stripe' }
  }
}

export async function createPortalSession(
  shop: { stripe_customer_id?: string | null }
): Promise<{ url: string } | { error: string }> {
  try {
    if (!shop.stripe_customer_id) {
      return { error: 'ร้านค้านี้ยังไม่มีบัญชี Stripe กรุณาสมัครแพ็กเกจก่อน' }
    }
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: shop.stripe_customer_id,
      return_url: `${APP_URL}/dashboard/billing`,
    })
    return { url: session.url }
  } catch (err: any) {
    console.error('[Stripe createPortalSession] Error:', err)
    return { error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Stripe' }
  }
}

export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}
