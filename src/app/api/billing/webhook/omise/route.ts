import { NextRequest, NextResponse } from 'next/server'
import { getCharge } from '@/lib/billing/omise'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  return new NextResponse('Omise Billing Webhook Endpoint Active', { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventKey = body?.key
    const chargeId = body?.data?.id

    if (!chargeId) {
      return NextResponse.json({ received: true })
    }

    // Never trust the webhook payload's status directly — always re-fetch
    // the charge from Omise's API, since Omise does not HMAC-sign webhooks.
    const charge = await getCharge(chargeId)
    if ('error' in charge) {
      console.error('[Omise Webhook] Could not verify charge:', charge.error)
      return NextResponse.json({ received: true })
    }

    if (charge.status !== 'successful') {
      console.log(`[Omise Webhook] Charge ${chargeId} not successful yet (status: ${charge.status}, event: ${eventKey})`)
      return NextResponse.json({ received: true })
    }

    const shopId = charge.metadata?.shop_id
    const planKey = charge.metadata?.plan_key
    if (!shopId || !planKey) {
      console.error('[Omise Webhook] Charge missing shop_id/plan_key metadata:', chargeId)
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await admin
      .from('shops')
      .update({
        plan_key: planKey,
        plan: planKey,
        package_name: planKey,
        subscription_provider: 'omise',
        subscription_id: null,
        subscription_status: 'active',
        plan_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId)

    await admin
      .from('billing_payments')
      .update({ status: 'succeeded' })
      .eq('provider_ref', chargeId)
      .eq('provider', 'omise')

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Omise Webhook] Handler error:', err)
    return NextResponse.json({ received: true })
  }
}
