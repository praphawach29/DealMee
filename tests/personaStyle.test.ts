import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPersona, isMalePersona } from '../src/lib/ai/personaStyle.ts'

test('each dropdown choice becomes explicit rules, not the bare value', () => {
  for (const value of ['หญิง-สุภาพ', 'หญิง-น่ารัก', 'ชาย-สุภาพ', 'ชาย-เป็นกันเอง']) {
    const block = formatPersona(value)
    assert.ok(!block.includes(`: ${value}`), value)
    assert.match(block, /ลงท้าย/, value)
  }
})

test('a male voice ends in ครับ, bans ค่ะ/คะ, and rewrites the female examples', () => {
  const block = formatPersona('ชาย-สุภาพ')
  assert.match(block, /"ครับ"/)
  assert.match(block, /ห้ามใช้ "ค่ะ" "คะ"/)
  assert.match(block, /ให้เปลี่ยนเป็น "ครับ"/)
  assert.equal(isMalePersona('ชาย-เป็นกันเอง'), true)
})

test('a female voice gets no rewrite note', () => {
  const block = formatPersona('หญิง-สุภาพ')
  assert.match(block, /"ค่ะ"/)
  assert.ok(!block.includes('ให้เปลี่ยนเป็น "ครับ"'))
  assert.equal(isMalePersona('หญิง-น่ารัก'), false)
})

test('a choice saved with extra words keeps the choice rules and the words', () => {
  const block = formatPersona('ชาย-สุภาพ กระชับ')
  assert.match(block, /ห้ามใช้ "ค่ะ" "คะ"/)
  assert.match(block, /เพิ่มเติม: กระชับ/)
  assert.match(formatPersona('หญิง-สุภาพ อบอุ่น'), /"ค่ะ".*เพิ่มเติม: อบอุ่น/)
})

test('old free-text values pass through, and empty falls back to the default', () => {
  assert.match(formatPersona('ร่าเริง ใช้คำว่าจ้า'), /ร่าเริง ใช้คำว่าจ้า/)
  for (const empty of ['', null, undefined]) assert.match(formatPersona(empty), /สุภาพ เรียบร้อย มืออาชีพ/)
})
