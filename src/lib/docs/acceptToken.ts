import { createHmac, timingSafeEqual } from 'crypto'

/** Customer accept links stay valid for 30 days, then the shop must send a new one. */
export const DOC_ACCEPT_TTL_SECONDS = 30 * 24 * 60 * 60

function secret(): string | null {
  const value = process.env.DOC_ACCEPT_SECRET?.trim()
  return value || null
}

/**
 * HMAC token bound to one document id and an expiry (unix seconds).
 * Format: `<exp>.<base64url hmac of "docId.exp">`.
 */
export function signDocAcceptToken(docId: string, nowMs = Date.now()): string {
  const key = secret()
  if (!key) throw new Error('DOC_ACCEPT_SECRET is not configured')
  const exp = Math.floor(nowMs / 1000) + DOC_ACCEPT_TTL_SECONDS
  const sig = createHmac('sha256', key).update(`${docId}.${exp}`).digest('base64url')
  return `${exp}.${sig}`
}

export function trySignDocAcceptToken(docId: string, nowMs = Date.now()): string | null {
  try {
    return signDocAcceptToken(docId, nowMs)
  } catch {
    return null
  }
}

export type AcceptTokenResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'unconfigured' }

export function verifyDocAcceptToken(
  docId: string,
  token: string | null | undefined,
  nowMs = Date.now()
): AcceptTokenResult {
  const key = secret()
  if (!key) return { ok: false, reason: 'unconfigured' }
  if (!token || !token.trim()) return { ok: false, reason: 'missing' }

  const parts = token.trim().split('.')
  if (parts.length !== 2) return { ok: false, reason: 'invalid' }
  const [expRaw, sig] = parts
  if (!expRaw || !sig || !/^\d+$/.test(expRaw)) return { ok: false, reason: 'invalid' }

  const exp = Number(expRaw)
  const expected = createHmac('sha256', key).update(`${docId}.${exp}`).digest('base64url')
  const given = Buffer.from(sig)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return { ok: false, reason: 'invalid' }
  }
  if (exp * 1000 <= nowMs) return { ok: false, reason: 'expired' }
  return { ok: true }
}

/** Public document path. The token is what lets a customer open it without a shop session. */
export function documentViewPath(docId: string, kind: 'quotation' | 'official' = 'quotation'): string {
  const token = trySignDocAcceptToken(docId)
  const path = kind === 'official' ? `/doc/official/${docId}` : `/doc/quotation/${docId}`
  if (!token) return path
  return `${path}?accept=${encodeURIComponent(token)}`
}

export function documentDownloadPath(docId: string, format: 'docx' | 'xlsx' = 'docx'): string {
  const token = trySignDocAcceptToken(docId)
  const path = `/api/doc/${docId}/download?format=${format}`
  if (!token) return path
  return `${path}&accept=${encodeURIComponent(token)}`
}

/** Public quotation path that can approve the document. View-only when the secret is unset. */
export function quotationAcceptPath(docId: string): string {
  return documentViewPath(docId, 'quotation')
}
