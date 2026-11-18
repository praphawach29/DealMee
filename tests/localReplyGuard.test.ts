import assert from 'node:assert/strict'
import { test } from 'node:test'
import { guardLocalReply } from '../src/lib/ai/localReplyGuard.ts'
import { EVAL_CASES } from './eval/fixtures/cases.ts'
import { shopById } from './eval/fixtures/shops.ts'
import { buildReport, reportMarkdown } from './eval/report.ts'
import { runEvalTurn } from './eval/runTurn.ts'

const snapshot = { shopId: 'shop-A', products: [{ id: 'shirt', name: 'เสื้อยืด', price: 317.5, stock: 2 }] }
const base = { language: 'th' as const, shopId: 'shop-A', catalogRequired: true, snapshot }
const evalCase = EVAL_CASES.find((item) => item.id === 'product-01')!

test('catalog replies contain only validated facts, never invented promises or foreign script', () => {
  for (const draft of ['ราคา 99999 บาท รับประกัน 9 ปี ส่งฟรี', '你好 เสื้อยืด 317.5 บาท', '']) {
    const verdict = guardLocalReply({ ...base, draft })
    assert.equal(verdict.draftAccepted, false)
    assert.equal(verdict.source, 'catalog_template')
    assert.match(verdict.text, /317.5 บาท/)
    assert.match(verdict.text, /คงเหลือ 2 ชิ้น/)
    assert.doesNotMatch(verdict.text, /99999|รับประกัน|ส่งฟรี|你好/)
  }
})

test('only an exact verified template is accepted as a model draft', () => {
  const template = guardLocalReply({ ...base, draft: 'test' }).text
  const accepted = guardLocalReply({ ...base, draft: template })
  assert.equal(accepted.draftAccepted, true)
  assert.equal(accepted.reason, 'accepted_catalog_template')
  const truncated = guardLocalReply({ ...base, draft: template, truncated: true })
  assert.equal(truncated.draftAccepted, false)
  assert.equal(truncated.reason, 'truncated_draft')
  assert.equal(truncated.text, template)
})

test('absent, malformed and cross-shop evidence fail closed without echoing draft or evidence', () => {
  for (const evidence of [undefined, null, { ...snapshot, shopId: 'shop-B' }, { ...snapshot, products: [{ ...snapshot.products[0], price: -1 }] }, { ...snapshot, products: [{ ...snapshot.products[0], name: 'private\ntext' }] }]) {
    const verdict = guardLocalReply({ ...base, snapshot: evidence, draft: 'private draft 99999 บาท' })
    assert.equal(verdict.source, 'safe_notice')
    assert.equal(verdict.draftAccepted, false)
    assert.doesNotMatch(verdict.text, /private|99999|317/)
  }
})

test('empty catalog never falls back to another item and zero stock is explicit', () => {
  const missing = guardLocalReply({ ...base, snapshot: { shopId: 'shop-A', products: [] }, draft: 'เสื้อยืด 290 บาท' })
  assert.match(missing.text, /ยังไม่พบสินค้า/)
  assert.doesNotMatch(missing.text, /290|เสื้อยืด/)
  const empty = guardLocalReply({ ...base, snapshot: { ...snapshot, products: [{ ...snapshot.products[0], stock: 0 }] }, draft: 'มีสินค้า' })
  assert.match(empty.text, /หมดสต๊อก/)
})

test('English output preserves product names and language-only checks do not certify facts', () => {
  const english = guardLocalReply({ ...base, language: 'en', draft: '你好' })
  assert.match(english.text, /เสื้อยืด: THB 317.5 — 2 in stock/)
  for (const draft of ['', '你好', 'สวัสดีค่ะ']) {
    const verdict = guardLocalReply({ ...base, catalogRequired: false, language: 'en', draft })
    assert.equal(verdict.source, 'safe_notice')
  }
  const languageOnly = guardLocalReply({ ...base, catalogRequired: false, draft: 'รับประกัน 9 ปี' })
  assert.equal(languageOnly.scope, 'language_only')
  assert.equal(languageOnly.draftAccepted, true)
})

