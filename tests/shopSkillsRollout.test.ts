import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { shopSkillsRetrievalEnabled, shopSkillsTelemetryEnabled } from '../src/lib/ai/shopSkillsRollout.ts'

const originalFlag = process.env.SHOP_SKILLS_TELEMETRY_ENABLED
const originalRetrievalFlag = process.env.SHOP_SKILLS_RETRIEVAL_ENABLED

afterEach(() => {
  if (originalFlag === undefined) delete process.env.SHOP_SKILLS_TELEMETRY_ENABLED
  else process.env.SHOP_SKILLS_TELEMETRY_ENABLED = originalFlag
  if (originalRetrievalFlag === undefined) delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
  else process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = originalRetrievalFlag
})

test('shop skills telemetry is off by default', () => {
  delete process.env.SHOP_SKILLS_TELEMETRY_ENABLED
  assert.equal(shopSkillsTelemetryEnabled({ shop_skills_enabled: true }), false)
})

test('global rollout alone does not opt a shop in', () => {
  process.env.SHOP_SKILLS_TELEMETRY_ENABLED = 'true'
  assert.equal(shopSkillsTelemetryEnabled({}), false)
  assert.equal(shopSkillsTelemetryEnabled({ shop_skills_enabled: false }), false)
})

test('telemetry runs only when global and shop flags are both enabled', () => {
  process.env.SHOP_SKILLS_TELEMETRY_ENABLED = 'true'
  assert.equal(shopSkillsTelemetryEnabled({ shop_skills_enabled: true }), true)
})

test('retrieval requires tenant opt-in and supports global kill switch', () => {
  process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = 'false'
  assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: true }), false)
  process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = 'true'
  assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: false }), false)
  assert.equal(shopSkillsRetrievalEnabled({ shop_skills_enabled: true }), true)
})
