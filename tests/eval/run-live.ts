/**
 * Live sales-agent eval. Calls the configured model through the real planning
 * loop and scores tool choice plus grounding. Fixture shops stay in memory.
 *
 *   EVAL_PROVIDER=gemini|openrouter
 *   EVAL_MODEL=gemini-2.5-flash
 *   GEMINI_API_KEY=...          (or OPENROUTER_API_KEY)
 *   EVAL_JUDGE=1                optional second call
 *   EVAL_JUDGE_MODEL=           defaults to EVAL_MODEL
 *   EVAL_CATEGORY=price_stock   optional filter
 *   EVAL_CASE=price_stock-01    optional filter
 *   EVAL_LIMIT=5                optional cap
 *   EVAL_OUT=eval-reports
 *
 *   npm run eval:live
 */
import { toolsOfferedForShop } from '../../src/lib/ai/salesAgentEngine.ts'
import { EVAL_CASES, lastUserText } from './fixtures/cases.ts'
import { shopById } from './fixtures/shops.ts'
import { createLiveCaller, judgeReply, providerFromEnv } from './providers.ts'
import { buildReport, reportMarkdown, writeReport, type CaseReport } from './report.ts'
import { runEvalTurn } from './runTurn.ts'
import { scoreEval } from './score.ts'
import { buildShopContext } from './shopPrompt.ts'

const config = providerFromEnv()
if (!config.apiKey) {
  const keyName = config.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY'
  console.error(`No ${keyName} in the environment, so the live eval did not run.`)
  process.exit(1)
}

const category = process.env.EVAL_CATEGORY?.trim()
const caseId = process.env.EVAL_CASE?.trim()
const limit = Number(process.env.EVAL_LIMIT || 0)
let cases = EVAL_CASES
if (category) cases = cases.filter((item) => item.category === category)
if (caseId) cases = cases.filter((item) => item.id === caseId)
if (limit > 0) cases = cases.slice(0, limit)
if (cases.length === 0) {
  console.error('No eval cases matched the filter.')
  process.exit(1)
}

const judgeOn = process.env.EVAL_JUDGE === '1'
const judgeModel = process.env.EVAL_JUDGE_MODEL?.trim() || config.model
const rows: CaseReport[] = []

for (const evalCase of cases) {
  const shop = shopById(evalCase.shopId)
  const usage = { promptTokens: 0, completionTokens: 0 }
  const tools = toolsOfferedForShop(shop.shop as never, { catalogEmpty: shop.products.length === 0 })
  const started = Date.now()
  try {
    const result = await runEvalTurn({
      shop,
      evalCase,
      modelCaller: createLiveCaller({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        tools,
        usage,
      }),
    })
    const evidence = buildShopContext(shop, evalCase.turns).groundingTexts.concat(result.toolLog.map((entry) => entry.result))
    const judge = judgeOn
      ? await judgeReply({
          provider: config.provider,
          model: judgeModel,
          apiKey: config.apiKey,
          question: lastUserText(evalCase),
          answer: result.text,
          evidence: evidence.join('\n'),
        })
      : null
    const scored = scoreEval({
      evalCase,
      shop,
      finalText: result.text,
      draft: result.drafts.at(-1) || result.text,
      toolCalls: result.toolCalls,
      evidenceTexts: result.evidenceTexts,
      judge,
    })
    rows.push({
      id: evalCase.id,
      category: evalCase.category,
      shopId: shop.id,
      pass: scored.pass,
      reasons: scored.reasons,
      latencyMs: result.latencyMs,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.promptTokens + usage.completionTokens,
      toolCalls: result.toolCalls.map((call) => call.name),
      transcript: [
        ...evalCase.turns,
        { role: 'tools', text: result.toolCalls.map((call) => call.name).join(', ') || '(none)' },
        { role: 'assistant', text: result.text },
      ],
    })
    console.log(`${scored.pass ? 'PASS' : 'FAIL'} ${evalCase.id} ${result.latencyMs}ms ${result.toolCalls.map((call) => call.name).join(',')}`)
    if (!scored.pass) console.log(`  ${scored.reasons.join('; ')}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    rows.push({
      id: evalCase.id,
      category: evalCase.category,
      shopId: shop.id,
      pass: false,
      reasons: [message],
      latencyMs: Date.now() - started,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.promptTokens + usage.completionTokens,
      toolCalls: [],
      transcript: [...evalCase.turns, { role: 'error', text: message }],
    })
    console.log(`FAIL ${evalCase.id} ${message}`)
  }
}

const report = buildReport({ provider: config.provider, model: config.model, judge: judgeOn, cases: rows })
const written = writeReport(report, process.env.EVAL_OUT || 'eval-reports')
console.log(`\n${reportMarkdown(report)}`)
console.log(`\nWrote ${written.jsonPath}`)
console.log(`Wrote ${written.markdownPath}`)
process.exit(report.summary.passed === report.summary.total ? 0 : 1)
