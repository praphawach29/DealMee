import type { AgentToolName, ModelCaller, PlanningTurn } from '../salesAgentEngine'

export interface OllamaTool {
  name: string
  description: string
  parameters?: { type?: string; properties?: Record<string, unknown>; required?: string[] }
}

export interface OllamaConfig {
  baseUrl: string
  model: string
  timeoutMs: number
  contextTokens: number
  outputTokens?: number
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Ollama configuration must be an integer between ${min} and ${max}`)
  }
  return parsed
}

export function ollamaConfigFromEnv(env: Record<string, string | undefined> = process.env): OllamaConfig {
  const baseUrl = new URL(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434')
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || baseUrl.pathname !== '/') {
    throw new Error('OLLAMA_BASE_URL must be an HTTP(S) origin without credentials, path or query')
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)
  if (!loopback && baseUrl.protocol !== 'https:') {
    throw new Error('Remote Ollama requires HTTPS; use a secure tunnel for a private HTTP server')
  }
  if (baseUrl.hostname === 'ollama.com' || baseUrl.hostname.endsWith('.ollama.com')) {
    throw new Error('The local evaluator does not accept the Ollama cloud endpoint')
  }
  const model = (env.EVAL_MODEL || env.OLLAMA_MODEL || 'qwen3:4b').trim()
  if (!model || /(?:[:/-]cloud)(?:$|[:/-])/i.test(model)) {
    throw new Error('Choose a locally installed model, not an Ollama cloud model')
  }
  return {
    baseUrl: baseUrl.origin,
    model,
    timeoutMs: boundedInteger(env.OLLAMA_TIMEOUT_MS, 60_000, 1_000, 120_000),
    contextTokens: boundedInteger(env.OLLAMA_CONTEXT_TOKENS, 4096, 1024, 32768),
    outputTokens: boundedInteger(env.OLLAMA_OUTPUT_TOKENS, 1024, 64, 4096),
  }
}

function messagesForOllama(systemInstruction: string, turns: PlanningTurn[]) {
  return [
    { role: 'system', content: systemInstruction },
    ...turns.map((turn) => {
      if (turn.role === 'user') return { role: 'user', content: turn.text }
      if (turn.role === 'tool_result') return { role: 'tool', tool_name: turn.toolName, content: turn.result }
      return {
        role: 'assistant',
        content: turn.text || '',
        ...(turn.toolCall ? {
          tool_calls: [{ function: { name: turn.toolCall.name, arguments: turn.toolCall.args } }],
        } : {}),
      }
    }),
  ]
}

function tokenCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function createOllamaCaller(input: {
  config: OllamaConfig
  tools: OllamaTool[]
  onUsage?: (usage: { promptTokens: number; completionTokens: number }) => void
  fetchImpl?: typeof fetch
}): ModelCaller {
  const config = ollamaConfigFromEnv({
    OLLAMA_BASE_URL: input.config.baseUrl,
    OLLAMA_MODEL: input.config.model,
    OLLAMA_TIMEOUT_MS: String(input.config.timeoutMs),
    OLLAMA_CONTEXT_TOKENS: String(input.config.contextTokens),
    OLLAMA_OUTPUT_TOKENS: input.config.outputTokens === undefined ? undefined : String(input.config.outputTokens),
  })
  const request = input.fetchImpl || fetch
  return async (step) => {
    const tools = input.tools.filter((tool) => step.toolNames.includes(tool.name))
    const response = await request(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think: false,
        messages: messagesForOllama(step.systemInstruction, step.turns),
        ...(tools.length ? {
          tools: tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters || { type: 'object', properties: {} },
            },
          })),
        } : {}),
        options: { temperature: 0.2, num_ctx: config.contextTokens, num_predict: config.outputTokens },
      }),
    })
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}; no cloud fallback was attempted`)
    let data
    try {
      data = await response.json()
    } catch {
      throw new Error('Ollama returned invalid JSON')
    }
    if (!data || data.error || data.done !== true || data.message?.role !== 'assistant') {
      throw new Error('Ollama returned an incomplete or invalid response')
    }
    input.onUsage?.({ promptTokens: tokenCount(data.prompt_eval_count), completionTokens: tokenCount(data.eval_count) })
    const calls = data.message.tool_calls ?? []
    if (!Array.isArray(calls) || calls.length > 1) {
      throw new Error('Ollama must return at most one tool call per step; no tools were executed')
    }
    const text = typeof data.message.content === 'string' ? data.message.content.trim() : ''
    if (data.done_reason === 'length' && calls.length) {
      throw new Error('Ollama truncated a tool call; no tools were executed')
    }
    const call = calls[0]?.function
    if (calls.length) {
      if (!call || !tools.some((tool) => tool.name === call.name)) {
        throw new Error('Ollama requested a tool not offered for this step')
      }
      if (!call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments)) {
        throw new Error('Ollama tool arguments must be a JSON object')
      }
      return {
        text,
        toolCall: { name: call.name as AgentToolName, args: call.arguments, id: `ollama-${step.step}` },
      }
    }
    if (!text) throw new Error('Ollama returned an empty answer')
    return { text, truncated: data.done_reason === 'length' }
  }
}
