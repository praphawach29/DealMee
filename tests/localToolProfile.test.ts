import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { evalProfileInstruction, evalToolProfile, selectEvalTools } from './eval/toolProfile.ts'
import { runEvalTurn } from './eval/runTurn.ts'
import { EVAL_CASES } from './eval/fixtures/cases.ts'
import { shopById } from './eval/fixtures/shops.ts'
import { buildReport, reportMarkdown } from './eval/report.ts'

test('local read-only profile removes all mutating and administrative tools', () => {
  const tools = ['search_products', 'check_stock', 'search_knowledge_base', 'take_order', 'request_human_agent', 'send_payment_qr', 'update_customer_note', 'unknown'].map((name) => ({ name, description: name }))
  assert.deepEqual(selectEvalTools(tools, 'read_only').map((tool) => tool.name), ['search_products', 'check_stock', 'search_knowledge_base'])
  assert.equal(selectEvalTools(tools, 'full'), tools)
  assert.equal(evalToolProfile(undefined), 'full')
  assert.throws(() => evalToolProfile('readonly'), /EVAL_TOOL_PROFILE/)
})

test('read-only profile reaches the real planning loop without expanding shop permissions', async () => {
  for (const shopId of ['fashion', 'qa'] as const) {
    const shop = shopById(shopId)
    const evalCase = EVAL_CASES.find((item) => item.id === 'price_stock-01')!
    const offered: string[][] = []
    await runEvalTurn({ shop, evalCase, toolProfile: 'read_only', modelCaller: async (step) => {
      assert.ok(step.systemInstruction.includes(evalProfileInstruction('read_only')))
      offered.push(step.toolNames)
      return { text: 'ขออภัยค่ะ ยังไม่มีข้อมูลยืนยันค่ะ' }
    } })
    assert.ok(offered.length > 0)
    assert.ok(offered.every((names) => names.every((name) => ['search_products', 'check_stock', 'search_knowledge_base'].includes(name))))
    if (shopId === 'qa') assert.ok(offered.every((names) => !names.includes('check_stock')))
  }
})

test('full profile preserves existing instructions', () => {
  assert.equal(evalProfileInstruction('full'), '')
  assert.match(evalProfileInstruction('read_only'), /search_products/)
})

test('reports identify read-only baselines separately from full evaluations', () => {
  const report = buildReport({ provider: 'ollama', model: 'test', judge: false, cases: [], toolProfile: 'read_only' })
  assert.equal(report.toolProfile, 'read_only')
  assert.match(reportMarkdown(report), /Read-only results do not certify ordering/)
  assert.equal(buildReport({ provider: 'ollama', model: 'test', judge: false, cases: [] }).toolProfile, 'full')
})

test('local entrypoint forces Ollama and disables the judge even with cloud configuration', () => {
  const result = spawnSync(process.execPath, ['--import', './tests/eval/local-env.mjs', '-e', 'console.log(JSON.stringify({provider:process.env.EVAL_PROVIDER,judge:process.env.EVAL_JUDGE,profile:process.env.EVAL_TOOL_PROFILE,caseId:process.env.EVAL_CASE}))'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, EVAL_PROVIDER: 'gemini', EVAL_JUDGE: '1', EVAL_TOOL_PROFILE: '', EVAL_CASE: '', EVAL_CATEGORY: '' },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), { provider: 'ollama', judge: '0', profile: 'read_only', caseId: 'price_stock-01' })
})
