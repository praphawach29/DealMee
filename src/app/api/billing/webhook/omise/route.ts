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
    // Charge status was re-fetched from Omise above. The RPC claims this charge id
    // once and, when the plan is still active, extends from that expiry rather than from now.
    const { data, error } = await admin.rpc('apply_omise_charge_once', {
      p_shop_id: shopId,
      p_plan_key: planKey,
      p_charge_id: chargeId,
      p_amount: (charge.amount || 0) / 100,
      p_currency: (charge.currency || 'thb').toUpperCase(),
    })

    if (error) {
      console.error('[Omise Webhook] Could not apply charge:', error.message)
      return NextResponse.json({ error: 'apply failed' }, { status: 500 })
    }

    const applied = data as { applied?: boolean; reason?: string } | null
    if (applied && applied.applied === false && applied.reason && applied.reason !== 'duplicate' && applied.reason !== 'already_succeeded') {
      console.error('[Omise Webhook] Charge not applied:', chargeId, applied.reason)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Omise Webhook] Handler error:', err)
    return NextResponse.json({ received: true })
  }
}
