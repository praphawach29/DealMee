/** Opens the signed-in merchant's real chat playground. Not the scripted landing sample. */
export const PLAYGROUND_PATH = '/dashboard?playground=1'

/** Set by the proxy so server layouts can keep this path across auth redirects. */
export const REQUEST_PATH_HEADER = 'x-dealmee-path'

const ALLOWED_ROOTS = ['/dashboard', '/onboarding', '/reset-password', '/admin'] as const

function decodePath(value: string): string | null {
  let current = value
  for (let i = 0; i < 2; i += 1) {
    if (!current.includes('%')) return current
    try {
      const next = decodeURIComponent(current)
      if (next === current) return current
      current = next
    } catch {
      return null
    }
  }
  return current
}

function parseSafePath(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 512) return null
  // A leading double slash is protocol-relative (`//evil.com`) and must not be joined onto our origin.
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (trimmed.includes('\\') || trimmed.includes('@')) return null

  const decoded = decodePath(trimmed)
  if (!decoded) return null
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null
  // Backslash, userinfo (`@`), and schemes survive some URL parsers as an off-site host.
  if (decoded.includes('\\') || decoded.includes('@') || decoded.includes('://')) return null
  if (/[\u0000-\u001F\u007F\s]/.test(decoded)) return null

  const hashless = decoded.split('#')[0]
  const queryAt = hashless.indexOf('?')
  const pathname = queryAt === -1 ? hashless : hashless.slice(0, queryAt)
  const query = queryAt === -1 ? '' : hashless.slice(queryAt + 1)

  if (!pathname || pathname.split('/').includes('..')) return null
  if (!/^\/[A-Za-z0-9/_.-]+$/.test(pathname)) return null
  if (query && /[\\@\s#]/.test(query)) return null
  if (!ALLOWED_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return null

  return query ? `${pathname}?${query}` : pathname
}

/**
 * Same-app path for post-login `next`. Anything else becomes `fallback`
 * (pass `''` when a missing destination should stay missing).
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  return parseSafePath(raw) ?? fallback
}

/** Absolute URL on `origin` for a safe path. Never points at another host. */
export function internalRedirectUrl(origin: string, raw: string | null | undefined, fallback = '/dashboard'): URL {
  const base = new URL(origin)
  const path = safeNextPath(raw, fallback)
  let url = new URL(path, base.origin)
  const normalized = `${url.pathname}${url.search}`
  if (url.origin !== base.origin || safeNextPath(normalized, '') !== normalized) {
    url = new URL(safeNextPath(fallback, '/dashboard'), base.origin)
  }
  return url
}

export function loginUrl(options?: { error?: string; next?: string | null; mode?: 'login' | 'signup' }): string {
  const params = new URLSearchParams()
  if (options?.error) params.set('error', options.error)
  const next = options?.next ? safeNextPath(options.next, '') : ''
  if (next) params.set('next', next)
  if (options?.mode) params.set('mode', options.mode)
  const qs = params.toString()
  return qs ? `/login?${qs}` : '/login'
}

/**
 * Where to send someone who just signed in. A shop is required before any
 * dashboard URL, including the playground deep link. Super admins keep /admin
 * unless they explicitly asked for the dashboard.
 */
export function pathAfterAuth(input: {
  hasShop: boolean
  isSuperAdmin: boolean
  requested?: string | null
}): string {
  const next = input.requested ? safeNextPath(input.requested, '') : ''

  if (!input.hasShop) {
    if (input.isSuperAdmin && !next.startsWith('/dashboard') && !next.startsWith('/reset-password')) {
      return '/admin'
    }
    if (next.startsWith('/reset-password') || next.startsWith('/onboarding')) return next
    const resume = next.startsWith('/dashboard') ? next : '/dashboard'
    return `/onboarding?next=${encodeURIComponent(resume)}`
  }

  if (next) return next
  return input.isSuperAdmin ? '/admin' : '/dashboard'
}

/** Page to open after the shop row exists. Never loops back into onboarding. */
export function onboardingResumePath(requested: string | null | undefined): string {
  const next = safeNextPath(requested, '')
  if (next.startsWith('/dashboard') || next.startsWith('/admin') || next.startsWith('/reset-password')) return next
  return '/dashboard'
}
