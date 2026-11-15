import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { documentDownloadPath, documentViewPath } from '../src/lib/docs/acceptToken.ts'
import { redactLivePayment } from '../src/lib/live/redactLivePayment.ts'
import { overlayPath, signOverlayKey, verifyOverlayKey } from '../src/lib/live/overlayKey.ts'
import { facebookPageConflictMessage } from '../src/lib/shop/channelOwnership.ts'
import {
  documentReadable,
  exactlyOne,
  liveOverlayDecision,
  liveShopDecision,
  orderVisibleToShop,
} from '../src/lib/security/tenantScope.ts'

const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('shop A cannot see or place an order that belongs to shop B', () => {
  assert.equal(orderVisibleToShop(SHOP_A, { shop_id: SHOP_B, workspace_id: SHOP_B }), false)
  assert.equal(orderVisibleToShop(SHOP_A, { shop_id: SHOP_B, workspace_id: SHOP_A }), false)
  assert.equal(orderVisibleToShop(SHOP_A, { shop_id: SHOP_A, workspace_id: SHOP_B }), false)
  assert.equal(orderVisibleToShop(SHOP_A, { shop_id: SHOP_A, workspace_id: null }), true)
  assert.equal(orderVisibleToShop(SHOP_A, { shop_id: SHOP_A, workspace_id: SHOP_A }), true)
  assert.equal(orderVisibleToShop(null, { shop_id: SHOP_A }), false)
})

test('orders migration refuses split shop ids and does not rewrite rows', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261114000000_orders_tenant_isolation.sql', import.meta.url), 'utf8')
  assert.match(sql, /shop_id IS DISTINCT FROM workspace_id/)
  assert.match(sql, /No policies or rows were changed/)
  assert.match(sql, /workspace_id IS NULL OR workspace_id = shop_id/)
  assert.match(sql, /orders_select_own_shop/)
  assert.match(sql, /orders_insert_own_shop/)
  assert.match(sql, /orders_update_own_shop/)
  assert.match(sql, /orders tenant isolation applied successfully/)
  assert.doesNotMatch(sql, /DELETE FROM public\.orders/i)
  assert.doesNotMatch(sql, /UPDATE public\.orders/i)
  assert.doesNotMatch(sql, /OR \(workspace_id IN/)
  assert.doesNotMatch(sql, /FOR DELETE/)
})

test('a Facebook page id resolves to one shop, and duplicates stop the migration', () => {
  const shopA = { id: SHOP_A }
  const shopB = { id: SHOP_B }
  assert.equal(exactlyOne([shopA, shopB]), null)
  assert.equal(exactlyOne([]), null)
  assert.equal(exactlyOne(null), null)
  assert.deepEqual(exactlyOne([shopA]), shopA)

  const sql = readFileSync(new URL('../supabase/migrations/20261114010000_facebook_page_unique.sql', import.meta.url), 'utf8')
  assert.match(sql, /facebook page uniqueness stopped/)
  assert.match(sql, /No rows were changed/)
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS shops_facebook_page_id_key/)
  assert.match(sql, /facebook page uniqueness applied successfully/)
  assert.doesNotMatch(sql, /DELETE FROM public\.shops/i)
  assert.doesNotMatch(sql, /UPDATE public\.shops/i)

  assert.match(
    facebookPageConflictMessage({ code: '23505', message: 'duplicate key value violates unique constraint "shops_facebook_page_id_key"' }) || '',
    /1 เพจใช้ได้กับ 1 ร้าน/,
  )
  assert.equal(facebookPageConflictMessage({ code: '23505', message: 'other' }), null)

  const webhook = readFileSync(new URL('../src/app/api/webhook/facebook/route.ts', import.meta.url), 'utf8')
  assert.match(webhook, /exactlyOne/)
  assert.match(webhook, /\.limit\(2\)/)
  assert.doesNotMatch(webhook, /maybeSingle\(\)/)
})

