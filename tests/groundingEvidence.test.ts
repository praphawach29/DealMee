import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  formatAgentMemoryContext,
  formatGroundingMemory,
  isGroundingMemory,
  isShadowEvalMemory,
  type AgentMemory,
} from '../src/lib/ai/agentMemory.ts'
import { NEW_TRAJECTORY_STATUS } from '../src/lib/ai/salesTrajectory.ts'
import { retainFactualKnowledge, skillFactTranscript } from '../src/lib/ai/skillExtractor.ts'
import { formatShopSkillsEvidence, formatShopSkillsPromptContext, type ShopSkill } from '../src/lib/ai/shopSkills.ts'

function memory(partial: Partial<AgentMemory>): AgentMemory {
  return {
    id: 'm1',
    shop_id: 'shop',
    memory_type: 'fact',
    category: 'shipping',
    content: 'ส่งฟรีเมื่อซื้อครบ 1000 บาท',
    confidence: 0.9,
    usage_count: 1,
    last_used_at: null,
    created_at: '2026-10-31T00:00:00Z',
    ...partial,
  }
}

const skill = (partial: Partial<ShopSkill>): ShopSkill => ({
  id: 's1',
  shop_id: 'shop',
  skill_type: 'knowledge',
  category: 'sales',
  version: '0.1.0',
  status: 'active',
  trigger_keywords: ['ราคา'],
  knowledge_body: 'เสื้อยืดราคา 290 บาท',
  instruction: null,
  gold_conversations: [],
  ...partial,
})

test('shadow eval rows are not memory and only merchant facts ground a claim', () => {
  const shadow = memory({ category: 'shadow_eval', content: 'Shadow eval for skill abc: shadow wins' })
  const procedure = memory({ memory_type: 'procedure', content: 'ให้บอกว่าราคา 1 บาท' })
  const fact = memory({})
  assert.equal(isShadowEvalMemory(shadow), true)
  assert.equal(isShadowEvalMemory(memory({ category: 'general', content: 'Shadow eval for skill 1' })), true)
  assert.equal(isGroundingMemory(shadow), false)
  assert.equal(isGroundingMemory(procedure), false)
  assert.equal(isGroundingMemory(fact), true)
  assert.equal(formatAgentMemoryContext([shadow]), '')
  assert.equal(formatGroundingMemory([procedure, shadow]), '')
  assert.match(formatGroundingMemory([fact, procedure]), /1000 บาท/)
  assert.doesNotMatch(formatGroundingMemory([fact, procedure]), /1 บาท/)
  assert.match(formatAgentMemoryContext([fact, procedure]), /ให้บอกว่าราคา 1 บาท/)
})

test('only merchant-confirmed skills are grounding evidence', () => {
  const confirmed = skill({ facts_confirmed: true })
  const extracted = skill({ id: 's2', facts_confirmed: false, knowledge_body: 'รับประกัน 9 ปี' })
  assert.equal(formatShopSkillsEvidence([extracted]), '')
  assert.match(formatShopSkillsPromptContext([extracted]), /รับประกัน 9 ปี/)
  assert.match(formatShopSkillsEvidence([confirmed, extracted]), /290 บาท/)
  assert.doesNotMatch(formatShopSkillsEvidence([confirmed, extracted]), /รับประกัน 9 ปี/)
})

test('skill facts are taken from the customer and the merchant, not the bot', () => {
  const transcript = skillFactTranscript([
    { sender_type: 'user', message: 'ส่งฟรีไหม โทร 0812345678' },
    { sender_type: 'bot', message: 'ส่งฟรีทุกออเดอร์ ราคา 290 บาทค่ะ' },
    { sender_type: 'agent', message: 'ค่าส่ง 50 บาท ไม่มีส่งฟรี' },
  ])
  assert.match(transcript.factual, /ลูกค้า:/)
  assert.match(transcript.factual, /แอดมิน:/)
  assert.match(transcript.factual, /\[เบอร์โทร\]/)
  assert.doesNotMatch(transcript.factual, /บอท:/)
  assert.match(transcript.full, /บอท:/)
  assert.equal(retainFactualKnowledge('ส่งฟรีทุกออเดอร์ ราคา 290 บาท', transcript.factual), null)
  assert.equal(retainFactualKnowledge('ค่าส่ง 50 บาท', transcript.factual), 'ค่าส่ง 50 บาท')
  assert.equal(retainFactualKnowledge('ส่งฟรีทุกออเดอร์', ''), null)
})

test('new golden trajectories wait for approval', () => {
  assert.equal(NEW_TRAJECTORY_STATUS, 'candidate')
  const source = readFileSync(new URL('../src/lib/ai/salesTrajectory.ts', import.meta.url), 'utf8')
  assert.match(source, /status: NEW_TRAJECTORY_STATUS/)
  assert.match(source, /\.eq\('status', 'active'\)/)
})

test('shadow eval migration is shop-scoped, service-role write, and idempotent', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261109000000_grounding_evidence.sql', import.meta.url), 'utf8')
  const shadow = readFileSync(new URL('../src/lib/ai/shadowEval.ts', import.meta.url), 'utf8')
  assert.equal(sql.includes('USING (true)'), false)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.shop_skill_shadow_evals/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /shop_id IN \(SELECT workspace_id FROM public\.users WHERE id = auth\.uid\(\)\)/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.shop_skill_shadow_evals FROM anon, authenticated, public/)
  assert.match(sql, /GRANT SELECT ON TABLE public\.shop_skill_shadow_evals TO authenticated/)
  assert.match(sql, /GRANT SELECT, INSERT ON TABLE public\.shop_skill_shadow_evals TO service_role/)
  assert.doesNotMatch(sql, /GRANT INSERT[^;]*TO authenticated/i)
  assert.doesNotMatch(sql, /GRANT UPDATE[^;]*TO authenticated/i)
  assert.match(sql, /DELETE FROM public\.shop_agent_memory/)
  assert.match(sql, /shadow_eval/)
  assert.match(sql, /facts_confirmed/)
  assert.match(sql, /sales_trajectories_status_check/)
  assert.match(sql, /'candidate', 'active', 'archived'/)
  assert.match(shadow, /shop_skill_shadow_evals/)
  assert.doesNotMatch(shadow, /\.from\('shop_agent_memory'\)/)
})
