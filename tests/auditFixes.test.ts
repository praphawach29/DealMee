import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { codCloseExample, codOrderRefusal, codPaymentRule, isCodPaymentMethod, shopCodEnabled } from '../src/lib/ai/codPolicy.ts'
import { isCacheableCustomerQuery, mayStoreResponseCache, responseCacheIdentity } from '../src/lib/ai/responseCachePolicy.ts'
import { backInStockStillWaitingMessage, restockIlikePattern } from '../src/lib/ai/restockMessage.ts'
import { isSampleOrderNo } from '../src/lib/orders/sampleOrders.ts'

test('COD is offered only when the shop enabled it', () => {
  assert.equal(shopCodEnabled({ cod_enabled: true }), true)
  assert.equal(shopCodEnabled({ cod_enabled: false }), false)
  assert.equal(shopCodEnabled({}), false)
  assert.equal(shopCodEnabled(null), false)
  assert.equal(isCodPaymentMethod('เก็บเงินปลายทาง'), true)
  assert.equal(isCodPaymentMethod('โอนพร้อมเพย์'), false)
  assert.match(String(codOrderRefusal({ cod_enabled: false }, 'เก็บปลายทาง')), /ไม่ได้เปิดเก็บเงินปลายทาง/)
  assert.ok(codOrderRefusal({ cod_enabled: false }, 'COD'))
  assert.equal(codOrderRefusal({ cod_enabled: true }, 'เก็บปลายทาง'), null)
  assert.equal(codOrderRefusal({ cod_enabled: false }, 'พร้อมเพย์'), null)
  assert.match(codPaymentRule(false), /ห้ามเสนอ/)
  assert.doesNotMatch(codCloseExample(false), /เก็บเงินปลายทาง/)
  assert.match(codCloseExample(true), /เก็บเงินปลายทาง/)
})

test('response cache stays inside one shop and skips price, stock, and order answers', () => {
  const left = responseCacheIdentity('shop-a', 'สวัสดีค่ะ')
  const right = responseCacheIdentity('shop-b', 'สวัสดีค่ะ')
  assert.equal(left.queryHash, right.queryHash)
  assert.notEqual(left.shopId, right.shopId)
  assert.equal(isCacheableCustomerQuery('สวัสดีค่ะ'), true)
  assert.equal(isCacheableCustomerQuery('เสื้อตัวนี้ราคาเท่าไหร่'), false)
  assert.equal(isCacheableCustomerQuery('ยังมีสต็อกไหม'), false)
  assert.equal(isCacheableCustomerQuery('ออเดอร์ของฉันถึงไหนแล้ว'), false)
  assert.equal(isCacheableCustomerQuery('เลข ORD-123456 สถานะอะไร'), false)
  assert.equal(mayStoreResponseCache({
    features: {},
    query: 'สวัสดีค่ะ',
    hasExplicitHistory: false,
    priorMessageCount: 1,
  }), true)
  assert.equal(mayStoreResponseCache({
    features: {},
    query: 'สวัสดีค่ะ',
    hasExplicitHistory: false,
    priorMessageCount: 4,
  }), false)
  assert.equal(mayStoreResponseCache({
    features: { shop_skills_enabled: true },
    query: 'สวัสดีค่ะ',
    hasExplicitHistory: false,
    priorMessageCount: 0,
  }), false)
})

test('sample order numbers are hidden and real bot orders are kept', () => {
  assert.equal(isSampleOrderNo('ORD-20260803-1001'), true)
  assert.equal(isSampleOrderNo('ORD-1234'), true)
  assert.equal(isSampleOrderNo('ORD-482913'), false)
  assert.equal(isSampleOrderNo('BK-482913'), false)
})

test('back-in-stock copy uses the product the customer asked for', () => {
  const text = backInStockStillWaitingMessage('กระเป๋าผ้า')
  assert.match(text, /กระเป๋าผ้า/)
  assert.doesNotMatch(text, /เสื้อยืด/)
  assert.equal(restockIlikePattern('เสื้อ,แดง%'), '%เสื้อ แดง%')
})

test('unreadable slip with a pending order alerts the shop admin', () => {
  const source = readFileSync(new URL('../src/lib/slip/settleSlip.ts', import.meta.url), 'utf8')
  const branch = source.slice(source.indexOf('if (!verifyResult.success)'))
  assert.match(branch, /pendingOrder/)
  assert.match(branch, /notifyShopAdmin/)
  const record = readFileSync(new URL('../src/lib/slip/recordSlipTransaction.ts', import.meta.url), 'utf8')
  assert.match(record, /สลิปนี้ถูกบันทึกไว้แล้ว/)
  const webhook = readFileSync(new URL('../src/app/api/webhook/[shop_id]/route.ts', import.meta.url), 'utf8')
  assert.match(webhook, /สลิปไม่ได้ถูกบันทึก/)
  assert.match(webhook, /slip_verification/)
})

test('sample shop seed cannot insert paid orders', () => {
  const source = readFileSync(new URL('../src/app/dashboard/products/actions.ts', import.meta.url), 'utf8')
  const fn = source.slice(source.indexOf('export async function seedSampleShopData'), source.indexOf('export async function syncMarketplaceProducts'))
  assert.match(fn, /ข้อมูลตัวอย่างถูกปิดใช้งาน/)
  assert.doesNotMatch(fn, /\.insert\(/)
})

test('BYOK validation does not put the key in the request URL', () => {
  const source = readFileSync(new URL('../src/app/api/shop/byok/validate/route.ts', import.meta.url), 'utf8')
  assert.match(source, /x-goog-api-key/)
  assert.doesNotMatch(source, /[?&]key=\$\{/)
  assert.match(source, /\[redacted\]/)
})
