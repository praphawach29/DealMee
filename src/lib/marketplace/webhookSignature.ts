import { createHmac, timingSafeEqual } from 'crypto'

function hmacHex(key: string, message: string): string {
  return createHmac('sha256', key).update(message).digest('hex')
}

function sameHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(given.trim().toLowerCase())
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * TikTok Shop signs each webhook with the app secret: the Authorization header
 * (no "Bearer") is the hex HMAC-SHA256 of the app key followed by the raw body.
 */
export function verifyTikTokShopSignature(
  rawBody: string,
  authorization: string | null,
  appKey: string,
  appSecret: string
): boolean {
  if (!authorization || !appKey || !appSecret) return false
  return sameHex(hmacHex(appSecret, appKey + rawBody), authorization)
}

/**
 * Shopee Open Platform signs each push with the partner key: the Authorization
 * header is the hex HMAC-SHA256 of "<callback URL>|<raw body>". The URL is the
 * one registered in the Shopee console, which may name a different host than
 * the one the request arrived on, so every plausible spelling is tried.
 */
export function verifyShopeePushSignature(
  rawBody: string,
  authorization: string | null,
  partnerKey: string,
  callbackUrls: string[]
): boolean {
  if (!authorization || !partnerKey) return false
  return [...new Set(callbackUrls.filter(Boolean))].some((url) =>
    sameHex(hmacHex(partnerKey, `${url}|${rawBody}`), authorization)
  )
}
