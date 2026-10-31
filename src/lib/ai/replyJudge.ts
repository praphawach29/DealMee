import type { ModelCaller } from './salesAgentEngine'

export const REPLY_JUDGE_INSTRUCTION = [
  'คุณเป็นผู้ตรวจคำตอบบอทขาย ตรวจว่าคำตอบใช้เฉพาะข้อมูลร้าน ไม่แต่งราคา สต็อก ค่าส่ง โปรโมชั่น หรือนโยบาย',
  'ตอบเป็น JSON เท่านั้น: {"pass": true, "reason": "สั้นๆ"}',
].join('\n')

export interface JudgeVerdict {
  pass: boolean
  reason: string
}

export function judgePrompt(input: { question: string; answer: string; evidence: string }): string {
  return [
    REPLY_JUDGE_INSTRUCTION,
    `คำถาม: ${input.question}`,
    `คำตอบ: ${input.answer}`,
    `ข้อมูลร้าน: ${input.evidence.slice(0, 4000)}`,
  ].join('\n')
}

export function parseJudgeVerdict(text: string): JudgeVerdict | null {
  const match = (text || '').match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { pass?: boolean; reason?: string }
    if (typeof parsed.pass !== 'boolean') return null
    return { pass: parsed.pass, reason: String(parsed.reason || '').slice(0, 240) }
  } catch {
    return null
  }
}

export async function judgeReplyWithCaller(
  caller: ModelCaller,
  input: { question: string; answer: string; evidence: string },
): Promise<JudgeVerdict | null> {
  try {
    const result = await caller({
      systemInstruction: judgePrompt(input),
      turns: [{ role: 'user', text: 'ให้คะแนน' }],
      toolNames: [],
      step: 0,
    })
    return parseJudgeVerdict(result?.text || '')
  } catch {
    return null
  }
}

export async function judgeWithGemini(input: {
  apiKey: string
  model: string
  question: string
  answer: string
  evidence: string
}): Promise<{ verdict: JudgeVerdict | null; promptTokens: number; completionTokens: number }> {
  const empty = { verdict: null, promptTokens: 0, completionTokens: 0 }
  if (!input.apiKey) return empty
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: judgePrompt(input) }] },
          contents: [{ role: 'user', parts: [{ text: 'ให้คะแนน' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      },
    )
    const raw = await response.text()
    if (!response.ok) return empty
    const data = JSON.parse(raw) as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('')
    return {
      verdict: parseJudgeVerdict(text),
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: (data.usageMetadata?.candidatesTokenCount || 0) + (data.usageMetadata?.thoughtsTokenCount || 0),
    }
  } catch {
    return empty
  }
}
