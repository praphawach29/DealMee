import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  GROUNDING_HANDOFF,
  GROUNDING_RULES,
  assertGapShop,
  checkGrounding,
  chunksFromRetrievedText,
  gapInsert,
  planGapWrite,
  questionKey,
  type EvidenceChunk,
} from '../src/lib/ai/grounding.ts'

const CHUNK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_A = '11111111-1111-4111-8111-111111111111'
const SHOP_B = '22222222-2222-4222-8222-222222222222'

const chunks: EvidenceChunk[] = [
  { id: CHUNK, content: 'เสื้อยืดรุ่น SKU-8891 ราคา 290 บาท ส่งฟรีเมื่อซื้อครบ 2 ชิ้น' },
]

function check(draft: string, extra: { evidenceTexts?: string[]; customerMessage?: string; knowledgeMiss?: boolean; language?: 'th' | 'en'; chunks?: EvidenceChunk[]; codEnabled?: boolean | null } = {}) {
  return checkGrounding({
    draft,
    customerMessage: extra.customerMessage ?? 'เสื้อตัวนี้ราคาเท่าไหร่',
    language: extra.language ?? 'th',
    chunks: extra.chunks ?? chunks,
    evidenceTexts: extra.evidenceTexts ?? [],
    knowledgeMiss: extra.knowledgeMiss,
    codEnabled: extra.codEnabled,
  })
}

test('small talk keeps the reply and does not log or hand off', () => {
  const draft = 'สวัสดีค่ะ วันนี้สนใจดูสินค้าแบบไหนดีคะ'
  const verdict = check(draft, { customerMessage: 'สวัสดี' })
  assert.equal(verdict.skipped, true)
  assert.equal(verdict.shouldLog, false)
  assert.equal(verdict.shouldHandoff, false)
  assert.equal(verdict.text, draft)
  assert.equal(verdict.reason, 'small_talk')
})

test('a cited price that is in the chunk is kept and the citation is removed', () => {
  const verdict = check(`เสื้อยืดราคา 290 บาทค่ะ\n[[cite:chunk:${CHUNK}]]`)
  assert.equal(verdict.grounded, true)
  assert.equal(verdict.shouldHandoff, false)
  assert.equal(verdict.text.includes('290'), true)
  assert.equal(verdict.text.includes('[[cite:'), false)
  assert.equal(verdict.text.includes(CHUNK), false)
})

test('a price that is not in shop data is replaced and logged', () => {
  const verdict = check('เสื้อยืดราคา 999 บาทค่ะ สนใจไซส์ไหนดีคะ')
  assert.equal(verdict.grounded, false)
  assert.equal(verdict.shouldHandoff, true)
  assert.equal(verdict.shouldLog, true)
  assert.equal(verdict.reason, 'unsupported_shop_fact')
  assert.equal(verdict.text, GROUNDING_HANDOFF.th)
  assert.equal(verdict.text.includes('999'), false)
})

test('an invented chunk id does not make a missing warranty true', () => {
  const verdict = check(`รับประกัน 2 ปีค่ะ\n[[cite:chunk:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb]]`)
  assert.equal(verdict.grounded, false)
  assert.equal(verdict.reason, 'invented_citation')
  assert.equal(verdict.text.includes('รับประกัน'), false)
})

test('stock, payment, and hours from tool or shop text are allowed', () => {
  const stock = check('เหลือ 4 ชิ้นค่ะ', {
    evidenceTexts: ['check_stock: เสื้อยืด เหลือ 4 ชิ้น'],
    customerMessage: 'มีของไหม',
  })
  assert.equal(stock.grounded, true)

  const payment = check('โอนพร้อมเพย์ 0812345678 ได้เลยค่ะ', {
    evidenceTexts: ['พร้อมเพย์: 0812345678'],
    customerMessage: 'โอนยังไง',
  })
  assert.equal(payment.grounded, true)

  const hours = check('ร้านเปิด 09:00-18:00 น. ค่ะ', {
    evidenceTexts: ['เวลาทำการ จันทร์-ศุกร์ 09:00-18:00'],
    customerMessage: 'เปิดกี่โมง',
  })
  assert.equal(hours.grounded, true)
})

