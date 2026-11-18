import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCatalogPrefetchExecutor } from '../src/lib/ai/catalogPrefetchAdapter.ts'
import { prefetchCatalog } from '../src/lib/ai/catalogPrefetch.ts'
import { validateCatalogSnapshot } from '../src/lib/ai/catalogSnapshot.ts'
import type { ToolExecutionContext } from '../src/lib/ai/toolDispatcher.ts'

const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** Minimal chainable Supabase-like builder: filters by shop_id the same way the real query does. */
function fakeSupabase(rows: Array<Record<string, unknown>>) {
  return {
    from(_table: string) {
      const builder: any = {
        _shopId: undefined as string | undefined,
        select() { return builder },
        eq(col: string, val: unknown) { if (col === 'shop_id') builder._shopId = val; return builder },
        or() { return builder },
        ilike() { return builder },
        lte() { return builder },
        limit() { return builder },
        then(resolve: (r: { data: unknown[] }) => void) {
          resolve({ data: rows.filter((r) => r.shop_id === builder._shopId) })
        },
      }
      return builder
    },
  }
}

function ctxFor(shopId: string, rows: Array<Record<string, unknown>>): ToolExecutionContext {
  return {
    shopId,
    userId: 'user-1',
    conversationId: 'conv-1',
    shop: { id: shopId },
    supabase: fakeSupabase(rows) as never,
    supabaseAdmin: fakeSupabase(rows) as never,
  }
}

const catalogRows = [
  { id: 'p-a1', name: 'เสื้อยืดโอเวอร์ไซส์', price: 290, stock: 12, shop_id: SHOP_A },
  { id: 'p-b1', name: 'เสื้อยืดโอเวอร์ไซส์', price: 999, stock: 0, shop_id: SHOP_B },
]

test('the adapter only reaches rows scoped to the shop the context says is active', async () => {
  const execute = createCatalogPrefetchExecutor(ctxFor(SHOP_A, catalogRows))
  const result = await execute('search_products', { keyword: 'เสื้อยืด' }, { shopId: SHOP_A })
  assert.match(result.resultForAi, /290/)
  assert.doesNotMatch(result.resultForAi, /999/)
  const snapshot = validateCatalogSnapshot(result.catalogSnapshot, SHOP_A)
  assert.deepEqual(snapshot.products, [{ id: 'p-a1', name: 'เสื้อยืดโอเวอร์ไซส์', price: 290, stock: 12 }])
})

test('a scope that does not match the active shop is refused before any query runs', async () => {
  const execute = createCatalogPrefetchExecutor(ctxFor(SHOP_A, catalogRows))
  await assert.rejects(execute('search_products', { keyword: 'เสื้อยืด' }, { shopId: SHOP_B }), /does not match the active shop/)
})

test('check_stock goes through the same shop-scoped path and snapshot shape', async () => {
  const execute = createCatalogPrefetchExecutor(ctxFor(SHOP_B, catalogRows))
  const result = await execute('check_stock', { product_name: 'เสื้อยืด' }, { shopId: SHOP_B })
  assert.match(result.resultForAi, /หมดสต๊อก/)
  const snapshot = validateCatalogSnapshot(result.catalogSnapshot, SHOP_B)
  assert.deepEqual(snapshot.products, [{ id: 'p-b1', name: 'เสื้อยืดโอเวอร์ไซส์', price: 999, stock: 0 }])
})

test('prefetchCatalog end to end with the real tool handler never crosses shops, even on the same query', async () => {
  const [forA, forB] = await Promise.all([
    prefetchCatalog({
      shopId: SHOP_A,
      query: 'เสื้อยืดราคาเท่าไหร่',
      allowedTools: ['search_products', 'check_stock'],
      execute: createCatalogPrefetchExecutor(ctxFor(SHOP_A, catalogRows)),
    }),
    prefetchCatalog({
      shopId: SHOP_B,
      query: 'เสื้อยืดราคาเท่าไหร่',
      allowedTools: ['search_products', 'check_stock'],
      execute: createCatalogPrefetchExecutor(ctxFor(SHOP_B, catalogRows)),
    }),
  ])
  assert.ok(forA.every((call) => call.result.includes('290') && !call.result.includes('999')))
  assert.ok(forB.every((call) => call.result.includes('999') && !call.result.includes('290')))
  assert.ok(forA.every((call) => call.snapshot?.shopId === SHOP_A))
  assert.ok(forB.every((call) => call.snapshot?.shopId === SHOP_B))
})
