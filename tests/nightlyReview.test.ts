import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  adminFactText,
  buildProposalDrafts,
  buildReviewPrompt,
  claimDecision,
  clusterIsRecurring,
  cronAuthResult,
  decisionEffect,
  fillInInstruction,
  isBroadcastAdminMessage,
  NIGHTLY_REVIEW_LIMITS,
  selectReviewClusters,
  shopEligible,
  shouldChain,
  toAdminReplySignal,
  toFeedbackSignal,
  toGapSignal,
  type ReviewSignal,
  type SkillBrief,
} from '../src/lib/ai/nightlyReviewPlan.ts'
import { generateReviewJson, resolveShopGemini, reviewOneShop, type NightlyReviewPort } from '../src/lib/ai/nightlyReviewRun.ts'

const SHOP = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function signal(partial: Partial<ReviewSignal> & Pick<ReviewSignal, 'id' | 'type' | 'topic'>): ReviewSignal {
  return {
    shopId: SHOP,
    conversationId: 'conv-1',
    chatMessageId: null,
    at: '2026-10-30T18:00:00.000Z',
    adminText: null,
    askCount: 1,
    reason: null,
    overrodeSuggestion: false,
    ...partial,
  }
}

function port(overrides: Partial<NightlyReviewPort> = {}): NightlyReviewPort & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    loadSignals: async () => [],
    loadSkills: async () => [],
    loadBlocks: async () => ({ rejections: [], pendingFingerprints: [] }),
    resolveGemini: async () => ({ apiKey: 'shop-key', model: 'gemini-2.5-flash' }),
    complete: async () => {
      calls.push('model')
      return JSON.stringify({ proposals: [] })
    },
    insertProposal: async () => {
      calls.push('insert')
    },
    markProcessed: async () => {
      calls.push('mark')
    },
    ...overrides,
  }
}

test('a shop with no signals never calls the model', async () => {
  const review = port()
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.status, 'skipped')
  assert.equal(result.reason, 'no_signals')
  assert.equal(result.modelCalled, false)
  assert.equal(review.calls.includes('model'), false)
  assert.equal(review.calls.includes('insert'), false)
})

test('a single unanswered gap is kept for a later night', async () => {
  const review = port({
    loadSignals: async () => [signal({ id: 'g1', type: 'gap', topic: 'รับประกันกี่ปี', askCount: 1 })],
  })
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.reason, 'no_recurring')
  assert.equal(result.modelCalled, false)
  assert.equal(review.calls.includes('mark'), false)
  assert.equal(clusterIsRecurring([signal({ id: 'g1', type: 'gap', topic: 'รับประกันกี่ปี', askCount: 2 })]), true)
})

test('similar questions cluster and a different topic stays apart', () => {
  const selected = selectReviewClusters([
    signal({ id: 'g1', type: 'gap', topic: 'ส่งของกี่วันคะ', askCount: 1 }),
    signal({ id: 'g2', type: 'gap', topic: 'ส่งของใช้เวลากี่วัน', askCount: 1, at: '2026-10-30T19:00:00.000Z' }),
    signal({ id: 'g3', type: 'gap', topic: 'รับประกันกี่ปี', askCount: 2 }),
  ], [], [])
  assert.equal(selected.promptClusters.length, 2)
  const shipping = selected.promptClusters.find((cluster) => cluster.signals.some((item) => item.id === 'g1'))
  assert.ok(shipping)
  assert.deepEqual(shipping.signals.map((item) => item.id).sort(), ['g1', 'g2'])
  assert.equal(shipping.signals.some((item) => item.id === 'g3'), false)
})

