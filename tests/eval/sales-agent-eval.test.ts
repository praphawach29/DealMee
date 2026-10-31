import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkGrounding, GROUNDING_HANDOFF } from '../../src/lib/ai/grounding.ts'
import { greetingOnlyReply } from '../../src/lib/ai/handoffGuard.ts'
import { toolsOfferedForShop, type ModelCaller } from '../../src/lib/ai/salesAgentEngine.ts'
import { executeTool } from '../../src/lib/ai/toolDispatcher.ts'
import { EVAL_CASES, EVAL_CATEGORIES, scriptedToolNames } from './fixtures/cases.ts'
import { shopById } from './fixtures/shops.ts'
import { runEvalTurn, scriptedModelCaller } from './runTurn.ts'
import { buildReport, reportMarkdown } from './report.ts'
import { deniesCod, offersDisabledCod, scoreEval } from './score.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) files.push(full)
  }
  return files
}

test('Thai eval suite covers 50-100 conversations in every category', () => {
  assert.ok(EVAL_CASES.length >= 50 && EVAL_CASES.length <= 100, `case count ${EVAL_CASES.length}`)
  const ids = EVAL_CASES.map((item) => item.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const category of EVAL_CATEGORIES) {
    const count = EVAL_CASES.filter((item) => item.category === category).length
    assert.ok(count >= 4, `${category} has ${count} cases`)
  }
  for (const evalCase of EVAL_CASES) {
    assert.ok(evalCase.turns.at(-1)?.role === 'user', evalCase.id)
    shopById(evalCase.shopId)
  }
})

test('fixture shops are not referenced from product source', () => {
  const hits = walk(path.join(root, 'src')).filter((file) => readFileSync(file, 'utf8').includes('tests/eval'))
  assert.deepEqual(hits, [])
})

test('Q&A-only and free-plan shops lose commerce tools', () => {
  const qa = toolsOfferedForShop(shopById('qa').shop, { catalogEmpty: true })
  assert.deepEqual(qa.map((tool) => tool.name), ['request_human_agent'])
  const fashion = toolsOfferedForShop(shopById('fashion').shop, { catalogEmpty: false })
  assert.ok(fashion.some((tool) => tool.name === 'take_order'))
  assert.ok(fashion.some((tool) => tool.name === 'search_knowledge_base'))
  const free = toolsOfferedForShop(
    { ...shopById('fashion').shop, plan_key: 'free', plan: 'free' },
    { catalogEmpty: false },
  )
  assert.equal(free.some((tool) => tool.name === 'take_order'), false)
  assert.equal(free.some((tool) => tool.name === 'send_payment_qr'), false)
  assert.ok(free.some((tool) => tool.name === 'search_products'))
  assert.ok(free.some((tool) => tool.name === 'request_human_agent'))
})

