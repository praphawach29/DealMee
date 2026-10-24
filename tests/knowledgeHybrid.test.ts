import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectRelevantKnowledge } from '../src/lib/ai/knowledgeSelect.ts'
import {
  buildRetrievalQuery,
  formatRetrievedKnowledge,
  mergeHybridResults,
  renderKnowledgeSection,
  renderToolResult,
  type HybridCandidate,
} from '../src/lib/knowledge/hybrid.ts'

const SHOP = '11111111-1111-4111-8111-111111111111'

function hit(partial: Partial<HybridCandidate> & Pick<HybridCandidate, 'id' | 'content'>): HybridCandidate {
  return {
    shopId: SHOP,
    sourceFile: 'catalog.pdf',
    section: 'สินค้า',
    sourceKind: 'document',
    priority: 10,
    chunkIndex: 0,
    ...partial,
  }
}

test('a chunk found by both methods outranks a vector-only neighbour', () => {
  const ranked = mergeHybridResults({
    shopId: SHOP,
    query: 'ค่าจัดส่ง',
    vectorHits: [
      hit({ id: 'both', content: 'ค่าจัดส่งปกติ', vectorRank: 1, vectorScore: 0.8 }),
      hit({ id: 'vector-only', content: 'ค่าจัดส่งพิเศษ', vectorRank: 1, vectorScore: 0.8 }),
    ],
    keywordHits: [
      hit({ id: 'both', content: 'ค่าจัดส่งปกติ', keywordRank: 1, keywordScore: 0.6 }),
    ],
  })
  assert.equal(ranked[0].id, 'both')
  assert.ok(ranked[0].score > ranked.find((item) => item.id === 'vector-only')!.score)
})

test('an exact product code outranks a semantically closer chunk that lacks it', () => {
  const ranked = mergeHybridResults({
    shopId: SHOP,
    query: 'มี SKU-8891 ไหมครับ',
    vectorHits: [
      hit({ id: 'shipping', content: 'จัดส่งทุกวันจันทร์ถึงเสาร์', section: 'การจัดส่ง', vectorRank: 1, vectorScore: 0.92 }),
    ],
    keywordHits: [
      hit({ id: 'sku', content: 'รหัส SKU-8891 ราคา 290 บาท', section: 'เสื้อยืด', keywordRank: 1, keywordScore: 0.8 }),
    ],
  })
  assert.equal(ranked[0].id, 'sku')
})

test('merchant Q&A wins a tie against a document chunk', () => {
  const ranked = mergeHybridResults({
    shopId: SHOP,
    query: 'ค่าจัดส่ง',
    keywordHits: [
      hit({ id: 'doc', content: 'ค่าจัดส่งของพัสดุ', section: 'ค่าจัดส่ง', sourceKind: 'document', priority: 10, keywordRank: 1, keywordScore: 0.5 }),
      hit({ id: 'qa', content: 'ค่าจัดส่งของร้าน', section: 'ค่าจัดส่ง', sourceKind: 'qa', priority: 100, keywordRank: 1, keywordScore: 0.5 }),
    ],
  })
  assert.equal(ranked[0].id, 'qa')
})

test('a weak vector-only hit is dropped and a bot-instruction chunk loses to the product', () => {
  const ranked = mergeHybridResults({
    shopId: SHOP,
    query: 'เสื้อยืด',
    vectorHits: [
      hit({ id: 'weak', content: 'เรื่องอื่นที่ไม่เกี่ยว', vectorRank: 1, vectorScore: 0.1 }),
    ],
    keywordHits: [
      hit({ id: 'meta', content: 'เสื้อยืด', section: 'ห้ามพูด / ห้ามสัญญา', sourceKind: 'qa', priority: 40, keywordRank: 1, keywordScore: 0.9 }),
      hit({ id: 'product', content: 'เสื้อยืดคอกลม', section: 'เสื้อยืด', sourceKind: 'qa', priority: 40, keywordRank: 1, keywordScore: 0.9 }),
    ],
    limit: 5,
  })
  assert.equal(ranked.some((item) => item.id === 'weak'), false)
  assert.equal(ranked[0].id, 'product')
})

test('results stay inside the limit and prompt blocks cite file, section, and chunk id', () => {
  const ranked = mergeHybridResults({
    shopId: SHOP,
    query: 'ราคา',
    keywordHits: [1, 2, 3, 4].map((n) => hit({
      id: `c${n}`,
      content: `ราคาสินค้าชิ้นที่ ${n}`,
      section: `ชิ้นที่ ${n}`,
      sourceFile: 'prices.md',
      keywordRank: n,
      keywordScore: 0.8,
    })),
    limit: 2,
  })
  assert.equal(ranked.length, 2)
  const formatted = formatRetrievedKnowledge(ranked, 6000)
  assert.match(formatted.blocks[0], /chunk_id: c1/)
  assert.match(formatted.blocks[0], /ไฟล์: prices.md/)
  assert.match(formatted.blocks[0], /หัวข้อ: ชิ้นที่ 1/)
  assert.equal(formatted.citations[0].chunkId, 'c1')
  assert.equal(formatted.omitted, 0)
})

test('no matching knowledge tells the model not to guess and to hand off', () => {
  const query = 'มีสาขาเชียงใหม่ไหม'
  assert.equal(
    renderToolResult(query, []),
    `ไม่พบข้อมูลเรื่อง "${query}" ในคลังความรู้ของร้าน ห้ามเดาคำตอบ ให้บอกลูกค้าว่าจะให้แอดมินช่วยตรวจสอบ หรือเรียก request_human_agent`
  )
  const section = renderKnowledgeSection({ chunks: [], shopHasKnowledge: true })
  assert.match(section.text, /ห้ามเดา/)
  assert.match(section.text, /request_human_agent/)
  assert.equal(renderKnowledgeSection({ chunks: [], shopHasKnowledge: false }).text, '')
})

test('a short follow-up keeps the previous customer sentence, and legacy search does not return an unrelated FAQ', () => {
  assert.match(buildRetrievalQuery('เท่าไหร่', ['เสื้อยืดรุ่นคลาสสิก']), /เสื้อยืดรุ่นคลาสสิก/)
  assert.equal(buildRetrievalQuery('เสื้อยืดรุ่นคลาสสิกราคาเท่าไหร่ครับ', ['เรื่องเก่า']), 'เสื้อยืดรุ่นคลาสสิกราคาเท่าไหร่ครับ')

  const found = selectRelevantKnowledge(
    [
      { id: 'ship', title: 'นโยบายการจัดส่ง', content: 'ส่งทุกวันจันทร์' },
      { id: 'color', title: 'สีของเสื้อ', content: 'มีสีขาวและสีดำ' },
    ],
    'การจัดส่ง',
    [],
    6000,
    'search',
    5
  )
  assert.deepEqual(found.indexes, [0])

  const unrelated = selectRelevantKnowledge(
    [{ id: 'color', title: 'สีของเสื้อ', content: 'มีสีขาวและสีดำ' }],
    'ใบกำกับภาษี',
    [],
    6000,
    'search'
  )
  assert.deepEqual(unrelated.indexes, [])
})