test('another shop is ignored and bot text never becomes a fact', async () => {
  const botAnswer = 'บอทเดาราคา 9999 บาทเอง'
  const feedback = toFeedbackSignal(
    {
      id: 'f1',
      shop_id: SHOP,
      rating: 'down',
      conversation_id: 'conv-1',
      chat_message_id: 'bot-msg',
      corrected_response: null,
      created_at: '2026-10-30T18:00:00.000Z',
    },
    SHOP,
    { shop_id: SHOP, sender_type: 'bot', message: botAnswer, conversation_id: 'conv-1', created_at: '2026-10-30T18:00:00.000Z' },
    'ส่งของกี่วัน',
  )
  assert.ok(feedback)
  assert.equal(feedback.topic, 'ส่งของกี่วัน')
  assert.equal(JSON.stringify(feedback).includes('9999'), false)
  assert.equal(JSON.stringify(feedback).includes(botAnswer), false)
  assert.equal(toGapSignal({ id: 'g', shop_id: OTHER, status: 'open', question: 'ราคาเท่าไหร่' }, SHOP), null)

  const review = port({
    loadSignals: async () => [
      signal({ id: 'other', type: 'gap', shopId: OTHER, topic: 'ความลับของอีกร้าน 0812345678', askCount: 3 }),
    ],
  })
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.reason, 'no_signals')
  assert.equal(review.calls.includes('model'), false)
})

test('admin corrections keep merchant text and drop the bot suggestion', () => {
  assert.equal(isBroadcastAdminMessage({ sender_name: 'แอดมิน (Broadcast)', metadata: { broadcast_title: 'โปร' } }), true)
  assert.equal(toAdminReplySignal({
    id: 'b1',
    shop_id: SHOP,
    sender_type: 'agent',
    sender_name: 'แอดมิน (Broadcast)',
    message: 'โปรโมชั่นทั้งร้าน',
    created_at: '2026-10-30T18:00:00.000Z',
    metadata: { broadcast_title: 'โปร' },
  }, SHOP, { text: 'มีโปรไหม' }), null)

  const reply = toAdminReplySignal({
    id: 'a1',
    shop_id: SHOP,
    conversation_id: 'conv-9',
    sender_type: 'agent',
    sender_name: 'แอดมิน',
    message: 'ส่งฟรีเมื่อซื้อครบ 500 บาท โทร 0812345678',
    created_at: '2026-10-30T18:05:00.000Z',
  }, SHOP, { text: 'ส่งฟรีไหม โทร 0899999999', suggestion: 'บอทเดาว่าส่งฟรีทุกออเดอร์ 8888 บาท' })
  assert.ok(reply)
  assert.equal(reply.overrodeSuggestion, true)
  assert.equal(reply.adminText?.includes('0812345678'), false)
  assert.equal(reply.topic.includes('0899999999'), false)
  assert.match(reply.adminText || '', /500/)
  assert.equal(JSON.stringify(reply).includes('8888'), false)
  assert.equal(JSON.stringify(reply).includes('บอทเดา'), false)
  assert.equal(toAdminReplySignal({
    id: 'a2',
    shop_id: SHOP,
    sender_type: 'agent',
    sender_name: 'แอดมิน',
    message: 'สวัสดีค่ะ',
    created_at: '2026-10-30T18:05:00.000Z',
  }, SHOP, null), null)
})

