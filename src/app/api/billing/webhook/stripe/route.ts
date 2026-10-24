import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyStripeWebhook } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  return new NextResponse('Stripe Billing Webhook Endpoint Active', { status: 200 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = verifyStripeWebhook(rawBody, signature)
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const shopId = session.metadata?.shop_id
        const planKey = session.metadata?.plan_key
        if (!shopId || !planKey) break

        const { error } = await admin.rpc('apply_stripe_checkout_once', {
          p_event_id: event.id,
          p_shop_id: shopId,
          p_plan_key: planKey,
          p_amount: (session.amount_total || 0) / 100,
          p_currency: (session.currency || 'thb').toUpperCase(),
          p_session_id: session.id,
          p_subscription_id:
            typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null,
          p_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        })
        if (error) throw error
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const shopId = subscription.metadata?.shop_id
        if (!shopId) break

        const currentPeriodEnd = (subscription as any).current_period_end
        await admin
          .from('shops')
          .update({
            subscription_status: subscription.status,
            plan_expires_at: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shopId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const shopId = subscription.metadata?.shop_id
        if (!shopId) break

        // Do NOT downgrade plan_key immediately — shop keeps access until
        // plan_expires_at passes (checked by isOverQuota in salesAgentEngine.ts).
        await admin
          .from('shops')
          .update({ subscription_status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', shopId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof (invoice as any).subscription === 'string'
            ? (invoice as any).subscription
            : (invoice as any).subscription?.id

        const { data: shop } = await admin
          .from('shops')
          .select('id')
          .eq('subscription_id', subscriptionId)
          .maybeSingle()

        if (shop) {
          const { error } = await admin.rpc('apply_stripe_invoice_failed_once', {
            p_event_id: event.id,
            p_invoice_id: invoice.id,
            p_subscription_id: subscriptionId,
            p_amount: (invoice.amount_due || 0) / 100,
            p_currency: (invoice.currency || 'thb').toUpperCase(),
          })
          if (error) throw error
        }
        break
      }

      default:
        // Unrecognized event types are no-ops — Stripe convention is 200 OK.
        break
    }
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err)
    // Idempotent handlers are safe to retry. A 500 asks Stripe to send the event again
    // instead of dropping a payment that never got recorded.
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
