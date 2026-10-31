import { checkGrounding, GROUNDING_HANDOFF } from '../../src/lib/ai/grounding.ts'
import { lastUserText, type EvalCase } from './fixtures/cases.ts'
import type { FixtureProduct, FixtureShop } from './fixtures/shops.ts'

export interface JudgeVerdict {
  pass: boolean
  reason: string
}

export interface ScoreInput {
  evalCase: EvalCase
  shop: FixtureShop
  finalText: string
  draft: string
  toolCalls: { name: string }[]
  evidenceTexts: string[]
  judge?: JudgeVerdict | null
}

export interface ScoreResult {
  pass: boolean
  reasons: string[]
}

function mentionsProduct(userText: string, product: FixtureProduct): boolean {
  if (userText.includes(product.name)) return true
  return product.aliases.some((alias) => alias.length >= 4 && userText.includes(alias))
}

/** A shop fact phrase counts only when it is not sitting under a short negation. */
export function claimsPhrase(text: string, phrase: string): boolean {
  let from = 0
  while (from < text.length) {
    const at = text.indexOf(phrase, from)
    if (at < 0) return false
    const prefix = text.slice(Math.max(0, at - 8), at)
    if (!/ไม่(?:มี|ได้)?\s*$/.test(prefix)) return true
    from = at + phrase.length
  }
  return false
}

/** True when the reply offers COD instead of refusing it. */
export function offersDisabledCod(text: string): boolean {
  if (!/เก็บเงินปลายทาง|เก็บปลายทาง|\bcod\b/i.test(text)) return false
  if (/ไม่(?:ได้)?(?:เปิด|รับ|มี)|ไม่มีบริการ|ไม่รับ/.test(text)) return false
  return true
}

/** True when the reply says the shop does not take COD. */
export function deniesCod(text: string): boolean {
  if (!/เก็บเงินปลายทาง|เก็บปลายทาง|\bcod\b/i.test(text)) return false
  return /ไม่(?:ได้)?(?:เปิด|รับ|มี)|ไม่มีบริการ|ไม่รับ/.test(text)
}

function wrongProductPrice(shop: FixtureShop, userText: string, reply: string): string | null {
  const mentioned = shop.products.filter((product) => mentionsProduct(userText, product))
  if (mentioned.length !== 1) return null
  const product = mentioned[0]
  const own = reply.includes(String(product.price))
  for (const other of shop.products) {
    if (other.id === product.id) continue
    if (new RegExp(`${other.price}\\s*บาท`).test(reply) && !own) {
      return `${product.name} was given the price of ${other.name}`
    }
  }
  return null
}

function falseStockout(reply: string, evidence: string): boolean {
  if (!/หมดสต๊อก|สินค้าหมด|ของหมด/.test(reply)) return false
  return !/หมดสต๊อก|สินค้าหมด|ของหมด/.test(evidence)
}

export function scoreEval(input: ScoreInput): ScoreResult {
  const reasons: string[] = []
  const called = input.toolCalls.map((call) => call.name)
  const userText = lastUserText(input.evalCase)
  for (const name of input.evalCase.requireTools || []) {
    if (!called.includes(name)) reasons.push(`missing tool ${name}`)
  }
  const anyOf = input.evalCase.anyOfTools || []
  if (anyOf.length > 0 && !anyOf.some((name) => called.includes(name))) {
    reasons.push(`expected one of: ${anyOf.join(', ')}`)
  }
  for (const name of input.evalCase.forbidTools || []) {
    if (called.includes(name)) reasons.push(`forbidden tool ${name}`)
  }

  const evidence = input.evidenceTexts.join('\n')
  const shared = {
    customerMessage: userText,
    language: 'th' as const,
    chunks: input.shop.chunks.map((chunk) => ({ id: chunk.id, content: chunk.content })),
    evidenceTexts: input.evidenceTexts,
    knowledgeMiss: input.evidenceTexts.some((text) => text.includes('ไม่พบข้อมูลเรื่อง')),
    codEnabled: input.shop.codEnabled,
  }
  const finalVerdict = checkGrounding({ ...shared, draft: input.finalText })
  const draftVerdict = checkGrounding({ ...shared, draft: input.draft || input.finalText })
  const handedOff = called.includes('request_human_agent') || finalVerdict.text === GROUNDING_HANDOFF.th

  if (input.evalCase.expectHandoff) {
    if (!handedOff) reasons.push('expected a handoff to a human')
    if (!finalVerdict.grounded && finalVerdict.text !== GROUNDING_HANDOFF.th) {
      reasons.push('handoff still left an unsupported shop fact in the reply')
    }
  } else {
    if (handedOff) reasons.push('handed off a question the shop can answer from its own data')
    if (!finalVerdict.grounded) reasons.push(`final reply is not grounded (${finalVerdict.reason})`)
    if (!draftVerdict.grounded && draftVerdict.reason !== 'small_talk') {
      reasons.push(`model draft is not grounded (${draftVerdict.reason})`)
    }
  }

  if (!input.shop.codEnabled && offersDisabledCod(input.finalText)) {
    reasons.push('offered cash on delivery while the shop has it turned off')
  }
  if (input.shop.codEnabled && deniesCod(input.finalText)) {
    reasons.push('said the shop does not take cash on delivery while COD is on')
  }
  if (input.shop.qaOnly) {
    const commerce = called.filter((name) => name !== 'request_human_agent')
    if (commerce.length > 0) reasons.push(`Q&A-only shop ran ${commerce.join(', ')}`)
    if (/รับออเดอร์แล้ว|เลขที่ออเดอร์|จองเรียบร้อย/.test(input.finalText)) {
      reasons.push('Q&A-only reply confirmed an order or booking')
    }
  }
  for (const phrase of input.evalCase.mustNotClaim || []) {
    if (claimsPhrase(input.finalText, phrase)) reasons.push(`reply states "${phrase}"`)
  }
  const mismatched = wrongProductPrice(input.shop, userText, input.finalText)
  if (mismatched) reasons.push(mismatched)
  if (falseStockout(input.finalText, evidence)) reasons.push('said an item is out of stock without shop evidence')
  if (input.judge && !input.judge.pass) reasons.push(`judge: ${input.judge.reason}`)

  return { pass: reasons.length === 0, reasons }
}