test('a proposal copies admin text and asks the merchant when nobody answered', () => {
  const taught = signal({
    id: 'a1',
    type: 'admin_reply',
    topic: 'ส่งฟรีไหม',
    adminText: 'ส่งฟรีเมื่อซื้อครบ 500 บาท',
    askCount: 1,
  })
  const open = signal({
    id: 'g1',
    type: 'gap',
    topic: 'รับประกันกี่ปี',
    askCount: 2,
  })
  const selected = selectReviewClusters([taught, open], [], [])
  const taughtCluster = selected.promptClusters.find((cluster) => cluster.signals.some((item) => item.id === 'a1'))
  const openCluster = selected.promptClusters.find((cluster) => cluster.signals.some((item) => item.id === 'g1'))
  assert.ok(taughtCluster && openCluster)
  assert.notEqual(taughtCluster.id, openCluster.id)
  const own: SkillBrief = {
    id: 'skill-own',
    shopId: SHOP,
    status: 'active',
    skill_type: 'knowledge',
    category: 'ส่งฟรี',
    trigger_keywords: ['ส่งฟรี'],
    knowledge_body: 'ของเดิม',
    facts_confirmed: true,
  }
  const foreign: SkillBrief = { ...own, id: 'skill-other', shopId: OTHER, trigger_keywords: ['รับประกัน'] }
  const drafts = buildProposalDrafts({
    shopId: SHOP,
    clusters: [taughtCluster, openCluster],
    skills: [own, foreign],
    rejections: [],
    pendingFingerprints: [],
    modelProposals: [
      { cluster_id: taughtCluster.id, skill_type: 'knowledge', category: 'shipping', trigger_keywords: ['ส่งฟรี'], instruction: 'รับประกัน 9 ปี', knowledge_body: 'แต่งเอง 7777 บาท' },
      { cluster_id: openCluster.id, skill_type: 'knowledge', category: 'warranty', trigger_keywords: ['รับประกัน'], instruction: 'รับประกัน 9 ปี', knowledge_body: 'รับประกัน 9 ปี' },
      { cluster_id: 'nope', skill_type: 'rule', category: 'x', trigger_keywords: ['x'] },
    ],
  })
  assert.equal(drafts.length, 2)
  const withFact = drafts.find((draft) => draft.knowledgeBody)
  const withoutFact = drafts.find((draft) => draft.needsMerchantFact)
  assert.ok(withFact && withoutFact)
  assert.equal(withFact.knowledgeBody, 'ส่งฟรีเมื่อซื้อครบ 500 บาท')
  assert.equal(withFact.knowledgeBody?.includes('7777'), false)
  assert.equal(withFact.knowledgeBody?.includes('9'), false)
  assert.equal(withFact.instruction.includes('9'), false)
  assert.equal(withFact.status, 'candidate')
  assert.equal(withFact.factsConfirmed, false)
  assert.equal(withFact.revisesSkillId, 'skill-own')
  assert.equal(withoutFact.knowledgeBody, null)
  assert.match(withoutFact.instruction, /กรุณาเติมข้อเท็จจริง/)
  assert.equal(withoutFact.instruction.includes('9'), false)
  assert.equal(withoutFact.revisesSkillId, null)
  assert.equal(withoutFact.factsConfirmed, false)
  assert.equal(adminFactText([open]), null)
})

test('phones are redacted before the prompt and rejected clusters are not proposed again', async () => {
  const gaps = [
    signal({ id: 'g1', type: 'gap', topic: 'ส่งของกี่วัน โทร 0812345678', askCount: 2 }),
    signal({ id: 'g2', type: 'gap', topic: 'ส่งของกี่วันอีกครั้ง', askCount: 1, at: '2026-10-30T19:00:00.000Z' }),
  ]
  const selected = selectReviewClusters(gaps, [], [])
  const prompt = buildReviewPrompt(SHOP, selected.promptClusters, [])
  assert.equal(prompt.includes('0812345678'), false)
  assert.match(prompt, /\[เบอร์โทร\]/)
  assert.equal(prompt.includes('บอท'), false)

  const fingerprint = selected.promptClusters[0].fingerprint
  let inserted = 0
  const review = port({
    loadSignals: async () => gaps,
    loadBlocks: async () => ({ rejections: [{ fingerprint, topicKeys: selected.promptClusters[0].topicKeys }], pendingFingerprints: [] }),
    complete: async () => {
      inserted += 1
      return '{"proposals":[]}'
    },
    insertProposal: async () => {
      inserted += 1
    },
  })
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.modelCalled, false)
  assert.equal(result.reason, 'already_decided')
  assert.equal(inserted, 0)
  assert.equal(review.calls.includes('mark'), true)
})

