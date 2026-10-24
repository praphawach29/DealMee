import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chunkDocument, chunkQaEntry } from '../src/lib/knowledge/chunk.ts'

test('empty documents produce no chunks', () => {
  assert.deepEqual(chunkDocument(''), [])
  assert.deepEqual(chunkDocument('   \n\n  '), [])
  assert.deepEqual(chunkQaEntry({ title: '  ', content: 'มีคำตอบ' }), [])
})

test('chunks keep the file name and the heading path', () => {
  const chunks = chunkDocument(
    '# เสื้อยืด\n\n## รุ่นคลาสสิก\nผ้าฝ้าย 100% รหัสสินค้า SKU-8891 ราคา 290 บาท\n',
    { fileName: 'price-list.md' }
  )
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].fileName, 'price-list.md')
  assert.equal(chunks[0].section, 'เสื้อยืด > รุ่นคลาสสิก')
  assert.match(chunks[0].content, /SKU-8891/)
  assert.equal(chunks[0].index, 0)
})

test('long Thai text without spaces overlaps the next chunk and does not cross sections', () => {
  const chunks = chunkDocument('ก'.repeat(500), { fileName: 'a.txt', maxChars: 100, overlapChars: 20 })
  assert.ok(chunks.length >= 3)
  const tail = Array.from(chunks[0].content).slice(-20).join('')
  assert.equal(tail.length, 20)
  assert.ok(chunks[1].content.startsWith(tail))
  assert.ok(chunks.every((chunk) => chunk.fileName === 'a.txt'))

  const text = `# นโยบาย\n\n## การส่งของ\n${'ก'.repeat(400)}\n\n## การคืน\n${'ข'.repeat(400)}`
  const sections = chunkDocument(text, { fileName: 'policy.md', maxChars: 120, overlapChars: 30 })
  const returns = sections.filter((chunk) => chunk.section === 'นโยบาย > การคืน')
  const shipping = sections.filter((chunk) => chunk.section === 'นโยบาย > การส่งของ')
  assert.ok(shipping.length > 1)
  assert.ok(returns.length > 1)
  assert.ok(returns.every((chunk) => !chunk.content.includes('ก')))
  assert.ok(shipping.every((chunk) => !chunk.content.includes('ข')))
})

test('a markdown price table repeats its header and keeps product codes whole', () => {
  const rows = Array.from({ length: 12 }, (_, i) => `| SKU-88${String(i).padStart(2, '0')} | ${290 + i} |`).join('\n')
  const chunks = chunkDocument(`| รหัส | ราคา |\n| --- | --- |\n${rows}`, {
    fileName: 'prices.md',
    maxChars: 180,
    overlapChars: 20,
  })
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.content.includes('รหัส')))
  assert.ok(chunks.some((chunk) => chunk.content.includes('SKU-8800')))
  assert.ok(chunks.some((chunk) => chunk.content.includes('SKU-8811')))
})

test('a short merchant answer is kept as one Q&A chunk', () => {
  const chunks = chunkQaEntry({ title: 'ราคา', content: '290 บาท', fileName: 'คำถามที่ร้านเขียนเอง' })
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].section, 'ราคา')
  assert.equal(chunks[0].fileName, 'คำถามที่ร้านเขียนเอง')
  assert.match(chunks[0].content, /Q: ราคา/)
  assert.match(chunks[0].content, /290 บาท/)
})
