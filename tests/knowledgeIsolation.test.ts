import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  assertShopScope,
  keywordSearchArgs,
  mergeHybridResults,
  vectorSearchArgs,
  type HybridCandidate,
} from '../src/lib/knowledge/hybrid.ts'

const SHOP_A = '11111111-1111-4111-8111-111111111111'
const SHOP_B = '22222222-2222-4222-8222-222222222222'

function hit(shopId: string, id: string): HybridCandidate {
  return {
    id,
    shopId,
    content: 'รหัส SKU-8891 ราคา 290 บาท',
    sourceFile: `${shopId}.pdf`,
    section: 'ราคา',
    sourceKind: 'document',
    priority: 10,
    chunkIndex: 0,
    vectorRank: 1,
    vectorScore: shopId === SHOP_B ? 0.99 : 0.7,
  }
}

test('hybrid merge drops every chunk that belongs to another shop', () => {
  const ranked = mergeHybridResults({
    shopId: SHOP_A,
    query: 'SKU-8891',
    vectorHits: [hit(SHOP_B, 'other-shop'), hit(SHOP_A, 'this-shop')],
  })
  assert.deepEqual(ranked.map((item) => item.id), ['this-shop'])
  assert.equal(ranked.every((item) => item.shopId === SHOP_A), true)
})

test('retrieval refuses to build a query without a shop id', () => {
  assert.throws(() => mergeHybridResults({ shopId: '', query: 'ราคา', vectorHits: [hit(SHOP_A, 'x')] }), /shop id/)
  assert.throws(() => assertShopScope('shop-a'), /shop id/)
  assert.throws(() => vectorSearchArgs('', [0.1], 5), /shop id/)
  assert.equal(assertShopScope(SHOP_A), SHOP_A)

  const vector = vectorSearchArgs(SHOP_A, [0.2, 0.3], 8)
  const keyword = keywordSearchArgs(SHOP_A, 'SKU-8891', 8)
  assert.equal(vector.p_shop_id, SHOP_A)
  assert.equal(keyword.p_shop_id, SHOP_A)
  assert.equal(vector.p_query_embedding, '[0.2,0.3]')
  assert.notEqual(vector.p_shop_id, SHOP_B)
})

test('the migration isolates chunks by shop and does not leave an open policy', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261031000000_knowledge_chunks_pgvector.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS vector/i)
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_trgm/i)
  assert.match(sql, /ALTER TABLE public\.knowledge_chunks ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /ALTER TABLE public\.knowledge_documents ENABLE ROW LEVEL SECURITY/i)
  assert.equal(sql.includes('USING (true)'), false)
  assert.equal((sql.match(/c\.shop_id = p_shop_id/g) || []).length, 2)
  assert.match(sql, /workspace_id FROM public\.users/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.knowledge_chunks FROM anon/i)
  assert.match(sql, /vector\(768\)/)
  assert.match(sql, /source_kind IN \('qa', 'document'\)/)
})
