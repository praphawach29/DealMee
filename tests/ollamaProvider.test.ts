import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOllamaCaller, ollamaConfigFromEnv } from '../src/lib/ai/providers/ollama.ts'
import { createLiveCaller, providerFromEnv } from './eval/providers.ts'

const config = ollamaConfigFromEnv({})
const tools = [{ name: 'check_stock', description: 'Check this shop stock', parameters: { type: 'object', properties: { product_id: { type: 'string' } }, required: ['product_id'] } }]
const step = { systemInstruction: 'Shop A only', turns: [{ role: 'user' as const, text: 'มีของไหม' }], toolNames: ['check_stock'], step: 0 }

function response(message: unknown, extra: Record<string, unknown> = {}) {
  return Response.json({ done: true, message: { role: 'assistant', ...message as object }, ...extra })
}

function mockedFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch {
  return (async (url, init) => handler(String(url), init || {})) as typeof fetch
}

test('Ollama defaults to loopback with bounded inference settings', () => {
  assert.equal(config.baseUrl, 'http://127.0.0.1:11434')
  assert.equal(config.timeoutMs, 60_000)
  assert.equal(config.contextTokens, 4096)
  assert.equal(ollamaConfigFromEnv({ OLLAMA_MODEL: 'installed:4b' }).model, 'installed:4b')
})

test('Ollama output budget is configurable, bounded and sent to inference', async () => {
  for (const value of ['0', '63', '4097', 'NaN', '64.5']) {
    assert.throws(() => ollamaConfigFromEnv({ OLLAMA_OUTPUT_TOKENS: value }))
  }
  const bounded = ollamaConfigFromEnv({ OLLAMA_OUTPUT_TOKENS: '256' })
  const caller = createOllamaCaller({ config: bounded, tools, fetchImpl: mockedFetch((_url, init) => {
    assert.equal(JSON.parse(String(init.body)).options.num_predict, 256)
    return response({ content: 'สวัสดีค่ะ' })
  }) })
  await caller(step)
})

test('Ollama rejects unsafe destinations, cloud models and invalid limits', () => {
  for (const baseUrl of ['file:///tmp', 'http://vps.example', 'https://user:secret@vps.example', 'https://vps.example/api', 'https://vps.example?key=secret', 'https://ollama.com', 'https://api.ollama.com']) {
    assert.throws(() => ollamaConfigFromEnv({ OLLAMA_BASE_URL: baseUrl }))
  }
  for (const model of ['model:cloud', 'model-cloud', 'cloud/model:cloud']) {
    assert.throws(() => ollamaConfigFromEnv({ OLLAMA_MODEL: model }))
  }
  for (const timeout of ['NaN', '0', '999999', '1000.5']) {
    assert.throws(() => ollamaConfigFromEnv({ OLLAMA_TIMEOUT_MS: timeout }))
  }
  assert.throws(() => ollamaConfigFromEnv({ OLLAMA_CONTEXT_TOKENS: '0' }))
  assert.equal(ollamaConfigFromEnv({ OLLAMA_BASE_URL: 'https://private-vps.example' }).baseUrl, 'https://private-vps.example')
})

test('Ollama serializes tools, matches tool results and accumulates token usage', async () => {
  const requests: Record<string, any>[] = []
  const usage = { promptTokens: 0, completionTokens: 0 }
  const caller = createOllamaCaller({
    config,
    tools,
    onUsage: (counts) => {
      usage.promptTokens += counts.promptTokens
      usage.completionTokens += counts.completionTokens
    },
    fetchImpl: mockedFetch((url, init) => {
      assert.equal(url, 'http://127.0.0.1:11434/api/chat')
      assert.equal(init.redirect, 'error')
      assert.equal(new Headers(init.headers).has('Authorization'), false)
      assert.ok(init.signal)
      const body = JSON.parse(String(init.body))
      requests.push(body)
      return requests.length === 1
        ? response({ content: '', tool_calls: [{ function: { name: 'check_stock', arguments: { product_id: 'A-1' } } }] }, { prompt_eval_count: 30, eval_count: 12 })
        : response({ content: 'มีสินค้า 3 ชิ้นค่ะ' }, { prompt_eval_count: 50, eval_count: 15 })
    }),
  })
  const first = await caller(step)
  assert.deepEqual(first?.toolCall?.args, { product_id: 'A-1' })
  await caller({ ...step, step: 1, toolNames: [], turns: [...step.turns, { role: 'assistant', toolCall: first!.toolCall }, { role: 'tool_result', toolName: 'check_stock', result: '{"stock":3}' }] })
  assert.equal(requests[0].stream, false)
  assert.equal(requests[0].think, false)
  assert.equal(requests[0].options.num_ctx, 4096)
  assert.equal(requests[0].tools[0].function.parameters.required[0], 'product_id')
  assert.equal(requests[1].tools, undefined)
  assert.deepEqual(requests[1].messages.at(-1), { role: 'tool', tool_name: 'check_stock', content: '{"stock":3}' })
  assert.deepEqual(usage, { promptTokens: 80, completionTokens: 27 })
})

