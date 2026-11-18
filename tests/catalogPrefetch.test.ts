import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prefetchCatalog } from '../src/lib/ai/catalogPrefetch.ts'
import { runEvalTurn } from './eval/runTurn.ts'
import { EVAL_CASES } from './eval/fixtures/cases.ts'
import { shopById } from './eval/fixtures/shops.ts'
import { buildShopContext } from './eval/shopPrompt.ts'
import { buildReport, reportMarkdown } from './eval/report.ts'
import { createFixtureExecutor } from './eval/fixtureExecutor.ts'

const allowedTools = ['search_products', 'check_stock', 'take_order', 'request_human_agent']
const evalCase = EVAL_CASES.find((item) => item.id === 'product-01')!

test('catalog prefetch runs only permitted read tools in order and scopes them to the trusted shop', async () => {
  const executed: string[] = []
  const calls = await prefetchCatalog({ shopId: 'shop-A', query: 'มีเสื้อยืดไหมคะ', allowedTools, execute: async (name, args, scope) => {
    assert.deepEqual(scope, { shopId: 'shop-A' })
    assert.equal('shop_id' in args, false)
    if (name === 'check_stock') assert.deepEqual(executed, ['search_products'])
    executed.push(name)
    return { resultForAi: 'เสื้อยืด ราคา 290 บาท เหลือ 12 ชิ้น' }
  } })
  assert.deepEqual(executed, ['search_products', 'check_stock'])
  // trailing question/politeness particles and leading question prefixes are stripped so the keyword matches the product name
  assert.equal(calls[0].args.keyword, 'เสื้อยืดไหม')
  assert.equal(calls[1].args.product_name, 'เสื้อยืดไหม')
})

test('greetings, empty questions and shops without catalog permissions perform no reads', async () => {
  for (const query of ['', 'สวัสดีครับ', 'hello']) {
    assert.deepEqual(await prefetchCatalog({ shopId: 'shop-A', query, allowedTools, execute: async () => { throw new Error('must not execute') } }), [])
  }
  assert.deepEqual(await prefetchCatalog({ shopId: 'shop-A', query: 'มีเสื้อไหม', allowedTools: ['search_knowledge_base'], execute: async () => { throw new Error('must not execute') } }), [])
})

test('broad catalog requests list products, but unknown names are never replaced with an empty search', async () => {
  for (const query of ['มีสินค้าอะไรบ้างคะ', 'รายการสินค้าทั้งหมด', 'products']) {
    const calls = await prefetchCatalog({ shopId: 'shop-A', query, allowedTools, execute: async () => ({ resultForAi: 'รายการสินค้า' }) })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].args.keyword, '')
  }
  const query = 'มีรองเท้าไหมคะ'
  const calls = await prefetchCatalog({ shopId: 'shop-A', query, allowedTools, execute: async () => ({ resultForAi: 'ไม่พบสินค้า' }) })
  assert.equal(calls[0].args.keyword, 'รองเท้าไหม')
})

test('prefetch does not cache results or mix shops when requests overlap', async () => {
  const reads: Record<string, number> = {}
  const retrieve = (shopId: string) => prefetchCatalog({ shopId, query: 'เสื้อยืด', allowedTools: ['search_products'], execute: async (_name, _args, scope) => {
    reads[scope.shopId] = (reads[scope.shopId] || 0) + 1
    return { resultForAi: `${scope.shopId} stock=${reads[scope.shopId]}` }
  } })
  const [first, other] = await Promise.all([retrieve('shop-A'), retrieve('shop-B')])
  const refreshed = await retrieve('shop-A')
  assert.equal(first[0].result, 'shop-A stock=1')
  assert.equal(other[0].result, 'shop-B stock=1')
  assert.equal(refreshed[0].result, 'shop-A stock=2')
})

test('missing identities, oversized questions, failed reads and invalid responses fail closed', async () => {
  const base = { shopId: 'shop-A', query: 'เสื้อยืด', allowedTools }
  for (const resultForAi of ['', ' '.repeat(3), 'x'.repeat(12001), null]) {
    await assert.rejects(prefetchCatalog({ ...base, execute: async () => ({ resultForAi: resultForAi as string }) }), /Catalog prefetch failed/)
  }
  await assert.rejects(prefetchCatalog({ ...base, shopId: '', execute: async () => ({ resultForAi: 'ok' }) }), /shop identity/)
  await assert.rejects(prefetchCatalog({ ...base, query: 'x'.repeat(2001), execute: async () => ({ resultForAi: 'ok' }) }), /limit/)
  const executed: string[] = []
  await assert.rejects(prefetchCatalog({ ...base, execute: async (name) => {
    executed.push(name)
    if (name === 'check_stock') throw new Error('private database secret')
    return { resultForAi: 'ราคาเดิม 290 บาท' }
  } }), (error: Error) => error.message.includes('check_stock') && !error.message.includes('private'))
  assert.deepEqual(executed, ['search_products', 'check_stock'])
})

