import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, test } from 'node:test'
import { signDocAcceptToken, verifyDocAcceptToken } from '../src/lib/docs/acceptToken.ts'
import { verifyFacebookSignature } from '../src/lib/facebook/messengerHelper.ts'
import { verifyLineSignature } from '../src/lib/line/signature.ts'

const DOC_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  process.env.DOC_ACCEPT_SECRET = 'test-accept-secret'
})

afterEach(() => {
  delete process.env.DOC_ACCEPT_SECRET
})

test('accept token matches only its document and rejects tampering or expiry', () => {
  const token = signDocAcceptToken(DOC_ID, 1_700_000_000_000)
  assert.equal(verifyDocAcceptToken(DOC_ID, token, 1_700_000_000_000).ok, true)
  assert.equal(verifyDocAcceptToken('22222222-2222-2222-2222-222222222222', token, 1_700_000_000_000).ok, false)

  const [exp, sig] = token.split('.')
  const flipped = `${exp}.${sig.slice(0, -1)}${sig.endsWith('a') ? 'b' : 'a'}`
  assert.deepEqual(verifyDocAcceptToken(DOC_ID, flipped, 1_700_000_000_000), { ok: false, reason: 'invalid' })

  const expired = signDocAcceptToken(DOC_ID, 1_000_000_000_000)
  assert.deepEqual(verifyDocAcceptToken(DOC_ID, expired, Date.now()), { ok: false, reason: 'expired' })
  assert.deepEqual(verifyDocAcceptToken(DOC_ID, null), { ok: false, reason: 'missing' })
})

test('accept token is rejected when the signing secret is unset', () => {
  delete process.env.DOC_ACCEPT_SECRET
  assert.throws(() => signDocAcceptToken(DOC_ID), /DOC_ACCEPT_SECRET/)
  assert.deepEqual(verifyDocAcceptToken(DOC_ID, '1.abc'), { ok: false, reason: 'unconfigured' })
})

test('LINE signature is required and must match the channel secret', () => {
  const body = '{"events":[]}'
  const secret = 'a'.repeat(32)
  const signature = createHmac('SHA256', secret).update(body).digest('base64')
  assert.equal(verifyLineSignature(body, signature, secret), true)
  assert.equal(verifyLineSignature(body, signature, ''), false)
  assert.equal(verifyLineSignature(body, '', secret), false)
  assert.equal(verifyLineSignature(body, signature, 'b'.repeat(32)), false)
  assert.equal(verifyLineSignature(body + ' ', signature, secret), false)
})

test('Facebook signature is rejected when the app secret is missing', () => {
  const body = '{"object":"page"}'
  const secret = 'fb-app-secret'
  const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  assert.equal(verifyFacebookSignature(body, signature, secret), true)
  assert.equal(verifyFacebookSignature(body, signature, ''), false)
  assert.equal(verifyFacebookSignature(body, signature, null), false)
  assert.equal(verifyFacebookSignature(body, null, secret), false)
  assert.equal(verifyFacebookSignature(body, 'sha256=deadbeef', secret), false)
})