test('scripted model runs every case through the real planning loop', async () => {
  const failures: string[] = []
  for (const evalCase of EVAL_CASES) {
    const shop = shopById(evalCase.shopId)
    try {
      const result = await runEvalTurn({
        shop,
        evalCase,
        modelCaller: scriptedModelCaller(shop, evalCase),
      })
      const called = result.toolCalls.map((call) => call.name)
      for (const name of scriptedToolNames(evalCase)) {
        if (!called.includes(name)) failures.push(`${evalCase.id} did not dispatch ${name} (got ${called.join(', ') || 'none'})`)
      }
      if (shop.qaOnly && !result.offeredTools.every((name) => name === 'request_human_agent')) {
        failures.push(`${evalCase.id} offered ${result.offeredTools.join(', ')}`)
      }
      if (shop.qaOnly && !called.every((name) => name === 'request_human_agent')) {
        failures.push(`${evalCase.id} ran ${called.join(', ')}`)
      }
      if (evalCase.offlineInvent) {
        if (result.text !== GROUNDING_HANDOFF.th) failures.push(`${evalCase.id} text was ${result.text}`)
        if (!called.includes('request_human_agent')) failures.push(`${evalCase.id} did not hand off`)
        if (result.gaps.length < 1) failures.push(`${evalCase.id} did not log a knowledge gap`)
      }
      if (evalCase.id === 'cod_off-02') {
        const order = result.toolLog.find((entry) => entry.name === 'take_order')
        if (!/ไม่ได้เปิดเก็บเงินปลายทาง/.test(order?.result || '')) failures.push('cod_off-02 did not refuse COD')
        if ((order?.result || '').includes('EVAL-100001')) failures.push('cod_off-02 created an order')
      }
      const scored = scoreEval({
        evalCase,
        shop,
        finalText: result.text,
        draft: result.drafts.at(-1) || '',
        toolCalls: result.toolCalls,
        evidenceTexts: result.evidenceTexts,
      })
      if (!scored.pass) failures.push(`${evalCase.id}: ${scored.reasons.join('; ')}`)
    } catch (err) {
      failures.push(`${evalCase.id} threw ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  assert.deepEqual(failures, [])
})

test('a greeting does not hand the chat to a human', async () => {
  const shop = shopById('fashion')
  const evalCase = EVAL_CASES.find((item) => item.id === 'greeting-01')
  assert.ok(evalCase)
  const caller: ModelCaller = async () => ({
    text: '',
    toolCall: { name: 'request_human_agent', args: { reason: 'ทักทาย' }, id: 'greet' },
  })
  for (const message of ['สวัสดีค่ะ', 'หวัดดีค้าบ', 'ฮัลโหล', 'ดีจ้า', 'สวัสดีครับผม', 'ดีค่า']) {
    const result = await runEvalTurn({
      shop,
      evalCase: { ...evalCase, turns: [{ role: 'user', text: message }] },
      modelCaller: caller,
    })
    assert.equal(result.text, greetingOnlyReply('th'), message)
    assert.deepEqual(result.toolCalls, [], message)
    assert.equal(result.gaps.length, 0, message)
  }
})

test('Q&A-only mode rejects a commerce tool before it runs', async () => {
  const shop = shopById('qa')
  const evalCase = EVAL_CASES.find((item) => item.id === 'qa_only-01')
  assert.ok(evalCase)
  await assert.rejects(
    () => runEvalTurn({
      shop,
      evalCase,
      modelCaller: async () => ({
        text: '',
        toolCall: { name: 'take_order', args: { payment_method: 'โอนเงิน' }, id: 'qa' },
      }),
    }),
    /Q&A-only mode/,
  )
})

test('COD gate in the real dispatcher refuses an order and does not insert one', async () => {
  const shop = shopById('beauty')
  const inserts: unknown[] = []
  const products = [{
    id: 'p-serum',
    shop_id: shop.shopId,
    name: 'เซรั่มวิตามินซี',
    price: 590,
    stock: 8,
  }]
  const filters: { op: string; col: string; val: unknown }[] = []
  const query = {
    select() { return query },
    eq(col: string, val: unknown) { filters.push({ op: 'eq', col, val }); return query },
    gte(col: string, val: unknown) { filters.push({ op: 'gte', col, val }); return query },
    ilike(col: string, val: unknown) { filters.push({ op: 'ilike', col, val }); return query },
    limit() { return query },
    order() { return query },
    insert(row: unknown) {
      inserts.push(row)
      return Promise.resolve({ data: row, error: null })
    },
    then(onFulfilled: (value: { data: unknown[]; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
      let rows = products.slice()
      for (const filter of filters) {
        if (filter.op === 'gte') rows = rows.filter((row) => Number(row[filter.col as 'price']) >= Number(filter.val))
        if (filter.op === 'ilike') {
          const needle = String(filter.val).toLowerCase()
          rows = rows.filter((row) => row.name.toLowerCase() === needle)
        }
      }
      filters.length = 0
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
    },
  }
  const db = { from() { return query } }
  const result = await executeTool('take_order', {
    name: 'เอ๋',
    phone: '0810001111',
    items: [{ product: 'เซรั่มวิตามินซี', qty: 1 }],
    address: 'หาดใหญ่',
    payment_method: 'เก็บเงินปลายทาง',
    total_price: 590,
  }, {
    shopId: shop.shopId,
    userId: 'eval-user',
    conversationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    shop: shop.shop,
    supabase: db as never,
    supabaseAdmin: db as never,
    language: 'th',
  })
  assert.match(result.resultForAi, /ไม่ได้เปิดเก็บเงินปลายทาง/)
  assert.equal(inserts.length, 0)
})

test('scorer rejects an invented price and a COD offer the shop disabled', () => {
  const beauty = shopById('beauty')
  const invented = scoreEval({
    evalCase: EVAL_CASES.find((item) => item.id === 'price_stock-04')!,
    shop: beauty,
    finalText: 'เซรั่มวิตามินซีราคา 99999 บาทค่ะ',
    draft: 'เซรั่มวิตามินซีราคา 99999 บาทค่ะ',
    toolCalls: [],
    evidenceTexts: ['เซรั่มวิตามินซี ราคา 590 บาท'],
  })
  assert.equal(invented.pass, false)

  const offer = scoreEval({
    evalCase: EVAL_CASES.find((item) => item.id === 'cod_off-01')!,
    shop: beauty,
    finalText: 'มีเก็บเงินปลายทางค่ะ',
    draft: 'มีเก็บเงินปลายทางค่ะ',
    toolCalls: [],
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
  })
  assert.equal(offer.pass, false)
  assert.equal(offersDisabledCod('ร้านไม่ได้เปิดเก็บเงินปลายทางค่ะ'), false)
  assert.equal(offersDisabledCod('มีเก็บเงินปลายทางค่ะ'), true)
  assert.equal(deniesCod('ไม่รับเก็บปลายทางค่ะ'), true)
  assert.equal(deniesCod('มีเก็บเงินปลายทางค่ะ'), false)

  const verdict = checkGrounding({
    draft: 'มีเก็บเงินปลายทางค่ะ',
    customerMessage: 'เก็บปลายทางได้ไหม',
    language: 'th',
    chunks: [],
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
    codEnabled: false,
  })
  assert.equal(verdict.grounded, false)
  assert.equal(offer.pass, false)

  const denialOn = checkGrounding({
    draft: 'ไม่รับเก็บปลายทางค่ะ',
    customerMessage: 'เก็บปลายทางได้ไหม',
    language: 'th',
    chunks: [],
    evidenceTexts: ['เปิดเก็บเงินปลายทาง'],
    codEnabled: true,
  })
  assert.equal(denialOn.grounded, false)

  const denialOff = checkGrounding({
    draft: 'ไม่รับเก็บปลายทางค่ะ',
    customerMessage: 'เก็บปลายทางได้ไหม',
    language: 'th',
    chunks: [],
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
    codEnabled: false,
  })
  assert.equal(denialOff.grounded, true)

  const unchecked = checkGrounding({
    draft: 'ไม่รับเก็บปลายทางค่ะ',
    customerMessage: 'เก็บปลายทางได้ไหม',
    language: 'th',
    chunks: [],
    evidenceTexts: ['ไม่รับเก็บเงินปลายทาง'],
  })
  assert.equal(unchecked.grounded, false)

  const fashion = shopById('fashion')
  const falseDenial = scoreEval({
    evalCase: EVAL_CASES.find((item) => item.id === 'cod_on-01')!,
    shop: fashion,
    finalText: 'ไม่รับเก็บปลายทางค่ะ',
    draft: 'ไม่รับเก็บปลายทางค่ะ',
    toolCalls: [],
    evidenceTexts: ['เปิดเก็บเงินปลายทาง'],
  })
  assert.equal(falseDenial.pass, false)

  const stockout = checkGrounding({
    draft: 'เสื้อยืดสินค้าหมดค่ะ',
    customerMessage: 'หมดยัง',
    language: 'th',
    chunks: [],
    evidenceTexts: ['เสื้อยืดโอเวอร์ไซส์ ราคา 290 บาท (คงเหลือ: 12 ชิ้น)'],
    codEnabled: true,
  })
  assert.equal(stockout.grounded, false)

  const slots = checkGrounding({
    draft: 'รอบ 18:00 ยังไม่มีค่ะ',
    customerMessage: 'รอบ 18:00 ว่างมั้ย',
    language: 'th',
    chunks: [],
    evidenceTexts: ['เวลาว่าง: 11:00, 13:00, 15:00, 17:00'],
    codEnabled: false,
  })
  assert.equal(slots.grounded, true)
  assert.equal(slots.shouldHandoff, false)
  assert.match(slots.text, /11:00/)
  assert.match(slots.text, /17:00/)
})

test('report groups pass rate by category', () => {
  const report = buildReport({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    judge: false,
    cases: [
      {
        id: 'greeting-01',
        category: 'greeting',
        shopId: 'fashion',
        pass: true,
        reasons: [],
        latencyMs: 10,
        promptTokens: 3,
        completionTokens: 2,
        totalTokens: 5,
        toolCalls: [],
        transcript: [{ role: 'user', text: 'สวัสดีค่ะ' }],
      },
      {
        id: 'price_stock-01',
        category: 'price_stock',
        shopId: 'fashion',
        pass: false,
        reasons: ['final reply is not grounded (unsupported_shop_fact)'],
        latencyMs: 20,
        promptTokens: 4,
        completionTokens: 3,
        totalTokens: 7,
        toolCalls: ['search_products'],
        transcript: [{ role: 'assistant', text: 'ราคา 1 บาท' }],
      },
    ],
  })
  assert.equal(report.summary.passed, 1)
  assert.equal(report.summary.total, 2)
  assert.equal(report.summary.byCategory.greeting.passRate, 1)
  assert.equal(report.summary.byCategory.price_stock.passRate, 0)
  const markdown = reportMarkdown(report)
  assert.match(markdown, /\| greeting \| 1 \| 1 \| 100% \|/)
  assert.match(markdown, /ราคา 1 บาท/)
})
