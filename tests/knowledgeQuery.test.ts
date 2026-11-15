import assert from 'node:assert/strict'
import test from 'node:test'
import { buildKnowledgeQuery } from '../src/lib/ai/knowledgeQuery.ts'

test('broad catalog questions gain knowledge retrieval anchors when the catalog is empty', () => {
  const query = buildKnowledgeQuery('มีสินค้าไหม', { catalogEmpty: true })

  assert.match(query, /มีสินค้าไหม/)
  assert.match(query, /แพ็กเกจ/)
  assert.match(query, /วิธีเริ่มใช้งาน/)
})

test('specific non-catalog questions are not rewritten', () => {
  assert.equal(
    buildKnowledgeQuery('วันนี้อากาศเป็นอย่างไร', { catalogEmpty: true }),
    'วันนี้อากาศเป็นอย่างไร',
  )
})

test('shops with a catalog keep the original knowledge query', () => {
  assert.equal(buildKnowledgeQuery('มีสินค้าไหม', { catalogEmpty: false }), 'มีสินค้าไหม')
})
