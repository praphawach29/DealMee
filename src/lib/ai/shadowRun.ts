import type { ShopSkill } from './shopSkills'
import type { JudgeVerdict } from './replyJudge'
import {
  describeShadowResult,
  estimateShadowCostUsd,
  pointsToConfidence,
  type ShadowStatus,
  type ShadowWinner,
} from './shadowReport'
import { selectShadowSamples, type ShadowHistoryTurn, type ShadowMessage, type ShadowSample } from './shadowSamples'
import { compareArms, type ShadowArmReplay } from './shadowScore'

export type ShadowJudge = (input: {
  question: string
  answer: string
  evidence: string
}) => Promise<(JudgeVerdict & { promptTokens?: number; completionTokens?: number }) | null>

export type ShadowReplay = (sample: ShadowSample, arm: 'with' | 'without') => Promise<ShadowArmReplay>

export type ShadowRunResult = {
  status: ShadowStatus
  winner: ShadowWinner
  recommendation: string
  sampleSize: number
  found: number
  improved: number
  regressed: number
  tied: number
  groundedWith: number
  groundedWithout: number
  handoffWith: number
  handoffWithout: number
  judgeWith: number | null
  judgeWithout: number | null
  judgeUsed: boolean
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number | null
  originalConfidence: number | null
  shadowConfidence: number | null
  metrics: Record<string, unknown>
}

const DEADLINE_MS = 50_000

export function previewSkill(skill: ShopSkill, confirmFacts: boolean): ShopSkill {
  return {
    ...skill,
    status: 'active',
    facts_confirmed: skill.facts_confirmed === true || confirmFacts === true,
  }
}

export async function runShadowComparison(input: {
  shopId: string
  skill: Pick<ShopSkill, 'skill_type' | 'category' | 'trigger_keywords'>
  messages: ShadowMessage[]
  historyFor?: (sample: ShadowMessage) => ShadowHistoryTurn[]
  skillsEnabled: boolean
  confirmFacts: boolean
  replay: ShadowReplay
  judge?: ShadowJudge | null
  deadlineMs?: number
  now?: number
}): Promise<ShadowRunResult> {
  const started = input.now ?? Date.now()
  const deadline = started + (input.deadlineMs ?? DEADLINE_MS)
  const selected = selectShadowSamples({
    shopId: input.shopId,
    skill: input.skill,
    messages: input.messages,
    historyFor: input.historyFor,
  })
  const base = {
    skillsEnabled: input.skillsEnabled,
    confirmFacts: input.confirmFacts,
    judgeUsed: false,
  }
  if (!selected.enough) {
    return finish({
      ...base,
      status: 'insufficient',
      winner: 'pending',
      sampleSize: 0,
      found: selected.found,
      improved: 0,
      regressed: 0,
      tied: 0,
      groundedWith: 0,
      groundedWithout: 0,
      handoffWith: 0,
      handoffWithout: 0,
      judgeWith: null,
      judgeWithout: null,
      promptTokens: 0,
      completionTokens: 0,
      samples: [],
    })
  }

  const scored: Array<ReturnType<typeof compareArms> & { id: string }> = []
  let promptTokens = 0
  let completionTokens = 0
  let judgeWith = 0
  let judgeWithout = 0
  let judgeCalls = 0
  for (const sample of selected.samples) {
    if (Date.now() >= deadline) break
    let without: ShadowArmReplay
    let withSkill: ShadowArmReplay
    try {
      without = await input.replay(sample, 'without')
      if (Date.now() >= deadline) break
      withSkill = await input.replay(sample, 'with')
    } catch (err) {
      console.error('[ShadowEval] replay failed', err instanceof Error ? err.message : err)
      continue
    }
    promptTokens += (without.promptTokens || 0) + (withSkill.promptTokens || 0)
    completionTokens += (without.completionTokens || 0) + (withSkill.completionTokens || 0)
    const judgeOn = Boolean(input.judge) && process.env.SHADOW_JUDGE !== '0' && Date.now() < deadline
    if (judgeOn && input.judge) {
      const evidence = [...without.evidenceTexts, ...withSkill.evidenceTexts].join('\n')
      const judgedWithout = await input.judge({ question: sample.redactedText, answer: without.finalText, evidence })
      const judgedWith = await input.judge({ question: sample.redactedText, answer: withSkill.finalText, evidence })
      if (judgedWithout) {
        without = { ...without, judge: judgedWithout }
        judgeCalls += 1
        promptTokens += judgedWithout.promptTokens || 0
        completionTokens += judgedWithout.completionTokens || 0
        if (judgedWithout.pass) judgeWithout += 1
      }
      if (judgedWith) {
        withSkill = { ...withSkill, judge: judgedWith }
        judgeCalls += 1
        promptTokens += judgedWith.promptTokens || 0
        completionTokens += judgedWith.completionTokens || 0
        if (judgedWith.pass) judgeWith += 1
      }
    }
    scored.push({ id: sample.id, ...compareArms(sample.redactedText, withSkill, without) })
  }

  if (scored.length < 3) {
    return finish({
      ...base,
      status: scored.length === 0 && selected.found >= 3 ? 'failed' : 'insufficient',
      winner: 'pending',
      sampleSize: scored.length,
      found: selected.found,
      improved: scored.filter((row) => row.outcome === 'improved').length,
      regressed: scored.filter((row) => row.outcome === 'regressed').length,
      tied: scored.filter((row) => row.outcome === 'tied').length,
      groundedWith: scored.filter((row) => row.with.grounded).length,
      groundedWithout: scored.filter((row) => row.without.grounded).length,
      handoffWith: scored.filter((row) => row.with.handedOff).length,
      handoffWithout: scored.filter((row) => row.without.handedOff).length,
      judgeWith: judgeCalls > 0 ? judgeWith : null,
      judgeWithout: judgeCalls > 0 ? judgeWithout : null,
      judgeUsed: judgeCalls > 0,
      promptTokens,
      completionTokens,
      samples: scored,
    })
  }

  const improved = scored.filter((row) => row.outcome === 'improved').length
  const regressed = scored.filter((row) => row.outcome === 'regressed').length
  const tied = scored.filter((row) => row.outcome === 'tied').length
  const winner: ShadowWinner = improved > regressed ? 'shadow' : regressed > improved ? 'original' : 'tie'
  return finish({
    ...base,
    status: 'completed',
    winner,
    sampleSize: scored.length,
    found: selected.found,
    improved,
    regressed,
    tied,
    groundedWith: scored.filter((row) => row.with.grounded).length,
    groundedWithout: scored.filter((row) => row.without.grounded).length,
    handoffWith: scored.filter((row) => row.with.handedOff).length,
    handoffWithout: scored.filter((row) => row.without.handedOff).length,
    judgeWith: judgeCalls > 0 ? judgeWith : null,
    judgeWithout: judgeCalls > 0 ? judgeWithout : null,
    judgeUsed: judgeCalls > 0,
    promptTokens,
    completionTokens,
    samples: scored,
  })
}

