import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GROUNDING_HANDOFF } from '../src/lib/ai/grounding.ts'
import { redactPii } from '../src/lib/ai/redactPii.ts'
import { parseJudgeVerdict } from '../src/lib/ai/replyJudge.ts'
import { describeShadowResult, estimateShadowCostUsd, skillDigest } from '../src/lib/ai/shadowReport.ts'
import { runShadowComparison } from '../src/lib/ai/shadowRun.ts'
import { isSubstantiveCustomerTurn, selectShadowSamples, type ShadowMessage } from '../src/lib/ai/shadowSamples.ts'
import { createShadowExecutor, shadowBlockedToolMessage } from '../src/lib/ai/shadowSandbox.ts'
import { scoreShadowArm, type ShadowArmReplay } from '../src/lib/ai/shadowScore.ts'
import { shadowSkillContext } from '../src/lib/ai/shadowSkills.ts'
import type { ShopSkill } from '../src/lib/ai/shopSkills.ts'
import {
  classifyMessageComplexity,
  continueSalesAgentPlanning,
  planningStepLimit,
  type PlanningState,
} from '../src/lib/ai/salesAgentEngine.ts'
import { executeTool, type ToolExecutor } from '../src/lib/ai/toolDispatcher.ts'

const SHOP = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function skill(partial: Partial<ShopSkill> = {}): ShopSkill {
  return {
    id: 'skill-1',
    shop_id: SHOP,
    skill_type: 'knowledge',
    category: 'price',
    version: '0.1.0',
    status: 'candidate',
    trigger_keywords: ['ราคา'],
    knowledge_body: 'เสื้อยืดราคา 290 บาท',
    instruction: 'ตอบราคาจากข้อความนี้',
    gold_conversations: [],
    facts_confirmed: false,
    ...partial,
  }
}

function message(partial: Partial<ShadowMessage> & Pick<ShadowMessage, 'text'>): ShadowMessage {
  return {
    id: partial.id || `m-${partial.text.slice(0, 8)}`,
    shopId: partial.shopId || SHOP,
    conversationId: partial.conversationId || 'conv-1',
    userId: partial.userId || 'user-1',
    sender: partial.sender || 'user',
    text: partial.text,
    createdAt: partial.createdAt || '2026-10-31T00:00:00.000Z',
  }
}

const evidence = ['เสื้อยืด ราคา 290 บาท']

function arm(partial: Partial<ShadowArmReplay>): ShadowArmReplay {
  return {
    finalText: partial.finalText || '',
    draft: partial.draft || partial.finalText || '',
    toolCalls: partial.toolCalls || [],
    evidenceTexts: partial.evidenceTexts || evidence,
    chunks: partial.chunks || [],
    codEnabled: partial.codEnabled ?? true,
    judge: partial.judge,
  }
}

test('redactPii covers phones, mail, ids, and document numbers', () => {
  const raw = 'โทร 0812345678 หรือ 081-234-5678 หรือ +66 81 234 5678 อีเมล a.b+c@shop.co บัตร 1-2345-67890-12-1 LINE U1234567890abcdef1234567890abcdef ออเดอร์ ORD-55'
  const cleaned = redactPii(raw)
  assert.equal(cleaned.includes('0812345678'), false)
  assert.equal(cleaned.includes('081-234-5678'), false)
  assert.equal(cleaned.includes('+66'), false)
  assert.equal(cleaned.includes('a.b+c@shop.co'), false)
  assert.equal(cleaned.includes('1-2345-67890-12-1'), false)
  assert.equal(cleaned.includes('U1234567890abcdef1234567890abcdef'), false)
  assert.equal(cleaned.includes('ORD-55'), false)
  assert.match(cleaned, /\[เบอร์โทร\]/)
  assert.match(cleaned, /\[อีเมล\]/)
  assert.match(cleaned, /\[เลขบัตรประชาชน\]/)
  assert.match(cleaned, /\[LINE ID\]/)
  assert.match(cleaned, /\[เลขที่เอกสาร\]/)
  assert.equal(redactPii('ราคา 290 บาท'), 'ราคา 290 บาท')
})

