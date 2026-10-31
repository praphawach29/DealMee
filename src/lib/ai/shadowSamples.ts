import { redactPii } from './redactPii'
import type { ShopSkill } from './shopSkills'

/** How many real turns one replay will score. Kept small for serverless time. */
export const SHADOW_SAMPLE_CAP = 3
/** Below this, the result says there is not enough data and does not call the model. */
export const SHADOW_MIN_SAMPLES = 3

export type ShadowSender = 'user' | 'bot'

export type ShadowMessage = {
  id: string
  shopId: string
  conversationId: string
  userId: string
  sender: ShadowSender
  text: string
  createdAt: string
}

export type ShadowHistoryTurn = { sender: ShadowSender; text: string }

export type ShadowSample = {
  id: string
  conversationId: string
  userId: string
  createdAt: string
  redactedText: string
  history: ShadowHistoryTurn[]
}

const PLACEHOLDER_ONLY = /^(?:\[เบอร์โทร\]|\[อีเมล\]|\[เลขบัตรประชาชน\]|\[LINE ID\]|\[เลขบัญชี\]|\[เลขที่เอกสาร\]|\[รหัสผู้ใช้\]|\[เลขบัตร\]|\[ชื่อ\]|\s|[^\p{L}\p{N}])+$/u

export function isSubstantiveCustomerTurn(redacted: string): boolean {
  const text = redacted.trim()
  if (text.length < 8) return false
  return !PLACEHOLDER_ONLY.test(text)
}

export function messageMatchesSkill(skill: Pick<ShopSkill, 'skill_type' | 'category' | 'trigger_keywords'>, redacted: string): boolean {
  const text = redacted.toLocaleLowerCase('th-TH')
  const keywords = (skill.trigger_keywords || []).map((keyword) => keyword.trim()).filter((keyword) => keyword.length >= 2)
  if (keywords.length === 0) {
    if (skill.skill_type === 'behavior' || skill.skill_type === 'rule') return true
    const category = (skill.category || '').trim().toLocaleLowerCase('th-TH')
    return category.length >= 2 && text.includes(category)
  }
  return keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase('th-TH')))
}

export function redactHistory(turns: ShadowHistoryTurn[]): ShadowHistoryTurn[] {
  return turns.slice(-8).map((turn) => ({
    sender: turn.sender === 'user' ? 'user' : 'bot',
    text: redactPii(turn.text || '').slice(0, 500),
  }))
}

/**
 * Picks real customer turns from this shop only. Other shops are ignored.
 * The returned text is already redacted. Not enough matches is an honest miss,
 * not a reason to invent questions.
 */
export function selectShadowSamples(input: {
  shopId: string
  skill: Pick<ShopSkill, 'skill_type' | 'category' | 'trigger_keywords'>
  messages: ShadowMessage[]
  historyFor?: (sample: ShadowMessage) => ShadowHistoryTurn[]
  cap?: number
  minimum?: number
}): { enough: boolean; found: number; samples: ShadowSample[] } {
  const cap = input.cap ?? SHADOW_SAMPLE_CAP
  const minimum = input.minimum ?? SHADOW_MIN_SAMPLES
  const seen = new Set<string>()
  const samples: ShadowSample[] = []
  const ordered = [...input.messages].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  for (const message of ordered) {
    if (message.shopId !== input.shopId) continue
    if (message.sender !== 'user') continue
    const redacted = redactPii(message.text || '').trim()
    if (!isSubstantiveCustomerTurn(redacted)) continue
    if (!messageMatchesSkill(input.skill, redacted)) continue
    const key = redacted.toLocaleLowerCase('th-TH')
    if (seen.has(key)) continue
    seen.add(key)
    samples.push({
      id: message.id,
      conversationId: message.conversationId,
      userId: message.userId || 'shadow-replay',
      createdAt: message.createdAt,
      redactedText: redacted.slice(0, 500),
      history: redactHistory(input.historyFor?.(message) || []),
    })
    if (samples.length >= cap) break
  }
  return { enough: samples.length >= minimum, found: samples.length, samples }
}
