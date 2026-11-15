import assert from 'node:assert/strict'
import test from 'node:test'
import { INFO_ONLY_PROMPT } from '../src/lib/ai/salesModes.ts'

test('info-only mode lists offers from knowledge without adding unsolicited prices', () => {
  assert.match(INFO_ONLY_PROMPT, /ตอบชื่อ\/ประเภทสินค้า/)
  assert.match(INFO_ONLY_PROMPT, /ห้ามตอบว่าไม่มีข้อมูลเพียงเพราะแคตตาล็อกว่าง/)
  assert.match(INFO_ONLY_PROMPT, /อย่าใส่ราคา จำนวนคน เปอร์เซ็นต์/)
})