test('a phone-only turn is not a sample and another shop is ignored', () => {
  assert.equal(isSubstantiveCustomerTurn(redactPii('0812345678')), false)
  const picked = selectShadowSamples({
    shopId: SHOP,
    skill: skill(),
    messages: [
      message({ id: 'short', text: 'ค่ะ' }),
      message({ id: 'phone', text: '0812345678' }),
      message({ id: 'other', shopId: OTHER, text: 'เสื้อราคาเท่าไหร่คะ ของอีกร้าน 0899999999' }),
      message({ id: 'ours', text: 'เสื้อราคาเท่าไหร่ โทร 0812345678 ได้ไหมคะ', createdAt: '2026-10-31T01:00:00.000Z' }),
      message({
        id: 'prior',
        text: 'สนใจเสื้อ',
        sender: 'bot',
      }),
    ],
    historyFor: () => [{ sender: 'bot', text: 'โทรกลับที่ 0812345678 นะคะ' }],
  })
  assert.equal(picked.found, 1)
  assert.equal(picked.enough, false)
  assert.equal(picked.samples[0].redactedText.includes('0812345678'), false)
  assert.match(picked.samples[0].redactedText, /\[เบอร์โทร\]/)
  assert.match(picked.samples[0].history[0].text, /\[เบอร์โทร\]/)
  assert.equal(picked.samples[0].history[0].text.includes('0812345678'), false)
})

test('keyword skills need three real matches and do not invent the rest', async () => {
  let calls = 0
  const result = await runShadowComparison({
    shopId: SHOP,
    skill: skill(),
    messages: [
      message({ id: 'a', text: 'เสื้อราคาเท่าไหร่คะ' }),
      message({ id: 'b', shopId: OTHER, text: 'เสื้อราคาเท่าไหร่ของอีกร้าน' }),
    ],
    skillsEnabled: true,
    confirmFacts: false,
    replay: async () => {
      calls += 1
      throw new Error('must not call the model')
    },
  })
  assert.equal(calls, 0)
  assert.equal(result.status, 'insufficient')
  assert.equal(result.found, 1)
  assert.equal(result.winner, 'pending')
  assert.match(result.recommendation, /ยังไม่พอ/)
  assert.match(result.recommendation, /ไม่ได้สร้างคำถามจำลอง/)
  assert.equal(JSON.stringify(result.metrics).includes('อีกร้าน'), false)
})

test('a grounded answer with the skill beats a handoff without it', async () => {
  const questions = ['เสื้อราคาเท่าไหร่คะ', 'ขอดูราคาสีขาว', 'ราคาโปรวันนี้เท่าไหร่']
  const result = await runShadowComparison({
    shopId: SHOP,
    skill: skill(),
    messages: questions.map((text, index) => message({ id: `q${index}`, text, createdAt: `2026-10-3${index}T00:00:00.000Z` })),
    skillsEnabled: false,
    confirmFacts: true,
    replay: async (_sample, which) => which === 'with'
      ? arm({
          finalText: 'เสื้อยืดราคา 290 บาทค่ะ',
          draft: 'เสื้อยืดราคา 290 บาทค่ะ',
          toolCalls: [{ name: 'search_products' }],
        })
      : arm({
          finalText: GROUNDING_HANDOFF.th,
          draft: 'เสื้อยืดราคา 99999 บาทค่ะ',
        }),
  })
  assert.equal(result.status, 'completed')
  assert.equal(result.winner, 'shadow')
  assert.equal(result.improved, 3)
  assert.equal(result.regressed, 0)
  assert.equal(result.groundedWith, 3)
  assert.equal(result.groundedWithout, 0)
  assert.match(result.recommendation, /ดีขึ้น 3/)
  assert.match(result.recommendation, /ไม่เปิดใช้สกิลให้อัตโนมัติ/)
  assert.match(result.recommendation, /ร้านยังปิดระบบสกิล/)
  assert.equal(result.metrics.samples && Array.isArray(result.metrics.samples), true)
  assert.equal(JSON.stringify(result.metrics).includes('99999'), false)
})

test('the same replies tie, and the judge can separate them', async () => {
  const questions = ['เสื้อราคาเท่าไหร่คะ', 'ขอดูราคาสีขาว', 'ราคาโปรวันนี้เท่าไหร่']
  const tied = await runShadowComparison({
    shopId: SHOP,
    skill: skill(),
    messages: questions.map((text, index) => message({ id: `t${index}`, text })),
    skillsEnabled: true,
    confirmFacts: true,
    replay: async () => arm({ finalText: GROUNDING_HANDOFF.th, draft: 'ไม่ทราบราคาค่ะ' }),
  })
  assert.equal(tied.winner, 'tie')
  assert.equal(tied.tied, 3)

  const judged = await runShadowComparison({
    shopId: SHOP,
    skill: skill(),
    messages: questions.map((text, index) => message({ id: `j${index}`, text })),
    skillsEnabled: true,
    confirmFacts: true,
    replay: async () => arm({ finalText: 'รับทราบค่ะ', draft: 'รับทราบค่ะ' }),
    judge: async (_input) => ({ pass: _input.answer.includes('มีสกิล') ? true : false, reason: 'ตรวจแล้ว', promptTokens: 4, completionTokens: 2 }),
  })
  // Both arms return the same text, so the judge sees the same answer.
  // Score them directly to prove a passing judge outranks a failing one.
  const customer = 'เสื้อราคาเท่าไหร่คะ'
  const better = scoreShadowArm(customer, arm({ finalText: 'รับทราบค่ะ', draft: 'รับทราบค่ะ', judge: { pass: true, reason: 'ok' } }))
  const worse = scoreShadowArm(customer, arm({ finalText: 'รับทราบค่ะ', draft: 'รับทราบค่ะ', judge: { pass: false, reason: 'no' } }))
  assert.ok(better.points > worse.points)
  assert.equal(judged.judgeUsed, true)
  assert.equal(judged.promptTokens, 3 * 2 * 4)
})

