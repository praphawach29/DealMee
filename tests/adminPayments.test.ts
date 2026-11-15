import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatPaymentRecord,
  buildPlatformLineDeepLinkAndQr,
  type RawPaymentRecord,
} from '../src/lib/admin/paymentsHelper.ts'

test('formatPaymentRecord resolves signed slip url and falls back to default shop name', () => {
  const record: RawPaymentRecord = {
    id: 'pay-1',
    shop_id: 'shop-1',
    plan_key: 'starter',
    amount: 590,
    currency: 'THB',
    status: 'pending',
    slip_url: 'storage/slips/slip1.jpg',
    created_at: '2026-11-01T00:00:00Z',
    shops: {
      name: 'Coffee Shop',
      bot_name: 'Barista Bot',
    },
  }

  const signedUrls = new Map([['storage/slips/slip1.jpg', 'https://signed.url/slip1.jpg']])
  const formatted = formatPaymentRecord(record, signedUrls)

  assert.equal(formatted.slip_url, 'https://signed.url/slip1.jpg')
  assert.equal(formatted.shop_name, 'Coffee Shop')
  assert.equal(formatted.shop_bot_name, 'Barista Bot')

  const noShopRecord: RawPaymentRecord = {
    id: 'pay-2',
    shop_id: 'shop-2',
    plan_key: 'wallet_topup',
    amount: 1000,
    currency: 'THB',
    status: 'pending',
    slip_url: null,
    created_at: '2026-11-01T00:00:00Z',
    shops: null,
  }
  const formattedNoShop = formatPaymentRecord(noShopRecord, signedUrls)
  assert.equal(formattedNoShop.shop_name, 'ไม่ระบุชื่อร้าน')
  assert.equal(formattedNoShop.slip_url, '')
})

test('buildPlatformLineDeepLinkAndQr generates correct LINE OA deep link and QR code data URL', async () => {
  const emptyRes = await buildPlatformLineDeepLinkAndQr(null, 'ABC12345')
  assert.equal(emptyRes.deepLink, null)
  assert.equal(emptyRes.qrDataUrl, null)

  const res = await buildPlatformLineDeepLinkAndQr('dealmeebot', 'ABC12345')
  assert.ok(res.deepLink?.includes('dealmeebot'))
  assert.ok(res.deepLink?.includes('%2Fadmin-link%20ABC12345'))
  assert.ok(res.qrDataUrl?.startsWith('data:image/png;base64,'))
})
