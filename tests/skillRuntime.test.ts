import test from 'node:test'
import assert from 'node:assert/strict'
import { rankShopSkills, formatShopSkillsPromptContext, type ShopSkill } from '../src/lib/ai/shopSkills.ts'
const make = (id: string, changes: Partial<ShopSkill> = {}): ShopSkill => ({ id, shop_id: 'a', skill_type: 'behavior', category: 'public-service', status: 'active', version: '0.1.0', trigger_keywords: [], knowledge_body: null, instruction: 'ตอบตามเอกสารเท่านั้น', gold_conversations: [], ...changes })
test('approved no-keyword behavior loads for any question, not candidates or archived skills', () => {
  assert.deepEqual(rankShopSkills([make('base'), make('draft', { status: 'candidate' }), make('old', { status: 'archived' }), make('topic', { trigger_keywords: ['ใบอนุญาต'] })], 'สวัสดี').map(s => s.id), ['base'])
})
test('always-on rules are not displaced by matching topic skills', () => {
  const skills = [make('base'), ...Array.from({ length: 4 }, (_, i) => make(String(i), { trigger_keywords: ['ใบอนุญาต'] }))]
  assert.equal(rankShopSkills(skills, 'ใบอนุญาต', 3).length, 4)
})
test('full imported instruction survives prompt formatting including final rule', () => {
  const instruction = 'ก'.repeat(7000) + '\nห้ามรับรองผลคดี'
  assert.ok(formatShopSkillsPromptContext([make('base', { instruction })]).includes(instruction))
})
test('prompt budget overflow fails explicitly, never silently truncates rules', () => {
  assert.throws(() => formatShopSkillsPromptContext([make('base')], 10), /budget/i)
})