test('greeting handoff loses to a normal greeting', () => {
  const bad = scoreShadowArm('สวัสดีค่ะ', arm({
    finalText: GROUNDING_HANDOFF.th,
    draft: GROUNDING_HANDOFF.th,
    toolCalls: [{ name: 'request_human_agent' }],
    evidenceTexts: [],
  }))
  const good = scoreShadowArm('สวัสดีค่ะ', arm({
    finalText: 'สวัสดีค่ะ วันนี้สนใจสอบถามเรื่องอะไรคะ',
    draft: 'สวัสดีค่ะ วันนี้สนใจสอบถามเรื่องอะไรคะ',
    evidenceTexts: [],
  }))
  assert.ok(bad.reasons.includes('handoff_on_greeting'))
  assert.ok(good.points > bad.points)
})

test('claiming an order the sandbox blocked is worse', () => {
  const claimed = scoreShadowArm('เอาเสื้อยืด 1 ตัวค่ะ', arm({
    finalText: 'รับออเดอร์แล้วค่ะ',
    draft: 'รับออเดอร์แล้วค่ะ',
    evidenceTexts: [shadowBlockedToolMessage('take_order')],
    toolCalls: [{ name: 'take_order' }],
  }))
  assert.ok(claimed.reasons.includes('claimed_write'))
})

test('shadow skills stay inside the shop and unconfirmed text is not evidence', () => {
  const active = skill({ id: 'live', status: 'active', facts_confirmed: true, knowledge_body: 'ส่งฟรีเมื่อซื้อครบ 2 ชิ้น' })
  const outsider = skill({ id: 'other', shop_id: OTHER, knowledge_body: 'ความลับของอีกร้าน 999 บาท', facts_confirmed: true })
  const candidate = skill({ facts_confirmed: false })
  const hidden = shadowSkillContext([active, outsider], { omitSkillIds: [active.id], extraSkills: [outsider, candidate] }, SHOP)
  assert.deepEqual(hidden.skills.map((item) => item.id), ['skill-1'])
  assert.match(hidden.prompt, /290/)
  assert.equal(hidden.evidence.includes('290'), false)
  const confirmed = shadowSkillContext([], { extraSkills: [skill({ facts_confirmed: true })] }, SHOP)
  assert.match(confirmed.evidence, /290/)
})

test('sandbox refuses writes, redacts read results, and sends nothing', async () => {
  const calls: string[] = []
  const real: ToolExecutor = async (name) => {
    calls.push(name)
    return {
      resultForAi: 'ลูกค้า: สมชาย (0812345678) เสื้อยืด ราคา 290 บาท',
      immediateMessages: [{ type: 'text', content: 'ส่งให้ลูกค้า' }],
      scheduledMessage: { delayMs: 1000, message: { type: 'text', content: 'ตามภายหลัง' } },
    }
  }
  const sandbox = createShadowExecutor(real)
  const blocked = await sandbox('take_order', { product: 'เสื้อ' }, {} as never)
  assert.deepEqual(calls, [])
  assert.match(blocked.resultForAi, /ไม่ได้ดำเนินการ take_order/)
  assert.deepEqual(blocked.immediateMessages, [])
  const read = await sandbox('search_products', { keyword: 'เสื้อ' }, {} as never)
  assert.deepEqual(calls, ['search_products'])
  assert.equal(read.resultForAi.includes('0812345678'), false)
  assert.match(read.resultForAi, /\[เบอร์โทร\]/)
  assert.match(read.resultForAi, /\[ชื่อ\]/)
  assert.deepEqual(read.immediateMessages, [])
  assert.equal(read.scheduledMessage, undefined)
})

test('dryRun take_order never reaches the database', async () => {
  const supabase = { from() { throw new Error('database write') } }
  const result = await executeTool('take_order', { product: 'เสื้อ', qty: 1 }, {
    shopId: SHOP,
    userId: 'user-1',
    conversationId: 'conv-1',
    shop: { id: SHOP },
    supabase: supabase as never,
    supabaseAdmin: supabase as never,
    dryRun: true,
  })
  assert.match(result.resultForAi, /โหมดทดสอบ/)
  assert.deepEqual(result.immediateMessages, [])
})