test('caps proposals and skips the model when no Gemini key is available', async () => {
  const clusters = selectReviewClusters([
    signal({ id: 'g1', type: 'gap', topic: 'ส่งของกี่วัน', askCount: 2 }),
    signal({ id: 'g2', type: 'gap', topic: 'รับประกันกี่ปี', askCount: 2 }),
    signal({ id: 'g3', type: 'gap', topic: 'เปิดร้านกี่โมง', askCount: 2 }),
    signal({ id: 'g4', type: 'gap', topic: 'รับบัตรเครดิตไหม', askCount: 2 }),
    signal({ id: 'g5', type: 'gap', topic: 'มีบริการติดตั้งไหม', askCount: 2 }),
  ], [], []).promptClusters
  assert.ok(clusters.length >= NIGHTLY_REVIEW_LIMITS.maxProposals)
  const many = clusters.map((cluster) => ({
    cluster_id: cluster.id,
    skill_type: 'knowledge',
    category: cluster.id,
    trigger_keywords: [cluster.id],
    instruction: 'ตอบตามข้อมูล',
  }))
  const drafts = buildProposalDrafts({
    shopId: SHOP,
    clusters,
    skills: [],
    modelProposals: many,
    rejections: [],
    pendingFingerprints: [],
  })
  assert.equal(drafts.length, NIGHTLY_REVIEW_LIMITS.maxProposals)
  assert.equal(new Set(drafts.map((draft) => draft.clusterId)).size, NIGHTLY_REVIEW_LIMITS.maxProposals)

  const review = port({
    loadSignals: async () => [signal({ id: 'g1', type: 'gap', topic: 'ส่งของกี่วัน', askCount: 2 })],
    resolveGemini: async () => null,
  })
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.reason, 'no_gemini_key')
  assert.equal(result.modelCalled, false)
  assert.equal(review.calls.includes('mark'), false)
})

test('a bad model response does not mark signals or insert a draft', async () => {
  const review = port({
    loadSignals: async () => [signal({ id: 'g1', type: 'gap', topic: 'ส่งของกี่วัน', askCount: 2 })],
    complete: async () => 'not json',
  })
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.status, 'failed')
  assert.equal(result.reason, 'model_output')
  assert.equal(review.calls.includes('insert'), false)
  assert.equal(review.calls.includes('mark'), false)
})

test('an empty model list still closes the signals it was shown', async () => {
  const seen: string[] = []
  const review = port({
    loadSignals: async () => [signal({ id: 'g1', type: 'gap', topic: 'ส่งของกี่วัน', askCount: 2 })],
    complete: async (prompt) => {
      assert.equal(prompt.includes('0812345678'), false)
      return '{"proposals":[]}'
    },
    markProcessed: async (_shopId, signals) => {
      seen.push(...signals.map((item) => item.id))
    },
  })
  const result = await reviewOneShop(SHOP, review)
  assert.equal(result.status, 'completed')
  assert.equal(result.proposalsCreated, 0)
  assert.deepEqual(seen, ['g1'])
})

test('BYOK does not fall back to the platform key', async () => {
  let platformKeyReads = 0
  const byok = await resolveShopGemini(
    { id: SHOP, plan_key: 'byok', custom_ai_model: 'gemini-2.5-flash' },
    {
      platformSecret: async (name) => {
        if (name === 'GEMINI_API_KEY') platformKeyReads += 1
        return 'platform-key'
      },
      getShopAiKey: async () => ({ provider: 'openai', key: 'sk-own' }),
    },
  )
  assert.equal(byok, null)
  assert.equal(platformKeyReads, 0)

  const own = await resolveShopGemini(
    { id: SHOP, plan_key: 'byok' },
    {
      platformSecret: async () => {
        throw new Error('platform key must not be read')
      },
      getShopAiKey: async (shopId) => {
        assert.equal(shopId, SHOP)
        return { provider: 'gemini', key: 'shop-gemini' }
      },
    },
  )
  assert.equal(own?.apiKey, 'shop-gemini')

  let shopKeyReads = 0
  const platform = await resolveShopGemini(
    { id: SHOP, plan_key: 'pro', ai_model: 'gemini-2.5-flash' },
    {
      platformSecret: async (name) => name === 'GEMINI_API_KEY' ? 'platform-key' : null,
      getShopAiKey: async () => {
        shopKeyReads += 1
        return { provider: 'gemini', key: 'should-not-use' }
      },
    },
  )
  assert.equal(platform?.apiKey, 'platform-key')
  assert.equal(shopKeyReads, 0)
})