test('free shipping is refused when the shop text says it is not free', () => {
  const verdict = check('ส่งฟรีทั่วประเทศค่ะ', {
    evidenceTexts: ['ค่าจัดส่ง 50 บาท ไม่มีส่งฟรี'],
    customerMessage: 'ส่งฟรีไหม',
    chunks: [],
  })
  assert.equal(verdict.grounded, false)
  assert.equal(verdict.text, GROUNDING_HANDOFF.th)
})

test('free shipping is allowed when the chunk says so', () => {
  const verdict = check('สั่งครบ 2 ชิ้นส่งฟรีค่ะ', { customerMessage: 'ส่งฟรีไหม' })
  assert.equal(verdict.grounded, true)
  assert.equal(verdict.text.includes('ส่งฟรี'), true)
})

test('a knowledge miss that the model admits is logged without inventing a fact', () => {
  const draft = 'เรื่องนี้ยังไม่มีในข้อมูลร้านค่ะ เดี๋ยวให้แอดมินช่วยดูให้นะคะ'
  const verdict = check(draft, { knowledgeMiss: true, customerMessage: 'มีสาขาเชียงใหม่ไหม', chunks: [] })
  assert.equal(verdict.shouldLog, true)
  assert.equal(verdict.shouldHandoff, true)
  assert.equal(verdict.reason, 'unanswered')
  assert.equal(verdict.text, draft)
})

test('english handoff is used for an english customer', () => {
  const verdict = check('It is 50 baht for shipping nationwide.', {
    language: 'en',
    customerMessage: 'how much is shipping?',
    chunks: [],
  })
  assert.equal(verdict.text, GROUNDING_HANDOFF.en)
})

test('retrieved tool text yields chunk ids and content', () => {
  const parsed = chunksFromRetrievedText(`[chunk_id: ${CHUNK} | ไฟล์: price.pdf | หัวข้อ: เสื้อ]\nราคา 290 บาท`)
  assert.deepEqual(parsed, [{ id: CHUNK, content: 'ราคา 290 บาท' }])
})

test('gap identity is per shop and repeated questions increment', () => {
  assert.equal(questionKey('  ส่งฟรี  ไหม  '), questionKey('ส่งฟรี ไหม'))
  assert.throws(() => assertGapShop(''), /shop id is required/)
  assert.throws(() => gapInsert('not-a-shop', 'ส่งฟรีไหม', 'unanswered'))
  const rowA = gapInsert(SHOP_A, 'ส่งฟรีไหม', 'unanswered')
  const rowB = gapInsert(SHOP_B, 'ส่งฟรีไหม', 'unanswered')
  assert.equal(rowA.shop_id, SHOP_A)
  assert.equal(rowB.shop_id, SHOP_B)
  assert.notEqual(rowA.shop_id, rowB.shop_id)
  assert.deepEqual(planGapWrite(null), { action: 'insert' })
  assert.deepEqual(planGapWrite({ id: 'gap-1', status: 'dismissed', ask_count: 2 }), {
    action: 'increment',
    id: 'gap-1',
    askCount: 3,
  })
})

