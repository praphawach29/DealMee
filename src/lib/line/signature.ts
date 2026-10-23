import { createHmac, timingSafeEqual } from 'crypto'

/** LINE X-Line-Signature: base64 HMAC-SHA256 of the raw body with the channel secret. */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (!signature || !secret) return false
  const cleanSecret = secret.trim()
  const cleanSignature = signature.trim()
  if (!cleanSecret || !cleanSignature) return false
  // Compare the base64 text itself. Decoding first would reject a valid LINE header
  // whenever the decoded byte length differed from the digest length check below.
  const hash = Buffer.from(createHmac('SHA256', cleanSecret).update(rawBody).digest('base64'))
  const given = Buffer.from(cleanSignature)
  return hash.length === given.length && timingSafeEqual(hash, given)
}