test('guard runs before grounding, retains original draft, and uses current-turn catalog', async () => {
  const shop = structuredClone(shopById('fashion'))
  shop.products[0].price = 317
  const draft = '你好 ราคา 99999 บาท รับประกัน 9 ปี ส่งฟรีค่ะ'
  const result = await runEvalTurn({ shop, evalCase, toolProfile: 'read_only', catalogPrefetch: true, localReplyGuard: true, modelCaller: async () => ({ text: draft, truncated: true }) })
  assert.deepEqual(result.drafts, [draft])
  assert.equal(result.replyGuard?.reason, 'truncated_draft')
  assert.equal(result.replyGuard?.source, 'catalog_template')
  assert.match(result.text, /317 บาท/)
  assert.doesNotMatch(result.text, /你好|99999|รับประกัน|ส่งฟรี/)
  assert.deepEqual(result.modelToolCalls, [])
  assert.deepEqual(result.toolCalls.map((call) => call.name), ['search_products', 'check_stock'])
})

test('unknown products, greetings and Q&A shops preserve their separate guard scopes', async () => {
  const unknown = await runEvalTurn({ shop: shopById('fashion'), evalCase: { ...evalCase, turns: [{ role: 'user', text: 'มีรองเท้าไหมคะ' }] }, toolProfile: 'read_only', catalogPrefetch: true, localReplyGuard: true, modelCaller: async () => ({ text: 'เสื้อยืด ราคา 290 บาท' }) })
  assert.match(unknown.text, /ยังไม่พบสินค้า/)
  assert.equal(unknown.replyGuard?.scope, 'catalog')
  for (const shopId of ['fashion', 'qa'] as const) {
    const greeting = await runEvalTurn({ shop: shopById(shopId), evalCase: { ...evalCase, turns: [{ role: 'user', text: 'สวัสดีค่ะ' }] }, toolProfile: 'read_only', catalogPrefetch: true, localReplyGuard: true, modelCaller: async () => ({ text: 'สวัสดีค่ะ' }) })
    assert.equal(greeting.replyGuard?.scope, 'language_only')
    assert.deepEqual(greeting.prefetchCalls, [])
  }
})

test('a later model catalog read replaces the prior snapshot rather than reusing stale products', async () => {
  let calls = 0
  const result = await runEvalTurn({ shop: shopById('fashion'), evalCase, toolProfile: 'read_only', catalogPrefetch: true, localReplyGuard: true, modelCaller: async () => {
    calls += 1
    return calls === 1
      ? { text: '', toolCall: { name: 'check_stock', args: { product_name: 'unknown-product' }, id: 'new-stock' } }
      : { text: 'เสื้อยืด ราคา 290 บาท' }
  } })
  assert.equal(calls, 2)
  assert.match(result.replyGuard!.text, /ยังไม่พบสินค้า/)
  assert.doesNotMatch(result.replyGuard!.text, /290/)
})

test('guard is opt-in and rejects incompatible evaluation profiles before calling the model', async () => {
  const unguarded = await runEvalTurn({ shop: shopById('fashion'), evalCase, toolProfile: 'read_only', catalogPrefetch: true, modelCaller: async () => ({ text: 'สวัสดีค่ะ' }) })
  assert.equal(unguarded.replyGuard, undefined)
  for (const config of [{}, { toolProfile: 'read_only' as const }, { toolProfile: 'full' as const, catalogPrefetch: true }]) {
    await assert.rejects(runEvalTurn({ shop: shopById('fashion'), evalCase, ...config, localReplyGuard: true, modelCaller: async () => { throw new Error('must not run') } }), /requires catalog prefetch/)
  }
})

test('reports disclose replacements without hiding original model failures', () => {
  const report = buildReport({ provider: 'ollama', model: 'test', judge: false, cases: [{ id: evalCase.id, category: evalCase.category, shopId: 'fashion', pass: false, reasons: ['model draft is not grounded'], latencyMs: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, toolCalls: [], transcript: [], replyGuard: guardLocalReply({ ...base, draft: '99999 บาท' }) }] })
  assert.equal(report.summary.passed, 0)
  assert.match(reportMarkdown(report), /replaced 1 model drafts/)
  assert.match(reportMarkdown(report), /Original model drafts are still scored/)
})