test('COD claims follow the shop switch both ways', () => {
  const offer = check('มีเก็บเงินปลายทางค่ะ', {
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
    customerMessage: 'เก็บปลายทางได้ไหม',
    chunks: [],
    codEnabled: false,
  })
  assert.equal(offer.grounded, false)

  const denialWhenOn = check('ไม่รับเก็บปลายทางค่ะ', {
    evidenceTexts: ['เปิดเก็บเงินปลายทาง', 'วิธีชำระ: เก็บเงินปลายทาง'],
    customerMessage: 'เก็บปลายทางได้ไหม',
    chunks: [],
    codEnabled: true,
  })
  assert.equal(denialWhenOn.grounded, false)
  assert.equal(denialWhenOn.shouldHandoff, true)

  const denialWhenOff = check('ไม่รับเก็บปลายทางค่ะ', {
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
    customerMessage: 'เก็บปลายทางได้ไหม',
    chunks: [],
    codEnabled: false,
  })
  assert.equal(denialWhenOff.grounded, true)
  assert.equal(denialWhenOff.text.includes('ไม่รับเก็บปลายทาง'), true)

  const offerWhenOn = check('มีเก็บเงินปลายทางค่ะ', {
    evidenceTexts: ['เปิดเก็บเงินปลายทาง'],
    customerMessage: 'เก็บปลายทางได้ไหม',
    chunks: [],
    codEnabled: true,
  })
  assert.equal(offerWhenOn.grounded, true)

  const unchecked = check('ไม่รับเก็บปลายทางค่ะ', {
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
    customerMessage: 'เก็บปลายทางได้ไหม',
    chunks: [],
  })
  assert.equal(unchecked.grounded, false)
})

test('an out-of-stock claim needs stock evidence', () => {
  const invented = check('เสื้อยืดสินค้าหมดค่ะ', {
    evidenceTexts: ['เสื้อยืดโอเวอร์ไซส์ ราคา 290 บาท (คงเหลือ: 12 ชิ้น)'],
    customerMessage: 'หมดยัง',
    chunks: [],
  })
  assert.equal(invented.grounded, false)
  assert.equal(invented.shouldHandoff, true)

  const fromTool = check('เสื้อยืดสินค้าหมดค่ะ', {
    evidenceTexts: ['check_stock: เสื้อยืด หมดสต๊อก'],
    customerMessage: 'หมดยัง',
    chunks: [],
  })
  assert.equal(fromTool.grounded, true)

  const fromZero = check('กางเกงของหมดค่ะ', {
    evidenceTexts: ['กางเกงขาสั้นลินิน: 450 บาท (คงเหลือ: 0 ชิ้น)'],
    customerMessage: 'หมดยัง',
    chunks: [],
  })
  assert.equal(fromZero.grounded, true)
})

test('naming a closed time slot offers the real rounds instead of handing off', () => {
  const slots = 'เวลาว่าง: 11:00, 13:00, 15:00, 17:00'
  const offered = check('รอบ 18:00 ยังไม่มีค่ะ รอบที่ว่างคือ 11:00 13:00 15:00 และ 17:00 ค่ะ', {
    evidenceTexts: [slots],
    customerMessage: 'รอบ 18:00 ว่างมั้ย',
    chunks: [],
  })
  assert.equal(offered.grounded, true)
  assert.equal(offered.shouldHandoff, false)
  assert.equal(offered.text.includes('18:00'), true)
  assert.equal(offered.text.includes('11:00'), true)

  const onlyDenial = check('รอบ 18:00 ยังไม่มีค่ะ', {
    evidenceTexts: [slots],
    customerMessage: 'รอบ 18:00 ว่างมั้ย',
    chunks: [],
  })
  assert.equal(onlyDenial.grounded, true)
  assert.equal(onlyDenial.shouldHandoff, false)
  assert.match(onlyDenial.text, /11:00/)
  assert.match(onlyDenial.text, /17:00/)

  const inventedSlot = check('รอบ 18:00 ว่างค่ะ', {
    evidenceTexts: [slots],
    customerMessage: 'รอบ 18:00 ว่างมั้ย',
    chunks: [],
  })
  assert.equal(inventedSlot.grounded, false)
  assert.equal(inventedSlot.shouldHandoff, true)
})

test('the migration isolates gaps by shop and the prompt tells the model to look facts up', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261101000000_knowledge_gaps.sql', import.meta.url), 'utf8')
  assert.equal(sql.includes('USING (true)'), false)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /shop_id IN \(SELECT workspace_id FROM public\.users/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.knowledge_gaps FROM anon/)
  assert.match(sql, /knowledge_gaps_shop_question/)
  assert.match(GROUNDING_RULES, /search_knowledge_base/)
  assert.match(GROUNDING_RULES, /request_human_agent/)
  assert.match(GROUNDING_RULES, /\[\[cite:chunk:/)
})
