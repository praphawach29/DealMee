import { checkGrounding, GROUNDING_HANDOFF, type EvidenceChunk } from './grounding'
import { isGreetingOnlyMessage } from './handoffGuard'
import type { JudgeVerdict } from './replyJudge'

export type ShadowArmName = 'with' | 'without'

export type ShadowArmReplay = {
  finalText: string
  draft: string
  toolCalls: { name: string }[]
  evidenceTexts: string[]
  chunks: EvidenceChunk[]
  codEnabled: boolean | null
  promptTokens?: number
  completionTokens?: number
  judge?: JudgeVerdict | null
}

export type ShadowArmScore = {
  points: number
  grounded: boolean
  handedOff: boolean
  reasons: string[]
  tools: string[]
}

const WRITE_CLAIM = /รับออเดอร์แล้ว|จองเรียบร้อย|เลขที่ออเดอร์|เลขที่จอง/
const WANTS_HUMAN = /แอดมิน|คุยกับคน|เจ้าหน้าที่|ขอคนจริง/
const LOOKUP_TOOL = /search_products|check_stock|search_knowledge_base|check_available_slots|get_active_promotions|calculate_shipping/
const PRICE_ASK = /ราคา|เท่าไหร่|กี่บาท|สต็อก|สต๊อก|มีไหม|คงเหลือ/

function handedOff(text: string, tools: string[]): boolean {
  if (tools.includes('request_human_agent') || tools.includes('transfer_to_agent')) return true
  return text.trim() === GROUNDING_HANDOFF.th || text.trim() === GROUNDING_HANDOFF.en
}

/**
 * Higher is better. Grounded answers beat a necessary handoff, which beats
 * an unnecessary handoff. The judge, when present, moves the score by one.
 */
export function scoreShadowArm(customerMessage: string, arm: ShadowArmReplay): ShadowArmScore {
  const tools = arm.toolCalls.map((call) => call.name)
  const draftVerdict = checkGrounding({
    draft: arm.draft || arm.finalText,
    customerMessage,
    language: 'th',
    chunks: arm.chunks,
    evidenceTexts: arm.evidenceTexts,
    codEnabled: arm.codEnabled,
  })
  const finalVerdict = checkGrounding({
    draft: arm.finalText,
    customerMessage,
    language: 'th',
    chunks: arm.chunks,
    evidenceTexts: arm.evidenceTexts,
    codEnabled: arm.codEnabled,
  })
  const handoff = handedOff(arm.finalText, tools)
  const groundedAnswer = draftVerdict.reason === 'grounded' && finalVerdict.reason === 'grounded' && !handoff
  const reasons: string[] = []
  let points = 0

  if (isGreetingOnlyMessage(customerMessage) && handoff) {
    points -= 2
    reasons.push('handoff_on_greeting')
  } else if (WANTS_HUMAN.test(customerMessage) && handoff) {
    points += 2
    reasons.push('handoff_requested')
  } else if (groundedAnswer) {
    points += 3
    reasons.push('grounded_answer')
  } else if (handoff && draftVerdict.reason === 'grounded') {
    points -= 1
    reasons.push('unnecessary_handoff')
  } else if (handoff) {
    points += 1
    reasons.push('handoff_unsupported')
  } else if (draftVerdict.grounded && (draftVerdict.reason === 'small_talk' || finalVerdict.reason === 'small_talk')) {
    points += 1
    reasons.push('safe_reply')
  } else {
    reasons.push('ungrounded')
  }

  if (PRICE_ASK.test(customerMessage) && tools.some((name) => LOOKUP_TOOL.test(name))) {
    points += 1
    reasons.push('lookup_tool')
  }
  if (WRITE_CLAIM.test(arm.finalText)) {
    const evidence = arm.evidenceTexts.join('\n')
    const blocked = /โหมดทดสอบ|ไม่ได้ดำเนินการ/.test(evidence) || !/เลขที่ออเดอร์|เลขที่จอง|ORD-|BK-/.test(evidence)
    if (blocked) {
      points -= 2
      reasons.push('claimed_write')
    }
  }
  if (arm.judge) {
    points += arm.judge.pass ? 1 : -1
    reasons.push(arm.judge.pass ? 'judge_pass' : 'judge_fail')
  }

  return { points, grounded: groundedAnswer, handedOff: handoff, reasons, tools }
}

export type SampleOutcome = 'improved' | 'regressed' | 'tied'

export function compareArms(customerMessage: string, withSkill: ShadowArmReplay, withoutSkill: ShadowArmReplay): {
  outcome: SampleOutcome
  with: ShadowArmScore
  without: ShadowArmScore
} {
  const withScore = scoreShadowArm(customerMessage, withSkill)
  const withoutScore = scoreShadowArm(customerMessage, withoutSkill)
  const outcome: SampleOutcome = withScore.points > withoutScore.points
    ? 'improved'
    : withScore.points < withoutScore.points
      ? 'regressed'
      : 'tied'
  return { outcome, with: withScore, without: withoutScore }
}
