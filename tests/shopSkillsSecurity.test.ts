import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createAdminClient } from '../src/lib/supabase/admin.ts'

const migration = readFileSync(
  new URL('../supabase/migrations/20261103000000_shop_skills_p0.sql', import.meta.url),
  'utf8'
)
const collectionRoute = readFileSync(new URL('../src/app/api/shop/skills/route.ts', import.meta.url), 'utf8')
const itemRoute = readFileSync(new URL('../src/app/api/shop/skills/[skillId]/route.ts', import.meta.url), 'utf8')

test('shop skills migration contains no legacy owner_id policy', () => {
  assert.doesNotMatch(migration, /owner_id/)
})

test('conversation outcome RPC is restricted to the service role', () => {
  assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(migration, /p_shop_id IS NULL OR p_shop_id <> v_conv_shop/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.set_conversation_outcome[^;]*TO service_role;/)
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.set_conversation_outcome[^;]*TO authenticated/)
})

test('skill sources validate that referenced records belong to the same shop', () => {
  assert.match(migration, /validate_shop_skill_source_scope/)
  assert.match(migration, /id = NEW\.conversation_id AND shop_id = NEW\.shop_id/)
  assert.match(migration, /id = NEW\.chat_message_id AND shop_id = NEW\.shop_id/)
  assert.match(migration, /id = NEW\.sales_trajectory_id AND shop_id = NEW\.shop_id/)
})

test('admin Supabase client has no credential fallback', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const originalLegacyKey = process.env.SUPABASE_SERVICE_KEY

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_KEY

  try {
    assert.throws(() => createAdminClient(), /SUPABASE_SERVICE_ROLE_KEY/)
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalRoleKey
    if (originalLegacyKey === undefined) delete process.env.SUPABASE_SERVICE_KEY
    else process.env.SUPABASE_SERVICE_KEY = originalLegacyKey
  }
})

test('skill APIs derive shop ownership from the authenticated session', () => {
  assert.match(collectionRoute, /await requireShop\(\)/)
  assert.match(itemRoute, /await requireShop\(\)/)
  assert.match(collectionRoute, /shop_id: auth\.shopId/)
  assert.match(itemRoute, /\.eq\('shop_id', auth\.shopId\)/)
  assert.doesNotMatch(collectionRoute, /body\.shop_id/)
  assert.doesNotMatch(itemRoute, /body\.shop_id/)
})
