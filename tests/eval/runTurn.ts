import { detectCustomerLanguage } from '../../src/lib/i18n/customerMessages.ts'
import {
  classifyMessageComplexity,
  continueSalesAgentPlanning,
  guardQaOnlyExecutor,
  toolsOfferedForShop,
  type AgentToolName,
  type AgentUsage,
  type ModelCaller,
  type ModelStepResult,
  type PlanningState,
} from '../../src/lib/ai/salesAgentEngine.ts'
import { lastUserText, scriptedToolNames, type EvalCase } from './fixtures/cases.ts'
import type { FixtureShop } from './fixtures/shops.ts'
import { argsForTool, createFixtureExecutor, type LoggedTool } from './fixtureExecutor.ts'
import { createGapClient } from './gapClient.ts'
import { buildShopContext } from './shopPrompt.ts'

const CONVERSATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

export interface TurnResult {
  text: string
  drafts: string[]
  toolCalls: { name: string; args: Record<string, unknown> }[]
  toolLog: LoggedTool[]
  evidenceTexts: string[]
  gaps: Record<string, unknown>[]
  offeredTools: string[]
  usage?: AgentUsage
  latencyMs: number
}

function productsMentioned(shop: FixtureShop, text: string) {
  return shop.products.filter((product) =>
    text.includes(product.name) || product.aliases.some((alias) => alias.length >= 4 && text.includes(alias)),
  )
}

export function offlineDraft(shop: FixtureShop, evalCase: EvalCase): string {
  if (evalCase.scriptedReply) return evalCase.scriptedReply
  if (evalCase.offlineInvent) return 'รับประกัน 9 ปี ราคา 99999 บาท และส่งฟรีทุกชิ้นค่ะ'
  if (evalCase.category === 'greeting') return 'สวัสดีค่ะ วันนี้สนใจดูอะไรเป็นพิเศษคะ'
  const mentioned = productsMentioned(shop, evalCase.turns.map((turn) => turn.text).join('\n'))
  if (mentioned.length > 0 && (evalCase.category === 'price_stock' || evalCase.category === 'product')) {
    const prices = mentioned.map((product) => `${product.name} ราคา ${product.price} บาท`).join(' และ ')
    return `${prices}ค่ะ สนใจแบบไหนเพิ่มเติมดีคะ`
  }
  if (evalCase.expectHandoff) return 'ส่งเรื่องให้แอดมินดูแลแล้วนะคะ เดี๋ยวติดต่อกลับค่ะ'
  return 'รับทราบค่ะ มีอะไรให้ช่วยเพิ่มเติมไหมคะ'
}

export function scriptedModelCaller(shop: FixtureShop, evalCase: EvalCase): ModelCaller {
  const userText = lastUserText(evalCase)
  const steps: ModelStepResult[] = [
    ...scriptedToolNames(evalCase).map((name, index) => ({
      text: '',
      toolCall: {
        name: name as AgentToolName,
        args: argsForTool(name, shop, userText),
        id: `script-${index}`,
      },
    })),
    { text: offlineDraft(shop, evalCase) },
  ]
  return async (input) => {
    const step = steps[Math.min(input.step, steps.length - 1)]
    return {
      ...step,
      usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18, provider: 'gemini' },
    }
  }
}

export async function runEvalTurn(input: {
  shop: FixtureShop
  evalCase: EvalCase
  modelCaller: ModelCaller
}): Promise<TurnResult> {
  const userText = lastUserText(input.evalCase)
  const context = buildShopContext(input.shop, input.evalCase.turns)
  const routing = classifyMessageComplexity(userText)
  routing.toolSet = toolsOfferedForShop(input.shop.shop, { catalogEmpty: input.shop.products.length === 0 })
  const toolLog: LoggedTool[] = []
  const gaps = createGapClient()
  const drafts: string[] = []
  const offeredTools: string[] = []
  let latencyMs = 0
  const wrapped: ModelCaller = async (step) => {
    if (offeredTools.length === 0) offeredTools.push(...step.toolNames)
    const started = Date.now()
    try {
      const result = await input.modelCaller(step)
      if (result && !result.toolCall && result.text) drafts.push(result.text)
      return result
    } finally {
      latencyMs += Date.now() - started
    }
  }
  const language = detectCustomerLanguage(userText)
  const userTurns = input.evalCase.turns.filter((turn) => turn.role === 'user').length
  const state: PlanningState = {
    shop: input.shop.shop,
    conversationId: CONVERSATION_ID,
    salesStage: 'discovery',
    isFirstCustomerTurn: userTurns <= 1,
    language,
    turns: [{ role: 'user', text: userText }],
    step: 0,
    routing,
    executor: guardQaOnlyExecutor(input.shop.qaOnly, createFixtureExecutor(input.shop, toolLog)),
    toolCtx: {
      shopId: input.shop.shopId,
      userId: 'eval-user',
      conversationId: CONVERSATION_ID,
      language,
      shop: input.shop.shop,
      supabase: gaps as never,
      supabaseAdmin: gaps as never,
    },
    staticSystemPrompt: context.prompt,
    dynamicSystemPrompt: '',
    systemInstruction: context.prompt,
    modelName: 'eval-scripted',
    geminiKey: '',
    claudeKey: '',
    openAiKey: '',
    byok: true,
    allUsage: [],
    immediateMessages: [],
    toolCallsExecuted: [],
    scheduledMessages: [],
    isPlayground: false,
    groundingChunks: input.shop.chunks.map((chunk) => ({ id: chunk.id, content: chunk.content })),
    groundingTexts: context.groundingTexts,
    modelCaller: wrapped,
  }
  const result = await continueSalesAgentPlanning(state)
  return {
    text: result.text,
    drafts,
    toolCalls: result.toolCallsExecuted.map((call) => ({ name: call.name, args: call.args || {} })),
    toolLog,
    evidenceTexts: state.groundingTexts,
    gaps: gaps.gaps,
    offeredTools,
    usage: result.usage,
    latencyMs,
  }
}
