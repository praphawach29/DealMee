import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_ADMIN_PLANS,
  mapPlanRowToItem,
} from '../src/lib/admin/plansHelper.ts'

test('DEFAULT_ADMIN_PLANS contains expected predefined plans', () => {
  const keys = DEFAULT_ADMIN_PLANS.map((p) => p.key)
  assert.ok(keys.includes('free'))
  assert.ok(keys.includes('starter'))
  assert.ok(keys.includes('byok'))
  assert.ok(keys.includes('pro'))
  assert.ok(keys.includes('agency'))
})

test('mapPlanRowToItem safely converts raw DB rows with defaults', () => {
  const rawRow = {
    id: 'row-1',
    key: 'custom',
    name: 'Custom Tier',
    price: '990',
    messages: '2000',
    tokens: null,
    slips: 50,
    description: null,
    badge_color: null,
    features: ['Custom feature 1', 'Custom feature 2'],
    stripe_price_id: 'price_test123',
  }

  const item = mapPlanRowToItem(rawRow)
  assert.equal(item.id, 'row-1')
  assert.equal(item.price, 990)
  assert.equal(item.messages, 2000)
  assert.equal(item.tokens, 0)
  assert.equal(item.slips, 50)
  assert.equal(item.description, '')
  assert.equal(item.badge_color, 'bg-surface-container-high text-on-surface')
  assert.equal(item.features.length, 2)
  assert.equal(item.stripe_price_id, 'price_test123')
})
