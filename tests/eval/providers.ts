import type { AgentToolName, ModelCaller, PlanningTurn } from '../../src/lib/ai/salesAgentEngine.ts'

export type EvalProviderName = 'gemini' | 'openrouter'

export interface ToolDeclaration {
  name: string
  description: string
  parameters?: { type?: string; properties?: Record<string, unknown>; required?: string[] }
}

export interface ProviderUsage {
  promptTokens: number
  completionTokens: number
}

const DEFAULT_MODELS: Record<EvalProviderName, string> = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
}

export function providerFromEnv(): { provider: EvalProviderName; model: string; apiKey: string } {
  const raw = (process.env.EVAL_PROVIDER || 'gemini').toLowerCase()
  if (raw !== 'gemini' && raw !== 'openrouter') {
    throw new Error(`EVAL_PROVIDER must be gemini or openrouter, got ${raw}`)
  }
  const provider = raw
  const model = process.env.EVAL_MODEL?.trim() || DEFAULT_MODELS[provider]
  const apiKey = provider === 'gemini'
    ? (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '').trim()
    : (process.env.OPENROUTER_API_KEY || '').trim()
  return { provider, model, apiKey }
}

function geminiDeclarations(tools: ToolDeclaration[]) {
  return [{
    functionDeclarations: tools.map((tool) => {
      const hasProperties = Object.keys(tool.parameters?.properties || {}).length > 0
      return {
        name: tool.name,
        description: tool.description,
        ...(hasProperties ? { parameters: tool.parameters } : {}),
      }
    }),
  }]
}

function geminiContents(turns: PlanningTurn[]) {
  const contents: unknown[] = []
  for (const turn of turns) {
    if (turn.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: turn.text }] })
    } else if (turn.role === 'assistant') {
      const parts: unknown[] = []
      if (turn.text) parts.push({ text: turn.text })
      if (turn.toolCall) parts.push({ functionCall: { name: turn.toolCall.name, args: turn.toolCall.args || {} } })
      if (parts.length > 0) contents.push({ role: 'model', parts })
    } else {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: turn.toolName, response: { result: turn.result } } }],
      })
    }
  }
  return contents
}

function openRouterMessages(systemInstruction: string, turns: PlanningTurn[]) {
  const messages: unknown[] = [{ role: 'system', content: systemInstruction }]
  for (const turn of turns) {
    if (turn.role === 'user') messages.push({ role: 'user', content: turn.text })
    else if (turn.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: turn.text || null,
        ...(turn.toolCall
          ? {
              tool_calls: [{
                id: turn.toolCall.id || `call-${turn.toolCall.name}`,
                type: 'function',
                function: { name: turn.toolCall.name, arguments: JSON.stringify(turn.toolCall.args || {}) },
              }],
            }
          : {}),
      })
    } else {
      messages.push({
        role: 'tool',
        tool_call_id: turn.toolCallId || `call-${turn.toolName}`,
        content: turn.result,
      })
    }
  }
  return messages
}

function openRouterTools(tools: ToolDeclaration[]) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters?.properties
        ? tool.parameters
        : { type: 'object', properties: {} },
    },
  }))
}

async function readBody(response: Response): Promise<string> {
  const text = await response.text()
  if (!response.ok) throw new Error(`model HTTP ${response.status}: ${text.slice(0, 400)}`)
  return text
}

export function createLiveCaller(input: {
  provider: EvalProviderName
  model: string
  apiKey: string
  tools: ToolDeclaration[]
  usage: ProviderUsage
}): ModelCaller {
  return async (step) => {
    const selected = input.tools.filter((tool) => step.toolNames.includes(tool.name))
    if (input.provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(25_000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: step.systemInstruction }] },
            contents: geminiContents(step.turns),
            ...(selected.length > 0 ? { tools: geminiDeclarations(selected) } : {}),
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
              thinkingConfig: { thinkingLevel: 'low' },
            },
          }),
        },
      )
      const data = JSON.parse(await readBody(response))
      const usage = data.usageMetadata || {}
      input.usage.promptTokens += usage.promptTokenCount || 0
      input.usage.completionTokens += (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)
      const parts: Array<{ text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }> = data.candidates?.[0]?.content?.parts || []
      let text = ''
      let toolCall: { name: AgentToolName; args: Record<string, unknown>; id: string } | undefined
      for (const part of parts) {
        if (part.text) text += part.text
        if (part.functionCall?.name && !toolCall) {
          toolCall = {
            name: part.functionCall.name as AgentToolName,
            args: part.functionCall.args || {},
            id: `live-${step.step}`,
          }
        }
      }
      if (!text && !toolCall) throw new Error('Gemini returned an empty candidate')
      return {
        text: text.trim(),
        toolCall,
        usage: {
          promptTokens: usage.promptTokenCount || 0,
          completionTokens: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0),
          totalTokens: usage.totalTokenCount || 0,
          provider: 'gemini',
        },
      }
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0.2,
        messages: openRouterMessages(step.systemInstruction, step.turns),
        ...(selected.length > 0 ? { tools: openRouterTools(selected) } : {}),
      }),
    })
    const data = JSON.parse(await readBody(response))
    const usage = data.usage || {}
    input.usage.promptTokens += usage.prompt_tokens || 0
    input.usage.completionTokens += usage.completion_tokens || 0
    const message = data.choices?.[0]?.message || {}
    const call = message.tool_calls?.[0] as { id?: string; function?: { name?: string; arguments?: string } } | undefined
    let args: Record<string, unknown> = {}
    if (call?.function?.arguments) {
      try {
        args = JSON.parse(call.function.arguments)
      } catch {
        args = {}
      }
    }
    const text = typeof message.content === 'string' ? message.content : ''
    if (!text && !call) throw new Error('OpenRouter returned an empty choice')
    return {
      text: text.trim(),
      toolCall: call?.function?.name
        ? { name: call.function.name as AgentToolName, args, id: call.id || `live-${step.step}` }
        : undefined,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        provider: 'openai',
      },
    }
  }
}

export async function judgeReply(input: {
  provider: EvalProviderName
  model: string
  apiKey: string
  question: string
  answer: string
  evidence: string
}): Promise<{ pass: boolean; reason: string } | null> {
  const prompt = [
    'คุณเป็นผู้ตรวจคำตอบบอทขาย ตรวจว่าคำตอบใช้เฉพาะข้อมูลร้าน ไม่แต่งราคา สต็อก ค่าส่ง โปรโมชั่น หรือนโยบาย',
    'ตอบเป็น JSON เท่านั้น: {"pass": true, "reason": "สั้นๆ"}',
    `คำถาม: ${input.question}`,
    `คำตอบ: ${input.answer}`,
    `ข้อมูลร้าน: ${input.evidence.slice(0, 4000)}`,
  ].join('\n')
  try {
    const caller = createLiveCaller({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      tools: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    })
    const result = await caller({ systemInstruction: prompt, turns: [{ role: 'user', text: 'ให้คะแนน' }], toolNames: [], step: 0 })
    const match = (result?.text || '').match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as { pass?: boolean; reason?: string }
    if (typeof parsed.pass !== 'boolean') return null
    return { pass: parsed.pass, reason: String(parsed.reason || '') }
  } catch {
    return null
  }
}