test('the model request does not put the key in the URL', async () => {
  let url = ''
  let header = ''
  const raw = await generateReviewJson(
    { apiKey: 'secret-key', model: 'gemini-2.5-flash' },
    'ตรวจ',
    async (input, init) => {
      url = String(input)
      header = (init?.headers as Record<string, string>)['x-goog-api-key']
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"proposals":[]}' }] } }] }), { status: 200 })
    },
  )
  assert.equal(raw.includes('proposals'), true)
  assert.equal(url.includes('secret-key'), false)
  assert.equal(header, 'secret-key')
})

test('scheduling, eligibility, and merchant decisions stay non-activating', () => {
  const now = Date.parse('2026-10-31T18:00:00.000Z')
  assert.equal(claimDecision(null, now), 'insert')
  assert.equal(claimDecision({ status: 'completed', startedAt: '2026-10-31T17:00:00.000Z' }, now), 'skip')
  assert.equal(claimDecision({ status: 'running', startedAt: '2026-10-31T17:59:00.000Z' }, now), 'skip')
  assert.equal(claimDecision({ status: 'failed', startedAt: '2026-10-31T17:00:00.000Z' }, now), 'takeover')
  assert.equal(shopEligible({ id: SHOP, status: 'active' }), true)
  assert.equal(shopEligible({ id: SHOP, status: 'suspended' }), false)
  assert.equal(shopEligible({ id: SHOP, features: { is_demo: true } }), false)
  assert.equal(cronAuthResult(null, undefined), 503)
  assert.equal(cronAuthResult('Bearer wrong', 'secret'), 401)
  assert.equal(cronAuthResult('Bearer secret\n', ' secret '), 200)
  assert.equal(shouldChain(true, 0), true)
  assert.equal(shouldChain(false, 0), false)
  assert.equal(shouldChain(true, NIGHTLY_REVIEW_LIMITS.maxChain), false)
  const accepted = decisionEffect('accept')
  const rejected = decisionEffect('reject')
  assert.equal(accepted.activatesSkill, false)
  assert.equal(accepted.confirmsFacts, false)
  assert.equal(accepted.archiveCandidate, false)
  assert.equal(rejected.activatesSkill, false)
  assert.equal(rejected.confirmsFacts, false)
  assert.equal(rejected.recordRejection, true)
  assert.equal(rejected.archiveCandidate, true)
  assert.equal(fillInInstruction('ส่งของกี่วัน').includes('กรุณาเติม'), true)
  assert.equal(/\d/.test(fillInInstruction('ส่งของกี่วัน')), false)
})

test('migration and persistence keep drafts unconfirmed', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261111000000_nightly_skill_review.sql', import.meta.url), 'utf8')
  const store = readFileSync(new URL('../src/lib/ai/nightlyReviewStore.ts', import.meta.url), 'utf8')
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
  assert.match(sql, /UNIQUE \(shop_id, review_date\)/)
  assert.match(sql, /UNIQUE \(shop_id, signal_type, signal_id\)/)
  assert.match(sql, /shop_skill_review_rejections/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.shop_skill_review_proposals FROM anon, authenticated, public/)
  assert.match(sql, /GRANT SELECT ON TABLE public\.shop_skill_review_proposals TO authenticated/)
  assert.match(sql, /Nightly skill review schema applied successfully/)
  assert.match(store, /facts_confirmed: false/)
  assert.match(store, /status: 'candidate'/)
  assert.doesNotMatch(store, /status: 'active'/)
  assert.doesNotMatch(store, /facts_confirmed: true/)
  assert.match(store, /queueSkillShadow\(/)
  assert.match(vercel, /\/api\/cron\/skill-review/)
  assert.match(vercel, /0 18 \* \* \*/)
})