test('a shadow planning loop does not call write tools and stops at the step cap', async () => {
  const calls: string[] = []
  const real: ToolExecutor = async (name) => {
    calls.push(name)
    return { resultForAi: 'เสื้อยืด ราคา 290 บาท', immediateMessages: [{ type: 'text', content: 'nope' }] }
  }
  let steps = 0
  const routing = classifyMessageComplexity('เสื้อยืดราคาเท่าไหร่คะ')
  const state: PlanningState = {
    shop: { id: SHOP, name: 'ร้านทดสอบ', cod_enabled: true },
    conversationId: 'conv-1',
    salesStage: 'discovery',
    isFirstCustomerTurn: true,
    language: 'th',
    turns: [{ role: 'user', text: 'เสื้อยืดราคาเท่าไหร่คะ' }],
    step: 0,
    routing,
    executor: createShadowExecutor(real),
    toolCtx: {
      shopId: SHOP,
      userId: 'user-1',
      conversationId: 'conv-1',
      shop: { id: SHOP },
      supabase: {} as never,
      supabaseAdmin: {} as never,
      dryRun: true,
    },
    staticSystemPrompt: 'test',
    dynamicSystemPrompt: '',
    systemInstruction: 'test',
    modelName: 'shadow-test',
    geminiKey: '',
    claudeKey: '',
    openAiKey: '',
    allUsage: [],
    immediateMessages: [],
    toolCallsExecuted: [],
    scheduledMessages: [],
    isPlayground: true,
    groundingChunks: [],
    groundingTexts: evidence,
    shadowReplay: true,
    maxSteps: 2,
    modelCaller: async () => {
      steps += 1
      if (steps === 1) return { text: '', toolCall: { name: 'take_order', args: { product: 'เสื้อยืด', qty: 1 }, id: '1' }, usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, provider: 'gemini' } }
      return { text: 'เสื้อยืดราคา 290 บาทค่ะ', usage: { promptTokens: 8, completionTokens: 4, totalTokens: 12, provider: 'gemini' } }
    },
  }
  const result = await continueSalesAgentPlanning(state)
  assert.equal(steps, 2)
  assert.deepEqual(calls, [])
  assert.deepEqual(result.immediateMessages, [])
  assert.equal(result.shadowTrace?.draft.includes('290'), true)
  assert.equal(result.usage?.promptTokens, 18)
  assert.equal(planningStepLimit({}), 6)
  assert.equal(planningStepLimit({ maxSteps: 2 }), 2)
  assert.equal(planningStepLimit({ maxSteps: 99 }), 6)
})

test('judge parser and cost estimate stay deterministic', () => {
  assert.deepEqual(parseJudgeVerdict('คำตอบ {"pass":true,"reason":"ตรงข้อมูล"}'), { pass: true, reason: 'ตรงข้อมูล' })
  assert.equal(parseJudgeVerdict('ไม่ใช่ json'), null)
  assert.equal(estimateShadowCostUsd(0, 0), null)
  assert.equal(estimateShadowCostUsd(1_000_000, 0), 0.3)
  const digestA = skillDigest(skill(), false)
  const digestB = skillDigest(skill(), true)
  assert.notEqual(digestA, digestB)
  assert.match(describeShadowResult({
    status: 'insufficient', sampleSize: 0, found: 1, improved: 0, regressed: 0, tied: 0,
    winner: 'pending', skillsEnabled: true, confirmFacts: false, judgeUsed: false,
  }), /พบ 1 ข้อ/)
})

test('replay code does not activate skills and the migration is idempotent', () => {
  const replay = readFileSync(new URL('../src/lib/ai/shadowEval.ts', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../src/app/api/shop/shadow-eval/route.ts', import.meta.url), 'utf8')
  const sql = readFileSync(new URL('../supabase/migrations/20261110000000_skill_shadow_replay.sql', import.meta.url), 'utf8')
  assert.equal(/from\('shop_skills'\)[^;]{0,400}\.update\(/.test(replay), false)
  assert.match(route, /requireShop/)
  assert.match(route, /eq\('shop_id', auth\.shopId\)/)
  assert.doesNotMatch(route, /status:\s*'active'/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS status/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE/)
  const ui = readFileSync(new URL('../src/app/dashboard/skills/SkillManager.tsx', import.meta.url), 'utf8')
  assert.match(ui, /ทดสอบกับแชทจริง/)
  assert.match(ui, /ระบบจะไม่เปิดใช้สกิลให้อัตโนมัติ/)
  assert.match(ui, /ตอบโดยมีหลักฐานจากร้าน/)
  assert.match(ui, /ส่งต่อแอดมิน/)
  assert.match(sql, /Skill shadow replay schema applied successfully/)
  assert.ok(sql.includes('20261109') === false)
})