function finish(input: {
  status: ShadowStatus
  winner: ShadowWinner
  sampleSize: number
  found: number
  improved: number
  regressed: number
  tied: number
  groundedWith: number
  groundedWithout: number
  handoffWith: number
  handoffWithout: number
  judgeWith: number | null
  judgeWithout: number | null
  judgeUsed: boolean
  promptTokens: number
  completionTokens: number
  skillsEnabled: boolean
  confirmFacts: boolean
  samples: Array<{ id: string; outcome: string; with: { points: number; grounded: boolean; handedOff: boolean; reasons: string[]; tools: string[] }; without: { points: number; grounded: boolean; handedOff: boolean; reasons: string[]; tools: string[] } }>
}): ShadowRunResult {
  const withPoints = input.samples.reduce((sum, row) => sum + row.with.points, 0)
  const withoutPoints = input.samples.reduce((sum, row) => sum + row.without.points, 0)
  const n = input.samples.length
  return {
    status: input.status,
    winner: input.winner,
    recommendation: describeShadowResult(input),
    sampleSize: input.sampleSize,
    found: input.found,
    improved: input.improved,
    regressed: input.regressed,
    tied: input.tied,
    groundedWith: input.groundedWith,
    groundedWithout: input.groundedWithout,
    handoffWith: input.handoffWith,
    handoffWithout: input.handoffWithout,
    judgeWith: input.judgeWith,
    judgeWithout: input.judgeWithout,
    judgeUsed: input.judgeUsed,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    estimatedCostUsd: estimateShadowCostUsd(input.promptTokens, input.completionTokens),
    originalConfidence: n > 0 ? pointsToConfidence(withoutPoints / n) : null,
    shadowConfidence: n > 0 ? pointsToConfidence(withPoints / n) : null,
    metrics: {
      kind: 'replay',
      confirmFacts: input.confirmFacts,
      skillsEnabled: input.skillsEnabled,
      found: input.found,
      scored: n,
      samples: input.samples.map((row) => ({
        outcome: row.outcome,
        with: { points: row.with.points, grounded: row.with.grounded, handedOff: row.with.handedOff, tools: row.with.tools, reasons: row.with.reasons },
        without: { points: row.without.points, grounded: row.without.grounded, handedOff: row.without.handedOff, tools: row.without.tools, reasons: row.without.reasons },
      })),
    },
  }
}