test('shop prompt and grounding omit static catalog only when requested', () => {
  const shop = shopById('fashion')
  assert.match(buildShopContext(shop, evalCase.turns).prompt, /290/)
  const context = buildShopContext(shop, evalCase.turns, { omitCatalog: true })
  assert.doesNotMatch(context.prompt, /290/)
  assert.ok(context.groundingTexts.every((text) => !text.includes('290')))
})

test('fresh catalog evidence reaches the model before its first call and is reported as system work', async () => {
  const shop = structuredClone(shopById('fashion'))
  shop.products[0].price = 317
  shop.products[0].stock = 2
  let modelCalls = 0
  const result = await runEvalTurn({ shop, evalCase, toolProfile: 'read_only', catalogPrefetch: true, modelCaller: async (step) => {
    modelCalls++
    assert.doesNotMatch(step.systemInstruction, /317|290/)
    const evidence = step.turns.filter((turn) => turn.role === 'tool_result')
    assert.equal(evidence.length, 2)
    assert.ok(evidence.every((turn) => turn.role === 'tool_result' && turn.result.includes('317')))
    return { text: 'เสื้อยืดโอเวอร์ไซส์ ราคา 317 บาท เหลือ 2 ชิ้นค่ะ [[cite:tool:check_stock]]' }
  } })
  assert.equal(modelCalls, 1)
  assert.deepEqual(result.prefetchCalls.map((call) => call.name), ['search_products', 'check_stock'])
  assert.deepEqual(result.modelToolCalls, [])
  assert.ok(result.evidenceTexts.some((text) => text.includes('317')))
  assert.doesNotMatch(result.evidenceTexts.join('\n'), /290/)
})

test('unknown products do not fall back to the first item or match the Thai question particle ไหม', async () => {
  const result = await runEvalTurn({ shop: shopById('fashion'), evalCase: { ...evalCase, turns: [{ role: 'user', text: 'มีรองเท้าไหมคะ' }] }, toolProfile: 'read_only', catalogPrefetch: true, modelCaller: async (step) => {
    const results = step.turns.filter((turn) => turn.role === 'tool_result')
    assert.ok(results.every((turn) => turn.role === 'tool_result' && turn.result.includes('ไม่พบสินค้า')))
    return { text: 'ยังไม่พบรองเท้าในรายการที่ค้นค่ะ ขอชื่อรุ่นเพิ่มเติมได้ไหมคะ' }
  } })
  assert.equal(result.prefetchCalls.length, 2)
  assert.ok(result.prefetchCalls.every((call) => !call.result.includes('290')))
})

test('Q&A-only shops cannot prefetch a product catalog, even when asked', async () => {
  const result = await runEvalTurn({ shop: shopById('qa'), evalCase, toolProfile: 'read_only', catalogPrefetch: true, modelCaller: async (step) => {
    assert.ok(step.turns.every((turn) => turn.role !== 'tool_result'))
    return { text: 'หน่วยงานนี้ให้ข้อมูลบริการค่ะ' }
  } })
  assert.deepEqual(result.prefetchCalls, [])
})

test('prefetch errors prevent model execution and full-profile behavior remains opt-in', async () => {
  let modelCalled = false
  const modelCaller = async () => { modelCalled = true; return { text: 'must not run' } }
  await assert.rejects(runEvalTurn({ shop: shopById('fashion'), evalCase, catalogPrefetch: true, modelCaller }), /read_only/)
  await assert.rejects(runEvalTurn({ shop: shopById('fashion'), evalCase: { ...evalCase, turns: [{ role: 'user', text: 'x'.repeat(2001) }] }, toolProfile: 'read_only', catalogPrefetch: true, modelCaller }), /limit/)
  assert.equal(modelCalled, false)
})

test('fixture executor cannot return another shop catalog on the same query', async () => {
  const fashion = createFixtureExecutor(shopById('fashion'), [])
  const beauty = createFixtureExecutor(shopById('beauty'), [])
  assert.match((await fashion('search_products', { keyword: 'เสื้อยืด' })).resultForAi, /290/)
  assert.match((await beauty('search_products', { keyword: 'เสื้อยืด' })).resultForAi, /ไม่พบสินค้า/)
})

test('reports disclose system prefetch independently of model tool calling', () => {
  const report = buildReport({ provider: 'ollama', model: 'test', judge: false, toolProfile: 'read_only', catalogPrefetch: true, cases: [] })
  assert.equal(report.catalogPrefetch, true)
  assert.match(reportMarkdown(report), /System catalog prefetch: on/)
  assert.match(reportMarkdown(report), /not model-initiated tool calls/)
})
