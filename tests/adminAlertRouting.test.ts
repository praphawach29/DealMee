import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminLineRecipient, shouldSendAdminAlert } from '../src/lib/line/adminAlertRouting.ts'

test('admin LINE recipient follows the existing fallback order', () => {
  assert.equal(adminLineRecipient({ owner_line_id: 'owner-1' }), 'owner-1')
  assert.equal(adminLineRecipient({ features: { admin_line_user_id: 'feature-admin' } }), 'feature-admin')
  assert.equal(adminLineRecipient({}), null)
})

test('an alert is suppressed when the customer is the same LINE admin', () => {
  const shop = { owner_line_id: 'same-user' }
  assert.equal(shouldSendAdminAlert(shop, 'same-user'), false)
  assert.equal(shouldSendAdminAlert(shop, 'customer-2'), true)
  assert.equal(shouldSendAdminAlert(shop), true)
})
