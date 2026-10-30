import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatShopSkillsPromptContext,
  nextSkillVersion,
  parseShopSkillInput,
  rankShopSkills,
  type ShopSkill,
} from '../src/lib/ai/shopSkills.ts'

const baseSkill: ShopSkill = {
  id: 'skill-1', shop_id: 'shop-1', skill_type: 'knowledge', category: 'sales',
  version: '0.1.0', status: 'active', trigger_keywords: ['ส่งด่วน'],
  knowledge_body: 'จัดส่งภายในวันทำการถัดไป', instruction: null, gold_conversations: [],
}

test('skill input is bounded and requires useful content', () => {
  assert.equal(parseShopSkillInput({ category: 'sales' }).error, 'Knowledge or instruction is required')
  const parsed = parseShopSkillInput({
    skill_type: 'rule', category: ' shipping ', instruction: ' ตอบตามจริง ',
    trigger_keywords: ['ด่วน', 'ด่วน', 1, 'x'.repeat(100)],
  })
  assert.equal(parsed.data?.category, 'shipping')
  assert.deepEqual(parsed.data?.trigger_keywords, ['ด่วน', 'x'.repeat(80)])
})

test('skill versions increment safely', () => {
  assert.equal(nextSkillVersion('1.4.9'), '1.4.10')
  assert.equal(nextSkillVersion('bad'), '0.1.0')
})

test('matching trigger keywords rank first', () => {
  const other = { ...baseSkill, id: 'skill-2', trigger_keywords: ['รับประกัน'] }
  assert.equal(rankShopSkills([other, baseSkill], 'ขอส่งด่วนวันนี้')[0]?.id, 'skill-1')
  assert.deepEqual(rankShopSkills([other, baseSkill], 'สวัสดี'), [])
})

test('prompt context includes guardrail and respects size cap', () => {
  const context = formatShopSkillsPromptContext([baseSkill], 4000)
  assert.match(context, /APPROVED ORGANIZATION SKILLS/)
  assert.match(context, /ห้ามใช้ข้อมูลส่วนนี้แทนข้อมูลจริง/)
  assert.ok(context.length <= 4000)
  assert.throws(() => formatShopSkillsPromptContext([baseSkill], 180), /budget/)
})
