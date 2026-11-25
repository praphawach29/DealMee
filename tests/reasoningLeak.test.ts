import assert from 'node:assert/strict'
import test from 'node:test'
import { formatShopRules, looksLikeReasoningLeak, recoverReplyFromLeak, SHOP_RULES_MAX_CHARS, stripThinkBlocks } from '../src/lib/ai/reasoningLeak.ts'

test('the owner rules box reaches the prompt, with an instruction not to recite it', () => {
  const block = formatShopRules('  ห้ามให้ส่วนลด\nตอบไม่เกิน 6 บรรทัด  ')
  assert.match(block, /ห้ามให้ส่วนลด\nตอบไม่เกิน 6 บรรทัด\n/)
  assert.match(block, /ไม่ต้องทวน/)
})

test('an empty or missing rules box adds nothing', () => {
  for (const raw of ['', '   ', null, undefined]) assert.equal(formatShopRules(raw), '')
})

test('very long rules are cut to the limit', () => {
  const block = formatShopRules('ก'.repeat(SHOP_RULES_MAX_CHARS + 500))
  assert.ok(block.includes('ก'.repeat(SHOP_RULES_MAX_CHARS)))
  assert.ok(!block.includes('ก'.repeat(SHOP_RULES_MAX_CHARS + 1)))
})

// The reply a CheckMee customer received on LINE, 25 Nov 2026.
const FINAL = 'ดีเลยค่ะ ขั้นตอนเริ่มต้นใช้งานง่ายมากๆ ตามนี้เลยนะคะ 1. เข้าเว็บ checkmee.app แล้วกดสมัครใช้งาน 2. ตั้งชื่อบริษัทและข้อมูลเบื้องต้น 3. รับรหัสลงทะเบียนส่งให้พนักงานสแกนเข้าใช้งานใน LINE ได้ทันทีค่ะ สามารถดูคลิปเริ่มใช้งานครั้งแรกได้ที่ checkmee.app/#setup นะคะ ลองกดสมัครแล้ว ติดขัดขั้นตอนไหนสอบถามน้อง Check ได้ตลอดเลยนะคะ\n[[stage:closing]]'
const LEAKED =
  'ลูกค้าบอก "สะดวกครับ" หลังชวนสมัครใช้งานที่ checkmee.app ต้องให้ขั้นตอนเริ่มต้นใช้งานง่ายๆ สั้นๆ กระชับตามสไตล์ น้อง Check (ไม่เกิน 6-8 บรรทัด ตอบแบบข้อ 1-2-3 หรือให้ลิงก์สมัคร) ' +
  'อ้างอิงข้อมูล: สมัครใช้งานที่ checkmee.app และลงท้ายด้วย Bridge question หรือ Alternative close 1 คำถาม ไม่มี markdown (ห้ามตัวหนา ห้ามดอกจัน) ' +
  'เขียนตอบ: ดีเลยค่ะ ขั้นตอนการเริ่มต้นใช้งานง่ายมากๆ ตามนี้เลยนะคะ 1. เข้าไปที่เว็บ checkmee.app แล้วกดสมัครใช้งาน 2. ตั้งชื่อบริษัทและเวลาทำงาน 3. สร้างรหัสลงทะเบียนส่งให้พนักงานกดเข้าใน LINE ได้เลยค่ะ ' +
  'ตรวจกฎ: - ภาษาไทย สุภาพ เป็นกันเอง ลงท้าย ค่ะ คำถาม คะ - ไม่เกิน 6-8 บรรทัด - plain text ไม่มี markdown - stage tag ท้ายข้อความ ตอนนี้ลูกค้าตกลงจะสมัครแล้ว = closing - ใส่ cite ถ้ามี (คลิป https://checkmee.app/#setup อยู่ในคำสั่งบอท)' +
  FINAL

test('the leaked CheckMee reply is caught', () => {
  assert.equal(looksLikeReasoningLeak(LEAKED), true)
})

test('the rewrite after the checklist is what the customer gets', () => {
  assert.equal(recoverReplyFromLeak(LEAKED), FINAL)
})

test('without a rewrite the draft itself is used', () => {
  const draftOnly = LEAKED.slice(0, LEAKED.indexOf('ตรวจกฎ'))
  const reply = recoverReplyFromLeak(draftOnly + 'ตรวจกฎ: - ไม่มี markdown - stage tag ครบ')
  assert.ok(reply?.startsWith('ดีเลยค่ะ ขั้นตอนการเริ่มต้น'))
  assert.equal(looksLikeReasoningLeak(reply!), false)
})

test('notes with no draft to fall back on give null', () => {
  assert.equal(recoverReplyFromLeak('ลูกค้าบอก "โอเค" ต้องตอบไม่เกิน 3 บรรทัด ไม่มี markdown'), null)
})

test('normal customer replies are left alone', () => {
  for (const reply of [
    FINAL,
    'สวัสดีค่ะ มีอะไรให้น้อง Check ช่วยไหมคะ',
    'ราคาแพ็กเกจเริ่มต้น 990 บาทต่อเดือนค่ะ รองรับพนักงานไม่เกิน 10 คน สนใจลองใช้ฟรีก่อนไหมคะ',
  ]) {
    assert.equal(looksLikeReasoningLeak(reply), false, reply)
  }
})

test('<think> blocks are removed, including one whose opening tag was dropped', () => {
  assert.equal(stripThinkBlocks('<think>ลูกค้าถามราคา</think>\nราคา 990 บาทค่ะ'), 'ราคา 990 บาทค่ะ')
  assert.equal(stripThinkBlocks('ลูกค้าถามราคา</think>ราคา 990 บาทค่ะ'), 'ราคา 990 บาทค่ะ')
  assert.equal(stripThinkBlocks('ราคา 990 บาทค่ะ'), 'ราคา 990 บาทค่ะ')
})