test('shop A cannot read shop B live state or its PromptPay payload', () => {
  assert.deepEqual(liveShopDecision(SHOP_A, SHOP_B), { status: 403 })
  assert.deepEqual(liveShopDecision(SHOP_A, SHOP_A), { status: 'ok', shopId: SHOP_A })
  assert.deepEqual(liveShopDecision(SHOP_A, '  '), { status: 'ok', shopId: SHOP_A })
  assert.deepEqual(liveShopDecision(null, SHOP_B), { status: 401 })

  const state = {
    shop_id: SHOP_B,
    latest_cf_order: {
      id: 'ord',
      order_no: 'CF-1',
      username: 'buyer',
      product_name: 'item',
      basket_no: 1,
      quantity: 1,
      unit_price: 10,
      total_amount: 10,
      qr_data_url: 'data:image/png;base64,secret',
      promptpay_payload: '000201',
      created_at: '2026-11-14T00:00:00.000Z',
    },
  }
  const redacted = redactLivePayment(state)
  assert.equal(redacted.latest_cf_order?.order_no, 'CF-1')
  assert.equal(redacted.latest_cf_order?.qr_data_url, undefined)
  assert.equal(redacted.latest_cf_order?.promptpay_payload, undefined)
  assert.equal(state.latest_cf_order?.promptpay_payload, '000201')

  const route = readFileSync(new URL('../src/app/api/live/comment/route.ts', import.meta.url), 'utf8')
  assert.match(route, /liveShopDecision\(auth\.shopId/)
  assert.match(route, /redactLivePayment/)
  // The shop read must come from the session or a verified overlay key, never straight from the query.
  assert.doesNotMatch(route, /getLiveSessionState\(\s*(?:params|req\.nextUrl\.searchParams)\.get/)
  assert.match(route, /liveOverlayDecision\(params\.get\('shop_id'\), params\.get\('key'\), verifyOverlayKey\)/)
  const overlay = readFileSync(new URL('../src/app/live/overlay/[shop_id]/page.tsx', import.meta.url), 'utf8')
  assert.match(overlay, /shop\.id !== shop_id/)
  assert.match(overlay, /verifyOverlayKey\(shop_id, key\)/)
  assert.match(overlay, /redactLivePayment/)
})

test('shop A cannot open shop B documents without that document token', () => {
  assert.equal(documentReadable({ documentShopId: SHOP_B, sessionShopId: SHOP_A, tokenValid: false }), false)
  assert.equal(documentReadable({ documentShopId: SHOP_B, sessionShopId: SHOP_A, tokenValid: true }), true)
  assert.equal(documentReadable({ documentShopId: SHOP_A, sessionShopId: SHOP_A, tokenValid: false }), true)
  assert.equal(documentReadable({ documentShopId: SHOP_B, sessionShopId: null, tokenValid: false }), false)

  process.env.DOC_ACCEPT_SECRET = 'test-accept-secret'
  try {
    const view = documentViewPath('11111111-1111-4111-8111-111111111111', 'official')
    const download = documentDownloadPath('11111111-1111-4111-8111-111111111111', 'docx')
    assert.match(view, /^\/doc\/official\/11111111-1111-4111-8111-111111111111\?accept=/)
    assert.match(download, /^\/api\/doc\/11111111-1111-4111-8111-111111111111\/download\?format=docx&accept=/)
  } finally {
    delete process.env.DOC_ACCEPT_SECRET
  }

  const downloadRoute = readFileSync(new URL('../src/app/api/doc/[id]/download/route.ts', import.meta.url), 'utf8')
  const quotation = readFileSync(new URL('../src/app/doc/quotation/[id]/route.ts', import.meta.url), 'utf8')
  const official = readFileSync(new URL('../src/app/doc/official/[id]/route.ts', import.meta.url), 'utf8')
  assert.match(downloadRoute, /denyDocumentRead/)
  assert.match(quotation, /denyDocumentRead/)
  assert.match(official, /denyDocumentRead/)
})

test('evaluation metrics check the super-admin allowlist before the service role', () => {
  const source = readFileSync(new URL('../src/app/admin/evaluation/actions.ts', import.meta.url), 'utf8')
  const fn = source.slice(source.indexOf('export async function getEvaluationMetrics'))
  const checkAt = fn.indexOf('verifySuperAdmin')
  const adminAt = fn.indexOf('createAdminClient')
  assert.ok(checkAt >= 0 && adminAt > checkAt)
  assert.match(fn, /isSuperAdmin/)
})

test('the OBS overlay key opens only the shop it was signed for', () => {
  const old = { overlay: process.env.LIVE_OVERLAY_SECRET, doc: process.env.DOC_ACCEPT_SECRET }
  try {
    delete process.env.LIVE_OVERLAY_SECRET
    delete process.env.DOC_ACCEPT_SECRET
    // No secret: no key is issued and none verifies, so there is never a public unkeyed URL.
    assert.equal(signOverlayKey(SHOP_A), null)
    assert.equal(overlayPath(SHOP_A), null)
    assert.equal(verifyOverlayKey(SHOP_A, 'anything'), false)

    process.env.DOC_ACCEPT_SECRET = 'doc-secret-for-tests'
    const keyA = signOverlayKey(SHOP_A)
    assert.ok(keyA)
    assert.equal(verifyOverlayKey(SHOP_A, keyA), true)
    assert.equal(verifyOverlayKey(SHOP_B, keyA), false)
    assert.equal(verifyOverlayKey(SHOP_A, ''), false)
    assert.equal(verifyOverlayKey(SHOP_A, keyA!.slice(0, -1) + (keyA!.endsWith('A') ? 'B' : 'A')), false)
    assert.equal(overlayPath(SHOP_A), `/live/overlay/${SHOP_A}?key=${encodeURIComponent(keyA!)}`)

    // A dedicated secret takes over and revokes the keys signed with the fallback.
    process.env.LIVE_OVERLAY_SECRET = 'overlay-secret-for-tests'
    assert.equal(verifyOverlayKey(SHOP_A, keyA), false)
    assert.equal(verifyOverlayKey(SHOP_A, signOverlayKey(SHOP_A)), true)

    const valid = (shopId: string, key: string) => verifyOverlayKey(shopId, key)
    const keyNow = signOverlayKey(SHOP_A)!
    assert.deepEqual(liveOverlayDecision(SHOP_A, keyNow, valid), { status: 'ok', shopId: SHOP_A })
    assert.deepEqual(liveOverlayDecision(SHOP_B, keyNow, valid), { status: 403 })
    assert.deepEqual(liveOverlayDecision('', keyNow, valid), { status: 403 })
    assert.deepEqual(liveOverlayDecision(SHOP_B, '', valid), { status: 'session' })
  } finally {
    if (old.overlay === undefined) delete process.env.LIVE_OVERLAY_SECRET
    else process.env.LIVE_OVERLAY_SECRET = old.overlay
    if (old.doc === undefined) delete process.env.DOC_ACCEPT_SECRET
    else process.env.DOC_ACCEPT_SECRET = old.doc
  }
})

test('Live Studio hands out the keyed overlay URL for OBS', () => {
  const page = readFileSync(new URL('../src/app/dashboard/live-studio/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /overlayPath=\{overlayPath\(shop\.id\)\}/)
  const client = readFileSync(new URL('../src/app/dashboard/live-studio/LiveStudioClient.tsx', import.meta.url), 'utf8')
  assert.match(client, /\$\{window\.location\.origin\}\$\{overlayHref\}/)
  const overlayClient = readFileSync(new URL('../src/app/live/overlay/[shop_id]/LiveOverlayClient.tsx', import.meta.url), 'utf8')
  assert.match(overlayClient, /query\.set\('key', overlayKey\)/)
})
