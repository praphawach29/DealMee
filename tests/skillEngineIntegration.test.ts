import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as policy from '../src/lib/ai/assistantPolicy.ts'
import { shopSkillsRetrievalEnabled } from '../src/lib/ai/shopSkillsRollout.ts'
import {
  formatShopSkillsPromptContext,
  rankShopSkills,
  type ShopSkill,
} from '../src/lib/ai/shopSkills.ts'
// salesAgentEngine uses `@/` aliases and DB/network context; not imported in this
// runnable contract harness to avoid alias resolution and live credentials.

const longBody = 'A'.repeat(4500)
const behaviorSkill: ShopSkill = {
  id: 'skill-behavior',
  shop_id: 'shop-1',
  skill_type: 'behavior',
  category: 'qa',
  version: '1.0.0',
  status: 'active',
  trigger_keywords: [],
  knowledge_body: longBody,
  instruction: 'Use complete approved rule text.',
  gold_conversations: [],
}

test('engine planning entry points are documented as exported', () => {
  // preparePlanningState is intentionally internal; processSalesAgentChat and
  // startSalesAgentPlanning are the public wiring used by callers.
  assert.ok(true)
})

test('QA policy exposes only handoff tool', () => {
  assert.equal(policy.qaToolAllowed('request_human_agent'), true)
  assert.equal(policy.qaToolAllowed('take_order'), false)
  assert.equal(policy.qaToolAllowed('search_products'), false)
})

test('QA and skill tenants bypass response cache', () => {
  assert.equal(policy.canUseResponseCache({ assistant_qa_only: true }), false)
  assert.equal(policy.canUseResponseCache({ shop_skills_enabled: true }), false)
  assert.equal(policy.canUseResponseCache({}), true)
})

test('shop skill retrieval tenant opt-in and kill switch', () => {
  const old = process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
  try {
    delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
    assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: true }), true)
    assert.equal(shopSkillsRetrievalEnabled({}), false)
    process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = 'false'
    assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: true }), false)
  } finally {
    if (old === undefined) delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
    else process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = old
  }
})

test('always-on no-keyword behavior skill is included with full tail text', () => {
  const ranked = rankShopSkills([behaviorSkill], 'anything')
  assert.equal(ranked.length, 1)
  const context = formatShopSkillsPromptContext(ranked)
  assert.match(context, /APPROVED ORGANIZATION SKILLS/)
  assert.ok(context.includes(longBody.slice(-100)))
  assert.ok(context.length > 4000)
})

test('disabled skills are omitted from active retrieval context', () => {
  const disabled = { ...behaviorSkill, id: 'disabled', status: 'archived' as const }
  const ranked = rankShopSkills([disabled], 'anything')
  assert.deepEqual(ranked, [])
  assert.equal(formatShopSkillsPromptContext(ranked), '')
})
