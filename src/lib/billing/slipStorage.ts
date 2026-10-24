import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Top-up slips live in the private payment-slips bucket. billing_payments.slip_url holds the
 * object path (`<shop_id>/<timestamp>-<file>`); slips sent while the bucket was public hold the
 * old public URL instead, and both are turned into a short-lived signed link for the admin page.
 */
export const SLIP_BUCKET = 'payment-slips'

/** How long a signed slip link opens: long enough to review a page of payments */
const SIGNED_URL_SECONDS = 60 * 60

/** The object path inside the bucket, from either a stored path or an old public URL */
export function slipPath(stored: string | null | undefined): string | null {
  const value = String(stored || '').trim()
  if (!value) return null
  const marker = `/${SLIP_BUCKET}/`
  if (/^https?:\/\//i.test(value)) {
    const at = value.indexOf(marker)
    if (at < 0) return null
    return decodeURIComponent(value.slice(at + marker.length).split('?')[0])
  }
  return value
}

/** Signed links for each stored slip, keyed by the stored value. Missing or failed ones are left out. */
export async function signSlipUrls(
  admin: SupabaseClient,
  stored: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const byPath = new Map<string, string>()
  for (const value of stored) {
    const path = slipPath(value)
    if (path && value) byPath.set(path, value)
  }
  const signed = new Map<string, string>()
  if (byPath.size === 0) return signed

  const { data, error } = await admin.storage
    .from(SLIP_BUCKET)
    .createSignedUrls([...byPath.keys()], SIGNED_URL_SECONDS)
  if (error) {
    console.error('[SlipStorage] createSignedUrls failed:', error.message)
    return signed
  }
  for (const item of data || []) {
    const value = item.path ? byPath.get(item.path) : undefined
    if (value && item.signedUrl) signed.set(value, item.signedUrl)
  }
  return signed
}
