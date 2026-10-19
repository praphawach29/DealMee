import { pushPlatformLineAlert } from './platformLineAlerts'

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'

/**
 * LINE message to the platform owner through the platform's own LINE OA
 * (/admin/payment-settings). Skipped when it isn't set up; never throws, so a
 * failed alert can't break the payment it reports.
 */
export async function notifyPlatformOwner(text: string): Promise<boolean> {
  try {
    return await pushPlatformLineAlert(text)
  } catch (err) {
    console.error('[PlatformAlerts] Failed:', err)
    return false
  }
}
