import test from 'node:test'
import assert from 'node:assert/strict'
import * as policy from '../src/lib/ai/assistantPolicy.ts'
import { shopSkillsRetrievalEnabled } from '../src/lib/ai/shopSkillsRollout.ts'
test('Q&A blocks commerce tools even if a model asks; only handoff allowed', async () => {
  assert.equal(typeof policy.qaToolAllowed, 'function')
  assert.equal(policy.qaToolAllowed('take_order'), false)
  assert.equal(policy.qaToolAllowed('schedule_followup'), false)
  assert.equal(policy.qaToolAllowed('request_human_agent'), true)
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