test('Ollama keeps conversation context per request, not on the shared caller', async () => {
  const prompts: string[] = []
  const caller = createOllamaCaller({ config, tools, fetchImpl: mockedFetch((_url, init) => {
    prompts.push(String(init.body))
    return response({ content: 'สวัสดีค่ะ' })
  }) })
  await caller({ ...step, systemInstruction: 'Only shop-A-secret' })
  await caller({ ...step, systemInstruction: 'Only shop-B-secret' })
  assert.ok(!prompts[1].includes('shop-A-secret'))
  assert.ok(!prompts[0].includes('shop-B-secret'))
})

test('Ollama rejects multiple, forbidden and malformed tool calls before execution', async () => {
  const invalid = [
    [{ function: { name: 'check_stock', arguments: {} } }, { function: { name: 'check_stock', arguments: {} } }],
    [{ function: { name: 'take_order', arguments: {} } }],
    [{ function: { name: 'check_stock', arguments: 'not json object' } }],
    [{ function: { name: 'check_stock', arguments: [] } }],
    [{ function: { name: 'check_stock', arguments: null } }],
    [{}],
  ]
  for (const tool_calls of invalid) {
    const caller = createOllamaCaller({ config, tools, fetchImpl: mockedFetch(() => response({ content: '', tool_calls })) })
    await assert.rejects(caller(step))
  }
})

test('Ollama rejects invalid JSON, incomplete, empty and error responses without leaking bodies', async () => {
  for (const result of [new Response('private malformed body'), response({ content: '' }), response({ content: 'partial' }, { done: false }), response({ content: 'ok' }, { error: 'private server error' }), new Response('private error', { status: 500 })]) {
    const caller = createOllamaCaller({ config, tools, fetchImpl: mockedFetch(() => result) })
    await assert.rejects(caller(step), (error: Error) => !error.message.includes('private'))
  }
})

test('Ollama propagates timeout and network failure with exactly one request', async () => {
  for (const failure of [new DOMException('Timed out', 'TimeoutError'), new TypeError('network failed')]) {
    let requests = 0
    const caller = createOllamaCaller({ config, tools, fetchImpl: mockedFetch(() => {
      requests++
      throw failure
    }) })
    await assert.rejects(caller(step), (error) => error === failure)
    assert.equal(requests, 1)
  }
})

test('Ollama marks truncated text and rejects truncated tool calls', async () => {
  const textCaller = createOllamaCaller({ config, tools, fetchImpl: mockedFetch(() => response({ content: 'partial' }, { done_reason: 'length' })) })
  assert.equal((await textCaller(step))?.truncated, true)
  const toolCaller = createOllamaCaller({ config, tools, fetchImpl: mockedFetch(() => response({ tool_calls: [{ function: { name: 'check_stock', arguments: {} } }] }, { done_reason: 'length' })) })
  await assert.rejects(toolCaller(step), /truncated/)
})

test('eval Ollama route works with no cloud key and never falls through to cloud', async () => {
  const originalEnv = process.env
  const originalFetch = globalThis.fetch
  let requests = 0
  try {
    process.env = { EVAL_PROVIDER: 'ollama', EVAL_MODEL: 'local:4b' }
    assert.deepEqual(providerFromEnv(), { provider: 'ollama', model: 'local:4b', apiKey: '' })
    globalThis.fetch = mockedFetch((url) => {
      requests++
      assert.equal(url, 'http://127.0.0.1:11434/api/chat')
      return new Response('unavailable', { status: 503 })
    })
    const caller = createLiveCaller({ provider: 'ollama', model: 'local:4b', apiKey: '', tools, usage: { promptTokens: 0, completionTokens: 0 } })
    await assert.rejects(caller(step), /503/)
    assert.equal(requests, 1)
  } finally {
    process.env = originalEnv
    globalThis.fetch = originalFetch
  }
})
