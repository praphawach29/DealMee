import { createHmac, timingSafeEqual } from 'crypto'

/**
 * The OBS overlay runs in an OBS browser source, which has no DealMee login.
 * Its URL carries a key instead: an HMAC of the shop id, so only someone given
 * the URL from that shop's Live Studio can read that shop's live state. The
 * path shop id alone is not a credential.
 *
 * Signed with LIVE_OVERLAY_SECRET, or DOC_ACCEPT_SECRET when that is unset, so
 * the overlay works without a new environment variable. The "live-overlay:v1:"
 * prefix keeps these keys from ever matching a document token. Keys do not
 * expire (streamers paste the URL into OBS once); changing the secret, or the
 * version prefix, revokes every overlay URL.
 */

const KEY_PREFIX = 'live-overlay:v1:'

function secret(): string | null {
  return process.env.LIVE_OVERLAY_SECRET?.trim() || process.env.DOC_ACCEPT_SECRET?.trim() || null
}

export function signOverlayKey(shopId: string): string | null {
  const key = secret()
  const id = (shopId || '').trim()
  if (!key || !id) return null
  return createHmac('sha256', key).update(`${KEY_PREFIX}${id}`).digest('base64url')
}

export function verifyOverlayKey(shopId: string | null | undefined, supplied: string | null | undefined): boolean {
  const expected = signOverlayKey(shopId || '')
  const given = (supplied || '').trim()
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Overlay URL path for OBS. Null when no secret is configured, so no unkeyed public URL is ever handed out. */
export function overlayPath(shopId: string): string | null {
  const key = signOverlayKey(shopId)
  if (!key) return null
  return `/live/overlay/${shopId}?key=${encodeURIComponent(key)}`
}
