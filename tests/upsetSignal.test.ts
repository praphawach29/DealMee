import assert from 'node:assert/strict'
import test from 'node:test'
import {
  UPSET_ALERT_COOLDOWN_MS,
  UPSET_QUESTION,
  cooldownOver,
  upsetAlertText,
  upsetProbability,
  upsetRequestBody,
  worthChecking,
} from '../src/lib/ai/upsetSignal.ts'

test('the request asks one yes/no question about the customer message', () => {
  const body = upsetRequestBody('ของมาถึงแล้วแต่ตะเข็บขาด', 'Sunday Clothing')
  assert.equal(body.model, 'jev-latest')
  assert.equal(body.state.message, 'ของมาถึงแล้วแต่ตะเข็บขาด')
  assert.match(body.state.shop, /Sunday Clothing/)
  assert.deepEqual(Object.keys(body.questions), ['upset'])
  assert.equal(body.questions.upset.type, 'noul')
  assert.ok(UPSET_QUESTION.criteria.false.includes('expensive'), 'a price remark is not upset (tested wording)')
  assert.doesNotMatch(upsetRequestBody('x').state.shop, /undefined|null/)
})

test('only a well-formed noul answer counts', () => {
  assert.equal(upsetProbability({ answers: { upset: { type: 'noul', noul: 0.93 } } }), 0.93)
  assert.equal(upsetProbability({ answers: { upset: { type: 'noul', noul: 0 } } }), 0)
  for (const bad of [null, {}, { answers: {} }, { answers: { upset: { type: 'choice', noul: 0.9 } } },
    { answers: { upset: { type: 'noul', noul: '0.9' } } }, { answers: { upset: { type: 'noul', noul: 1.5 } } }]) {
    assert.equal(upsetProbability(bad), null, JSON.stringify(bad))
  }
})

test('commands, stickers and emoji-only messages are not sent to TypeSafe', () => {
  assert.equal(worthChecking('ตอบช้ามากเลยนะ'), true)
  assert.equal(worthChecking('why so slow?'), true)
  for (const text of ['/admin', 'ok', '😡😡😡', '  ', '555']) assert.equal(worthChecking(text), false, text)
})

test('one alert per conversation per hour', () => {
  const now = Date.parse('2026-10-25T10:00:00Z')
  assert.equal(cooldownOver(undefined, now), true)
  assert.equal(cooldownOver('not a date', now), true)
  assert.equal(cooldownOver(new Date(now - 10 * 60 * 1000).toISOString(), now), false)
  assert.equal(cooldownOver(new Date(now - UPSET_ALERT_COOLDOWN_MS).toISOString(), now), true)
})

test('the admin alert quotes the message and links to the inbox', () => {
  const text = upsetAlertText('ส่งผิดสีอีกแล้ว', 'คุณเอ', 'https://app.dealmee.app/dashboard/inbox')
  assert.match(text, /ลูกค้าดูไม่พอใจ/)
  assert.match(text, /^ลูกค้า: คุณเอ$/m)
  assert.match(text, /"ส่งผิดสีอีกแล้ว"/)
  assert.match(text, /https:\/\/app\.dealmee\.app\/dashboard\/inbox$/)
  assert.doesNotMatch(upsetAlertText('x', null, 'u'), /^ลูกค้า: /m)
  assert.ok(upsetAlertText('ก'.repeat(500), null, 'u').includes('…'))
})
