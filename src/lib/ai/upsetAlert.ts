import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'
import { notifyShopAdmin } from '@/lib/billing/ownerAlerts'
import {
  UPSET_THRESHOLD,
  cooldownOver,
  upsetAlertText,
  upsetProbability,
  upsetRequestBody,
  worthChecking,
} from '@/lib/ai/upsetSignal'

const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone'
const TIMEOUT_MS = 5000

/**
 * Alerts the shop admin on LINE when a customer message reads as upset (see upsetSignal.ts).
 * Opt-in per shop (features.upset_alert). Runs alongside the bot's own reply and never throws:
 * a missing key, a timeout or a TypeSafe error only means no alert.
 */
export async function alertIfUpset({
  shop,
  conversation,
  message,
}: {
  shop: Record<string, unknown> & { id?: string; name?: string | null; features?: Record<string, unknown> | null }
  conversation: { id: string; customer_name?: string | null; metadata?: Record<string, unknown> | null }
  message: string
}): Promise<void> {
  try {
    if (shop?.features?.upset_alert !== true || !worthChecking(message)) return
    if (!cooldownOver(conversation.metadata?.upset_alert_at)) return

    const key = await platformSecret('TYPESAFE_API_KEY')
    if (!key) return

    const res = await fetch(TYPESAFE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(upsetRequestBody(message, shop.name)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[UpsetAlert] TypeSafe returned ${res.status}:`, (await res.text()).slice(0, 200))
      return
    }
    const p = upsetProbability(await res.json())
    if (p === null || p < UPSET_THRESHOLD) return

    // Claim the cooldown before sending, re-reading metadata so other keys written meanwhile survive
    const admin = createAdminClient()
    const { data: fresh } = await admin.from('conversations').select('metadata').eq('id', conversation.id).single()
    const metadata = (fresh?.metadata as Record<string, unknown>) || {}
    if (!cooldownOver(metadata.upset_alert_at)) return
    await admin
      .from('conversations')
      .update({ metadata: { ...metadata, upset_alert_at: new Date().toISOString() } })
      .eq('id', conversation.id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'
    await notifyShopAdmin(shop, upsetAlertText(message, conversation.customer_name, `${appUrl}/dashboard/inbox`))
    console.log(`[UpsetAlert] Alerted shop ${shop.id} (p=${p.toFixed(2)}) for conversation ${conversation.id}`)
  } catch (err) {
    console.warn('[UpsetAlert] skipped:', err instanceof Error ? err.message : err)
  }
}
