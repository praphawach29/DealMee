import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformBillingSettings } from './manualBilling'
import { pushToOwner } from './ownerAlerts'

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'

/** A shop that can carry platform alerts: it has a LINE OA and a linked admin LINE account */
export function canCarryAlerts(shop: Record<string, any>): boolean {
  const admin = shop.admin_line_user_id || shop.owner_line_id || shop.features?.admin_line_user_id || shop.features?.admin_notify_user_id
  return Boolean(shop.line_token && admin)
}

/**
 * LINE message to the platform owner, sent through the OA of the shop chosen in
 * /admin/payment-settings to that shop's linked admin. Skipped when none is chosen;
 * never throws, so a failed alert can't break the payment it reports.
 */
export async function notifyPlatformOwner(text: string, shopId?: string | null): Promise<boolean> {
  try {
    const id = shopId ?? (await getPlatformBillingSettings()).notify_shop_id
    if (!id) return false
    const { data: shop } = await createAdminClient().from('shops').select('*').eq('id', id).maybeSingle()
    if (!shop) return false
    return await pushToOwner(shop, text)
  } catch (err) {
    console.error('[PlatformAlerts] Failed:', err)
    return false
  }
}
