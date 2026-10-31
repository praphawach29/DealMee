import type { ShopSkill } from './shopSkills'
import { SHADOW_MIN_SAMPLES } from './shadowSamples'

export type ShadowStatus = 'running' | 'completed' | 'insufficient' | 'failed' | 'legacy'
export type ShadowWinner = 'original' | 'shadow' | 'tie' | 'pending'

/** Gemini 2.5 Flash list price, used only as a labeled estimate. Not an invoice. */
export const SHADOW_INPUT_USD_PER_TOKEN = 0.30 / 1_000_000
export const SHADOW_OUTPUT_USD_PER_TOKEN = 2.50 / 1_000_000

export function estimateShadowCostUsd(promptTokens: number, completionTokens: number): number | null {
  if (promptTokens <= 0 && completionTokens <= 0) return null
  const usd = promptTokens * SHADOW_INPUT_USD_PER_TOKEN + completionTokens * SHADOW_OUTPUT_USD_PER_TOKEN
  return Math.round(usd * 1_000_000) / 1_000_000
}

export function pointsToConfidence(points: number): number {
  const clamped = Math.max(-4, Math.min(5, points))
  return Math.round(((clamped + 4) / 9) * 1000) / 1000
}

export function skillDigest(
  skill: Pick<ShopSkill, 'knowledge_body' | 'instruction' | 'trigger_keywords' | 'facts_confirmed' | 'version'>,
  confirmFacts: boolean,
): string {
  const raw = JSON.stringify({
    knowledge_body: skill.knowledge_body || '',
    instruction: skill.instruction || '',
    trigger_keywords: skill.trigger_keywords || [],
    facts_confirmed: skill.facts_confirmed === true || confirmFacts,
    version: skill.version || '',
  })
  let hash = 0
  for (let i = 0; i < raw.length; i++) hash = (Math.imul(hash, 31) + raw.charCodeAt(i)) | 0
  return `v1-${(hash >>> 0).toString(16)}`
}

export function describeShadowResult(input: {
  status: ShadowStatus
  sampleSize: number
  found: number
  improved: number
  regressed: number
  tied: number
  winner: ShadowWinner
  skillsEnabled: boolean
  confirmFacts: boolean
  judgeUsed: boolean
}): string {
  if (input.status === 'running') return 'กำลังทดสอบกับแชทจริงของร้าน ยังไม่สรุปผล และยังไม่เปิดใช้สกิล'
  if (input.status === 'legacy') return 'ผลนี้เป็นการประมาณแบบเดิม ไม่ได้ให้บอทตอบแชทจริง กดทดสอบกับแชทจริงเพื่อดูผลใหม่'
  if (input.status === 'failed') return 'ทดสอบไม่สำเร็จ จึงยังไม่มีผลให้ตัดสิน กดทดสอบใหม่ได้'
  if (input.status === 'insufficient') {
    if (input.found >= SHADOW_MIN_SAMPLES) {
      return `ทดสอบได้ไม่ครบ (ให้คะแนนได้ ${input.sampleSize} ข้อ จากแชทจริง ${input.found} ข้อ) จึงยังไม่สรุปว่าควรเปิดใช้ ระบบไม่ได้สร้างคำถามจำลอง`
    }
    return `แชทจริงของร้านที่เกี่ยวกับสกิลนี้ยังไม่พอ (พบ ${input.found} ข้อ ต้องการอย่างน้อย ${SHADOW_MIN_SAMPLES}) ระบบไม่ได้สร้างคำถามจำลอง และยังไม่สรุปว่าควรเปิดใช้`
  }
  const lead = input.winner === 'shadow'
    ? 'คำตอบที่มีสกิลนี้ดีกว่าในตัวอย่างนี้'
    : input.winner === 'original'
      ? 'คำตอบที่ไม่มีสกิลนี้ดีกว่าในตัวอย่างนี้'
      : 'ผลของสองแบบใกล้เคียงกัน'
  const facts = input.confirmFacts
    ? 'ทดสอบโดยให้ข้อความสกิลเป็นหลักฐานได้'
    : 'ทดสอบโดยยังไม่ให้ข้อความสกิลเป็นหลักฐาน เพราะยังไม่ยืนยันข้อเท็จจริง'
  const flag = input.skillsEnabled ? '' : ' ร้านยังปิดระบบสกิล ผลนี้เป็นการจำลองถ้าเปิดใช้'
  const judge = input.judgeUsed ? ' มีผู้ตรวจเพิ่ม' : ''
  return `${lead} จาก ${input.sampleSize} ข้อ: ดีขึ้น ${input.improved} แย่ลง ${input.regressed} เท่าเดิม ${input.tied} ${facts}${flag}${judge} ระบบจะไม่เปิดใช้สกิลให้อัตโนมัติ`
}

export function isStaleRunning(status: string | null | undefined, createdAt: string | null | undefined, now = Date.now()): boolean {
  if (status !== 'running' || !createdAt) return false
  const started = new Date(createdAt).getTime()
  if (Number.isNaN(started)) return false
  return now - started > 180_000
}
