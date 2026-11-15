import test from 'node:test'
import assert from 'node:assert/strict'
import * as policy from '../src/lib/ai/assistantPolicy.ts'
import { shopSkillsRetrievalEnabled } from '../src/lib/ai/shopSkillsRollout.ts'
test('Q&A blocks commerce tools even if a model asks; only handoff and knowledge search allowed', async () => {
  assert.equal(typeof policy.qaToolAllowed, 'function')
  assert.equal(policy.qaToolAllowed('take_order'), false)
  assert.equal(policy.qaToolAllowed('schedule_followup'), false)
  assert.equal(policy.qaToolAllowed('search_products'), false)
  assert.equal(policy.qaToolAllowed('book_appointment'), false)
  assert.equal(policy.qaToolAllowed('request_human_agent'), true)
  // The retrieval-miss note tells the model to search the knowledge base first.
  assert.equal(policy.qaToolAllowed('search_knowledge_base'), true)
})

test('Q&A catalog context lists products and services so broad questions can be answered', () => {
  const text = policy.formatQaCatalogContext({
    description: 'ระบบลงเวลาทำงานผ่าน LINE',
    products: [
      { name: 'แพ็กเกจ Starter', price: 990, category: 'แพ็กเกจรายเดือน', description: 'สำหรับทีมไม่เกิน 10 คน' },
      { name: 'แพ็กเกจ Pro', price: 0 },
    ],
    services: [{ name: 'ติดตั้งและอบรม', description: 'ทีมงานช่วยตั้งค่าระบบ', duration_minutes: 60 }],
  })
  assert.match(text, /ระบบลงเวลาทำงานผ่าน LINE/)
  assert.match(text, /- แพ็กเกจ Starter \(สำหรับทีมไม่เกิน 10 คน\) \[หมวดหมู่: แพ็กเกจรายเดือน\]: 990 บาท/)
  assert.match(text, /- แพ็กเกจ Pro\n/)
  assert.match(text, /- ติดตั้งและอบรม \(ทีมงานช่วยตั้งค่าระบบ\) ใช้เวลาประมาณ 60 นาที/)
  assert.match(text, /ไม่รับออเดอร์ ไม่จองคิว/)
})

test('Q&A catalog context is empty when the shop has nothing to list', () => {
  assert.equal(policy.formatQaCatalogContext({}), '')
  assert.equal(policy.formatQaCatalogContext({ description: '  ', products: [{ name: '' }], services: [] }), '')
})
test('skill and QA tenants never reuse unversioned response cache', () => {
  assert.equal(policy.canUseResponseCache({ shop_skills_enabled: true }), false)
  assert.equal(policy.canUseResponseCache({ assistant_qa_only: true }), false)
  assert.equal(policy.canUseResponseCache({}), true)
})
test('explicit tenant opt-in works without env deployment, false remains kill switch', () => {
 const old = process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
 try {
  delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
  assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: true }), true)
  assert.equal(shopSkillsRetrievalEnabled({}), false)
  process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = 'false'
  assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: true }), false)
 } finally { if (old === undefined) delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED; else process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = old }
})
