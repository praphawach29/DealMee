import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CONSULTANT_THINKING } from '../src/lib/ai/consultantMode.ts'
import { GROUNDING_RULES } from '../src/lib/ai/grounding.ts'
import { looksLikeReasoningLeak } from '../src/lib/ai/reasoningLeak.ts'
import { formatSalesStagePromptContext } from '../src/lib/ai/salesWorkflow.ts'

const engine = readFileSync(new URL('../src/lib/ai/salesAgentEngine.ts', import.meta.url), 'utf8')

test('the bot works out the goal, stays consistent, offers workarounds and teaches step by step', () => {
  assert.match(CONSULTANT_THINKING, /ลูกค้าพยายามทำอะไรให้สำเร็จ/)
  // 24 Nov 2026: "ไม่ได้ค่ะ" to the push mode it had described five minutes earlier
  assert.match(CONSULTANT_THINKING, /ห้ามตอบขัด/)
  // the owner's shift times were asked for again instead of used
  assert.match(CONSULTANT_THINKING, /ห้ามถามซ้ำ/)
  assert.match(CONSULTANT_THINKING, /ทางที่ใกล้ที่สุดซึ่งใช้ฟีเจอร์ที่มีอยู่ในข้อมูลจริงเท่านั้น/)
  assert.match(CONSULTANT_THINKING, /ขั้น 1-2-3/)
})

test('the thinking stays private, so the leak guard is not needed to hide it', () => {
  assert.match(CONSULTANT_THINKING, /คิดในใจ แล้วส่งเฉพาะคำตอบถึงลูกค้า/)
  // A reply that follows the block is a normal reply, not a leak
  assert.equal(looksLikeReasoningLeak('ทำได้ค่ะ ตั้งเป็นโหมด Push ทุกครั้งได้เลย แต่จะใช้โควตาข้อความเร็วขึ้นนะคะ'), false)
})

test('a customer who is setting up gets a setup guide, not a sales close', () => {
  assert.match(CONSULTANT_THINKING, /\[โหมดช่วยใช้งาน\]/)
  assert.match(CONSULTANT_THINKING, /ไม่ต้องใช้กฎปิดการขาย/)
  assert.match(engine, /กฎข้อ 1, 4, 7 และ 8 ด้านล่างใช้กับลูกค้าที่กำลังตัดสินใจซื้อ/)
  assert.match(formatSalesStagePromptContext('showcase'), /\[โหมดช่วยใช้งาน\]/)
  assert.match(formatSalesStagePromptContext('post_sale'), /พาทำจนเสร็จก่อน/)
})

test('a partial answer comes before any hand-off', () => {
  assert.match(CONSULTANT_THINKING, /ตอบส่วนที่ยืนยันได้จากข้อมูลก่อนเสมอ/)
  assert.match(GROUNDING_RULES, /ถ้ามีข้อมูลที่ช่วยได้บางส่วน/)
  assert.match(GROUNDING_RULES, /ห้ามเติมความสามารถที่ข้อมูลไม่ได้เขียนไว้/)
})

test('both the sales and the Q&A prompt carry the consultant block', () => {
  assert.equal(engine.match(/\$\{CONSULTANT_THINKING\}/g)?.length, 2)
})
