import assert from 'node:assert/strict'
import test from 'node:test'
import { containsThaiKeyword, hasUnnegatedMatch, isHandoffRequest } from '../src/lib/ai/thaiMatch.ts'

test('a keyword inside a longer Thai word does not count', () => {
  // "เหมา" (bulk buy) vs "เหมาะ" (suitable): a question about fit was scored as haggling
  assert.equal(containsThaiKeyword('ตัวนี้เหมาะกับคนผิวแพ้ง่ายไหมคะ', 'เหมา'), false)
  assert.equal(containsThaiKeyword('มีอยู่ไหมคะ', 'มีอย'), false)
  assert.equal(containsThaiKeyword('เหมาะกับใคร แต่ถ้าเหมาหมดลดไหม', 'เหมา'), true)
})

test('keywords still match as words, including before particles and other words', () => {
  assert.equal(containsThaiKeyword('ขอเหมาทั้งหมดได้ไหม', 'เหมา'), true)
  assert.equal(containsThaiKeyword('แพงไปนิด', 'แพง'), true)
  assert.equal(containsThaiKeyword('ลดได้ไหมคะ', 'ลดได้ไหม'), true)
  assert.equal(containsThaiKeyword('มีอย.ไหม', 'มีอย'), true)
  assert.equal(containsThaiKeyword('ขอคิดดูก่อน', 'คิดดูก่อน'), true)
  assert.equal(containsThaiKeyword('ส่วนลด', 'ลด'), true)
})

const ORDER = /(เอาเลย|เอาค่ะ|สั่งเลย|เก็บปลายทาง|พร้อมโอน)/

test('a phrase right after ไม่ is a refusal, not an order', () => {
  assert.equal(hasUnnegatedMatch('ยังไม่เอาเลยค่ะ ขอบคุณค่ะ', ORDER), false)
  assert.equal(hasUnnegatedMatch('ไม่ต้องเก็บปลายทางนะ', ORDER), false)
  assert.equal(hasUnnegatedMatch('ไม่ได้ สั่งเลย', ORDER), false)
})

test('orders still count, also next to an unrelated ไม่', () => {
  assert.equal(hasUnnegatedMatch('เอาเลยค่ะ ตัวนี้ 1 ตัว', ORDER), true)
  assert.equal(hasUnnegatedMatch('ไม่ต้องห่อของขวัญ สั่งเลยค่ะ', ORDER), true)
  assert.equal(hasUnnegatedMatch('ไม่เอาสีแดง เอาค่ะสีดำ', ORDER), true)
  assert.equal(hasUnnegatedMatch('เอาสีดำ L 2 ตัว เก็บปลายทางค่ะ', ORDER), true)
})

test('hand-off phrases pause the bot with any polite ending', () => {
  for (const text of [
    'ขอคุยกับแอดมิน',
    'ขอคุยกับแอดมินค่ะ',
    ' ขอคุยกับแอดมินนะคะ ',
    'ขอคุยกับเจ้าหน้าที่หน่อยครับ 🙏',
    'ติดต่อเจ้าหน้าที่ด้วยค่ะ!!',
    '/admin',
    '/HUMAN',
  ]) {
    assert.equal(isHandoffRequest(text), true, text)
  }
})

test('other messages do not pause the bot', () => {
  for (const text of [
    'ไม่ต้องให้แอดมินตอบนะคะ',
    'ขอคุยกับแอดมินเรื่องราคาส่ง', // more than the phrase: left to the bot, as before
    'แอดมินคะ',
    '/admin-link ADM-123456',
    'สวัสดีค่ะ',
  ]) {
    assert.equal(isHandoffRequest(text), false, text)
  }
})
