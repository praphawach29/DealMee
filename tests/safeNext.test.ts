import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAYGROUND_PATH,
  internalRedirectUrl,
  loginUrl,
  onboardingResumePath,
  pathAfterAuth,
  safeNextPath,
} from '../src/lib/auth/safeNext.ts'

const ORIGIN = 'https://www.dealmee.app'

test('playground deep link is an allowed same-app path', () => {
  assert.equal(safeNextPath(PLAYGROUND_PATH), '/dashboard?playground=1')
  assert.equal(internalRedirectUrl(ORIGIN, PLAYGROUND_PATH).href, `${ORIGIN}/dashboard?playground=1`)
})

test('auth resume paths stay on this app', () => {
  assert.equal(safeNextPath('/onboarding'), '/onboarding')
  assert.equal(safeNextPath('/reset-password'), '/reset-password')
  assert.equal(safeNextPath('/admin/shops'), '/admin/shops')
  assert.equal(safeNextPath('/dashboard/settings?tab=channels'), '/dashboard/settings?tab=channels')
  assert.equal(
    safeNextPath('/onboarding?next=%2Fdashboard%3Fplayground%3D1'),
    '/onboarding?next=/dashboard?playground=1',
  )
})

test('open redirects and traversal are replaced with the fallback', () => {
  const rejected = [
    'https://evil.com',
    'http://evil.com/dashboard',
    '//evil.com',
    '//evil.com/dashboard',
    '/\\evil.com',
    '/\\/evil.com',
    '/%2F%2Fevil.com',
    '/%5C%5Cevil.com',
    '/dashboard/%2e%2e/%2e%2e/login',
    '/dashboard/../../login',
    '/admin/../dashboard',
    '/dashboard@evil.com',
    'https://dealmee.app@evil.com',
    '/dashboard?next=https://evil.com',
    '/\\tevil.com',
    'javascript:alert(1)',
    '/%09/evil.com',
    '/login',
    '/terms',
    '',
    null,
    undefined,
  ]
  for (const value of rejected) {
    assert.equal(safeNextPath(value), '/dashboard', `expected fallback for ${value}`)
    assert.equal(internalRedirectUrl(ORIGIN, value).origin, ORIGIN)
    assert.equal(internalRedirectUrl(ORIGIN, value).pathname, '/dashboard')
  }
})

test('an empty fallback stays empty so a missing next is not invented', () => {
  assert.equal(safeNextPath('https://evil.com', ''), '')
  assert.equal(safeNextPath(null, ''), '')
})

test('login url keeps only a safe next', () => {
  assert.equal(loginUrl({ next: PLAYGROUND_PATH, mode: 'signup' }), '/login?next=%2Fdashboard%3Fplayground%3D1&mode=signup')
  assert.equal(loginUrl({ error: 'หมดอายุ', next: '//evil.com' }), '/login?error=%E0%B8%AB%E0%B8%A1%E0%B8%94%E0%B8%AD%E0%B8%B2%E0%B8%A2%E0%B8%B8')
  assert.equal(loginUrl(), '/login')
})

test('new merchants resume on the playground after onboarding', () => {
  assert.equal(
    pathAfterAuth({ hasShop: false, isSuperAdmin: false, requested: PLAYGROUND_PATH }),
    '/onboarding?next=%2Fdashboard%3Fplayground%3D1',
  )
  assert.equal(onboardingResumePath(PLAYGROUND_PATH), PLAYGROUND_PATH)
  assert.equal(onboardingResumePath('/onboarding?next=/dashboard'), '/dashboard')
  assert.equal(onboardingResumePath('https://evil.com'), '/dashboard')
})

test('signed-in merchants with a shop skip onboarding', () => {
  assert.equal(
    pathAfterAuth({ hasShop: true, isSuperAdmin: false, requested: PLAYGROUND_PATH }),
    PLAYGROUND_PATH,
  )
  assert.equal(pathAfterAuth({ hasShop: true, isSuperAdmin: false }), '/dashboard')
  assert.equal(pathAfterAuth({ hasShop: true, isSuperAdmin: true }), '/admin')
  assert.equal(
    pathAfterAuth({ hasShop: true, isSuperAdmin: true, requested: PLAYGROUND_PATH }),
    PLAYGROUND_PATH,
  )
})

test('super admins without a shop still reach admin unless they asked for the playground', () => {
  assert.equal(pathAfterAuth({ hasShop: false, isSuperAdmin: true }), '/admin')
  assert.equal(
    pathAfterAuth({ hasShop: false, isSuperAdmin: true, requested: PLAYGROUND_PATH }),
    '/onboarding?next=%2Fdashboard%3Fplayground%3D1',
  )
  assert.equal(
    pathAfterAuth({ hasShop: false, isSuperAdmin: false, requested: '//evil.com' }),
    '/onboarding?next=%2Fdashboard',
  )
})
