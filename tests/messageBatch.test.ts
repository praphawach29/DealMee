import assert from 'node:assert/strict'
import test from 'node:test'
import { BATCH_MAX_SPAN_MS, mergeCustomerTexts, pendingCustomerTurn, supersededTextEvents } from '../src/lib/line/messageBatch.ts'

const at = (seconds: number) => new Date(Date.UTC(2026, 10, 24, 9, 35, 0) + seconds * 1000).toISOString()

test('two quick messages are answered once, by the newer one, with both texts', () => {
  // CheckMee, 24 Nov 2026 09:35: two messages four seconds apart got two replies
  const turn = pendingCustomerTurn([
    { id: 'b0', sender_type: 'bot', message: 'แจ้งเตือนได้ค่ะ', created_at: at(-60) },
    { id: 'u1', sender_type: 'user', message: 'เวลาพนักงานลงเข้าออกงานจะขึ้นแจ้งเตือนของเรามั้ยคะ', created_at: at(0) },
    { id: 'u2', sender_type: 'user', message: 'หรือว่าต้องกดเข้าไปดูเท่านั้น', created_at: at(4) },
  ])
  assert.equal(turn?.latestId, 'u2')
  assert.deepEqual(turn?.texts, ['เวลาพนักงานลงเข้าออกงานจะขึ้นแจ้งเตือนของเรามั้ยคะ', 'หรือว่าต้องกดเข้าไปดูเท่านั้น'])
  assert.equal(mergeCustomerTexts(turn!.texts), 'เวลาพนักงานลงเข้าออกงานจะขึ้นแจ้งเตือนของเรามั้ยคะ\nหรือว่าต้องกดเข้าไปดูเท่านั้น')
})

test('the older message sees a newer one and stays silent', () => {
  const turn = pendingCustomerTurn([
    { id: 'u1', sender_type: 'user', message: 'ก', created_at: at(0) },
    { id: 'u2', sender_type: 'user', message: 'ข', created_at: at(3) },
  ])
  assert.notEqual(turn?.latestId, 'u1')
})

test('messages the bot or an admin already answered are not repeated', () => {
  const turn = pendingCustomerTurn([
    { id: 'u1', sender_type: 'user', message: 'เก่า', created_at: at(0) },
    { id: 'a1', sender_type: 'admin', message: 'ตอบแล้วค่ะ', created_at: at(10) },
    { id: 'u2', sender_type: 'user', message: 'ใหม่', created_at: at(20) },
  ])
  assert.deepEqual(turn?.texts, ['ใหม่'])
})

test('messages left unanswered long ago are not pulled into a new reply', () => {
  const turn = pendingCustomerTurn([
    { id: 'u1', sender_type: 'user', message: 'ตอนแอดมินพักบอท', created_at: at(0) },
    { id: 'u2', sender_type: 'user', message: 'ใหม่', created_at: at(BATCH_MAX_SPAN_MS / 1000 + 60) },
  ])
  assert.deepEqual(turn?.texts, ['ใหม่'])
})

test('commands and image placeholders are left out of the merged text', () => {
  const turn = pendingCustomerTurn([
    { id: 'u1', sender_type: 'user', message: '[รูปภาพ]', created_at: at(0) },
    { id: 'u2', sender_type: 'user', message: '/ai', created_at: at(1) },
    { id: 'u3', sender_type: 'user', message: 'คืออะไรคะ', created_at: at(2) },
  ])
  assert.deepEqual(turn?.texts, ['คืออะไรคะ'])
})

test('a newest message from the bot means nothing is pending', () => {
  assert.equal(pendingCustomerTurn([{ id: 'b', sender_type: 'bot', message: 'x', created_at: at(0) }]), null)
  assert.equal(pendingCustomerTurn([]), null)
})

test('in one delivery, only the last text from each customer answers', () => {
  const text = (userId: string, t: string) => ({ type: 'message', message: { type: 'text', text: t }, source: { userId } })
  const image = (userId: string) => ({ type: 'message', message: { type: 'image' }, source: { userId } })
  const result = supersededTextEvents([text('A', 'หนึ่ง'), image('A'), text('B', 'x'), text('A', 'สอง')])
  assert.deepEqual([...result], [0])
})

test('a trailing command does not silence the messages before it', () => {
  const text = (t: string) => ({ type: 'message', message: { type: 'text', text: t }, source: { userId: 'A' } })
  assert.deepEqual([...supersededTextEvents([text('ถามหน่อย'), text('/ai')])], [])
})
