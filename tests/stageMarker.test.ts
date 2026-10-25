import assert from 'node:assert/strict'
import test from 'node:test'
import { extractStageTag, STAGE_TAG_INSTRUCTION } from '../src/lib/ai/stageMarker.ts'

test('the stage tag is read and removed before the reply is sent', () => {
  const r = extractStageTag('ได้เลยค่ะ สรุปออเดอร์เสื้อสีดำ L 2 ตัว รวม 580 บาทนะคะ\n[[stage:closing]]')
  assert.equal(r.stage, 'closing')
  assert.equal(r.text, 'ได้เลยค่ะ สรุปออเดอร์เสื้อสีดำ L 2 ตัว รวม 580 บาทนะคะ')
})

test('spacing, case and a full-width colon are tolerated', () => {
  assert.equal(extractStageTag('ok [[ Stage : Showcase ]]').stage, 'showcase')
  assert.equal(extractStageTag('ok [[stage：discovery]]').stage, 'discovery')
})

test('the last valid tag wins and every tag is removed', () => {
  const r = extractStageTag('[[stage:greeting]] สวัสดีค่ะ\n\n\nมีอะไรให้ช่วยไหมคะ\n[[stage:discovery]]')
  assert.equal(r.stage, 'discovery')
  assert.equal(r.text, 'สวัสดีค่ะ\n\nมีอะไรให้ช่วยไหมคะ')
})

test('an unknown or malformed tag gives no stage and never reaches the customer', () => {
  for (const reply of ['ขอบคุณค่ะ [[stage:buying]]', 'ขอบคุณค่ะ [[stage:closing]', 'ขอบคุณค่ะ [[stage]]', 'ขอบคุณค่ะ [[sta']) {
    const r = extractStageTag(reply)
    assert.equal(r.text, 'ขอบคุณค่ะ', reply)
  }
  assert.equal(extractStageTag('ขอบคุณค่ะ [[stage:buying]]').stage, null)
  assert.equal(extractStageTag('ขอบคุณค่ะ [[stage:closing]').stage, 'closing')
})

test('a reply without a tag is left as it is', () => {
  const r = extractStageTag('ราคา [590] บาทค่ะ')
  assert.equal(r.stage, null)
  assert.equal(r.text, 'ราคา [590] บาทค่ะ')
})

test('the instruction names every stage the model may use', () => {
  for (const stage of ['greeting', 'discovery', 'showcase', 'closing']) {
    assert.ok(STAGE_TAG_INSTRUCTION.includes(`${stage} =`), stage)
  }
  assert.ok(STAGE_TAG_INSTRUCTION.includes('[[stage:'))
})
