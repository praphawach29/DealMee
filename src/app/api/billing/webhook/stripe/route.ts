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

        await admin
          .from('shops')
          .update({
            plan_key: planKey,
            plan: planKey,
            package_name: planKey,
            subscription_provider: 'stripe',
            subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
            subscription_status: 'active',
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shopId)

        await admin.from('billing_payments').insert({
          shop_id: shopId,
          provider: 'stripe',
          plan_key: planKey,
          amount: (session.amount_total || 0) / 100,
          currency: (session.currency || 'thb').toUpperCase(),
          status: 'succeeded',
          provider_ref: session.id,
        })
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
          await admin
            .from('shops')
            .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', shop.id)

          await admin.from('billing_payments').insert({
            shop_id: shop.id,
            provider: 'stripe',
            amount: (invoice.amount_due || 0) / 100,
            currency: (invoice.currency || 'thb').toUpperCase(),
            status: 'failed',
            provider_ref: invoice.id,
          })
        }
        break
      }

      default:
        // Unrecognized event types are no-ops — Stripe convention is 200 OK.
        break
    }
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err)
    // Still return 200 to avoid Stripe retry storms once signature is verified;
    // the underlying DB issue should be caught via server logs/alerting.
  }

  return NextResponse.json({ received: true })
}
