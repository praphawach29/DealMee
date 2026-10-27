import assert from 'node:assert/strict'
import { test } from 'node:test'
import { containsPii, PII_PLACEHOLDER, redactPii, selectSynthesisTurns } from '../src/lib/ai/faqGuards.ts'

// ───────────── selectSynthesisTurns (fix 1) ─────────────

test('selectSynthesisTurns keeps customer + admin only', () => {
  const turns = selectSynthesisTurns([
    { sender_type: 'user', message: 'q' },
    { sender_type: 'bot', message: 'wrong' },
    { sender_type: 'system', message: 'notice' },
    { sender_type: 'agent', message: 'a' },
    { sender_type: 'human', message: 'b' },
    { sender_type: 'mystery', message: 'c' },
    { sender_type: 'agent', message: '   ' },
    { sender_type: null, message: 'd' },
  ])
  assert.deepEqual(turns, [
    { role: 'customer', text: 'q' },
    { role: 'admin', text: 'a' },
    { role: 'admin', text: 'b' },
  ])
})

// ───────────── redactPii (fix 2) ─────────────

const mustRedact: Array<[string, string]> = [
  ['phone with dashes', 'โทร 081-234-5678 นะคะ'],
  ['phone plain', 'เบอร์ 0812345678'],
  ['phone with spaces', 'เบอร์ 08 1234 5678'],
  ['phone with spaces 3-3-4', 'เบอร์ 081 234 5678'],
  ['phone +66', 'โทร +66 81 234 5678'],
  ['landline', 'โทร 02-123-4567'],
  ['bank account dashed', 'บัญชี 123-4-56789-0'],
  ['bank account plain', 'บัญชี 1234567890'],
  ['national id', 'บัตร 1-1234-56789-01-2'],
  ['card number', 'บัตร 4111 1111 1111 1111'],
  ['slip reference', 'เลขสลิป 202610281234ABCD5678'],
  ['slip reference (digits only)', 'อ้างอิง 202610281234567890'],
  ['e-mail', 'ส่งมาที่ somchai.j@example.co.th'],
  ['street address', 'ส่งที่ 99/1 ซ.สุขุมวิท 21 แขวงคลองเตยเหนือ กทม'],
  ['address with moo', 'บ้าน 12 หมู่ 3 ต.บางนา อ.เมือง'],
]

for (const [name, input] of mustRedact) {
  test(`redactPii hides: ${name}`, () => {
    const r = redactPii(input)
    assert.equal(r.redacted, true, input)
    assert.ok(r.text.includes(PII_PLACEHOLDER), r.text)
    assert.equal(containsPii(input), true)
  })
}

test('redactPii removes the digits themselves, keeps surrounding words', () => {
  const r = redactPii('โอนแล้วนะคะ เบอร์ 081-234-5678 ขอบคุณค่ะ')
  assert.equal(r.text, `โอนแล้วนะคะ เบอร์ ${PII_PLACEHOLDER} ขอบคุณค่ะ`)
})

const mustKeep = [
  'ส่งต่างจังหวัด 2-3 วันทำการ',
  'ราคา 1,290 บาท ส่งฟรีเมื่อซื้อครบ 500',
  'เปิดทุกวัน 09:00-18:00 น.',
  'รับคืนภายใน 7 วัน',
  'วันที่ 28/10/2026 โปรโมชั่นสิ้นสุด',
  'S 290 M 390 L 490 บาท',
  'ราคา 290 390 490 แล้วแต่ไซส์',
  'รับประกัน 12 เดือน ผ่อน 0% 10 เดือน',
  'โปรโมชั่น 11.11 ลด 50%',
]
for (const input of mustKeep) {
  test(`redactPii leaves ordinary shop facts alone: ${input}`, () => {
    const r = redactPii(input)
    assert.equal(r.redacted, false, r.text)
    assert.equal(r.text, input)
    assert.equal(containsPii(input), false)
  })
}

test('containsPii flags a copied placeholder', () => {
  assert.equal(containsPii(`โอนเข้า ${PII_PLACEHOLDER}`), true)
})
