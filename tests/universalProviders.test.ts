import test from 'node:test'
import assert from 'node:assert/strict'
import {
  packShopAiKeySecret,
  unpackShopAiKeySecret,
  SHOP_AI_PROVIDERS,
} from '../src/lib/billing/shopAiKey.ts'
import {
  callOpenAiCompatibleApi,
  buildOpenAiMessages,
} from '../src/lib/ai/salesAgentEngine.ts'
import { testProviderAiKey } from '../src/lib/platformSecrets.ts'
import { notifyByokKeyFailure } from '../src/lib/billing/ownerAlerts.ts'

test('Universal Providers: SHOP_AI_PROVIDERS includes groq, deepseek, openrouter, ollama, custom_openai', () => {
  assert.ok(SHOP_AI_PROVIDERS.includes('groq'))
  assert.ok(SHOP_AI_PROVIDERS.includes('deepseek'))
  assert.ok(SHOP_AI_PROVIDERS.includes('openrouter'))
  assert.ok(SHOP_AI_PROVIDERS.includes('ollama'))
  assert.ok(SHOP_AI_PROVIDERS.includes('custom_openai'))
  assert.ok(SHOP_AI_PROVIDERS.includes('gemini'))
  assert.ok(SHOP_AI_PROVIDERS.includes('openai'))
  assert.ok(SHOP_AI_PROVIDERS.includes('claude'))
})

test('Universal Providers: packShopAiKeySecret and unpackShopAiKeySecret preserve options', () => {
  const packed = packShopAiKeySecret('groq', 'gsk_test123456789', {
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
  })

  const unpacked = unpackShopAiKeySecret('openai', packed)
  assert.equal(unpacked.provider, 'groq')
  assert.equal(unpacked.key, 'gsk_test123456789')
  assert.equal(unpacked.model, 'llama-3.3-70b-versatile')
  assert.equal(unpacked.baseUrl, 'https://api.groq.com/openai/v1')
})

test('Universal Providers: unpackShopAiKeySecret handles legacy plain strings gracefully', () => {
  const plain = 'sk-plain-legacy-key-12345'
  const unpacked = unpackShopAiKeySecret('gemini', plain)
  assert.equal(unpacked.provider, 'gemini')
  assert.equal(unpacked.key, plain)
  assert.equal(unpacked.model, undefined)
  assert.equal(unpacked.baseUrl, undefined)
})

test('Universal Providers: buildOpenAiMessages formats user, assistant, and tool turns correctly', () => {
  const turns = [
    { role: 'user' as const, text: 'เช็คสต็อกสินค้า A' },
    {
      role: 'assistant' as const,
      text: '',
      toolCall: {
        id: 'call_123',
        name: 'check_stock' as any,
        args: { product_id: 'prod_1' },
      },
    },
    {
      role: 'tool_result' as const,
      toolName: 'check_stock',
      toolCallId: 'call_123',
      result: '{"in_stock": true, "quantity": 10}',
    },
  ]

  const messages = buildOpenAiMessages('You are sales AI', turns)
  assert.equal(messages[0].role, 'system')
  assert.equal(messages[0].content, 'You are sales AI')
  assert.equal(messages[1].role, 'user')
  assert.equal(messages[1].content, 'เช็คสต็อกสินค้า A')
  assert.equal(messages[2].role, 'assistant')
  assert.equal(messages[2].tool_calls?.[0]?.id, 'call_123')
  assert.equal(messages[2].tool_calls?.[0]?.function?.name, 'check_stock')
  assert.equal(messages[3].role, 'tool')
  assert.equal(messages[3].tool_call_id, 'call_123')
  assert.equal(messages[3].content, '{"in_stock": true, "quantity": 10}')
})

test('Universal Providers: callOpenAiCompatibleApi executes successfully with mocked fetch', async () => {
  const originalFetch = globalThis.fetch
  try {
    let calledUrl = ''
    let calledHeaders: Record<string, string> = {}
    let calledBody: any = null

    globalThis.fetch = (async (url: any, init: any) => {
      calledUrl = String(url)
      calledHeaders = init.headers
      calledBody = JSON.parse(init.body)

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'สินค้ามีพร้อมส่งค่ะ',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23,
          },
        }),
      } as any
    }) as any

    const result = await callOpenAiCompatibleApi({
      providerName: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: 'gsk_mock_test_key',
      candidateModels: ['llama-3.3-70b-versatile'],
      systemInstruction: 'Test instructions',
      turns: [{ role: 'user', text: 'มีของไหม' }],
      toolSet: [],
    })

    assert.ok(result)
    assert.equal(result.text, 'สินค้ามีพร้อมส่งค่ะ')
    assert.equal(result.toolCall, undefined)
    assert.equal(calledUrl, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(calledHeaders['Authorization'], 'Bearer gsk_mock_test_key')
    assert.equal(calledBody.model, 'llama-3.3-70b-versatile')
    assert.equal(result.usage?.promptTokens, 15)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Universal Providers: callOpenAiCompatibleApi parses tool calls properly', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '',
                tool_calls: [
                  {
                    id: 'tc_999',
                    type: 'function',
                    function: {
                      name: 'check_stock',
                      arguments: '{"product_id":"p123"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }),
      } as any
    }) as any

    const result = await callOpenAiCompatibleApi({
      providerName: 'deepseek',
      baseUrl: 'https://api.deepseek.com/chat/completions',
      apiKey: 'sk_mock_deepseek_key',
      candidateModels: ['deepseek-chat'],
      systemInstruction: 'Test instructions',
      turns: [{ role: 'user', text: 'ขอเช็คสต็อก p123' }],
      toolSet: [{ name: 'check_stock', description: 'test', parameters: { type: 'object', properties: {} } }] as any,
    })

    assert.ok(result)
    assert.equal(result.text, '')
    assert.ok(result.toolCall)
    assert.equal(result.toolCall.name, 'check_stock')
    assert.deepEqual(result.toolCall.args, { product_id: 'p123' })
    assert.equal(result.toolCall.id, 'tc_999')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Universal Providers: testProviderAiKey validates responses and error codes', async () => {
  const originalFetch = globalThis.fetch
  try {
    // 1. Success 200
    globalThis.fetch = (async () => ({ ok: true, status: 200 })) as any
    const resSuccess = await testProviderAiKey('groq', 'gsk_valid_key')
    assert.equal(resSuccess.ok, true)
    assert.equal(resSuccess.message, 'key ใช้งานได้')

    // 2. 401 Unauthorized
    globalThis.fetch = (async () => ({ ok: false, status: 401 })) as any
    const resAuth = await testProviderAiKey('deepseek', 'sk_invalid_key')
    assert.equal(resAuth.ok, false)
    assert.ok(resAuth.message.includes('401'))

    // 3. 429 Rate limited / Out of quota
    globalThis.fetch = (async () => ({ ok: false, status: 429 })) as any
    const resQuota = await testProviderAiKey('openrouter', 'sk-or-rate-limited')
    assert.equal(resQuota.ok, true)
    assert.ok(resQuota.message.includes('429'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Universal Providers: notifyByokKeyFailure sends alert and respects 2-hour throttling', async () => {
  const originalFetch = globalThis.fetch
  try {
    let pushCalls = 0
    let pushedBody: any = null

    globalThis.fetch = (async (_url: any, init: any) => {
      pushCalls++
      pushedBody = JSON.parse(init.body)
      return { ok: true } as any
    }) as any

    const fakeShop = {
      id: 'shop_test_123',
      line_token: 'fake_line_token',
      owner_line_id: 'U1234567890',
      features: {},
    }

    await notifyByokKeyFailure(fakeShop, 'groq', 'โควตาข้อความหมด')
    assert.equal(pushCalls, 1)
    assert.ok(pushedBody.messages[0].text.includes('GROQ'))
    assert.ok(pushedBody.messages[0].text.includes('โควตาข้อความหมด'))

    // Second call within 2 hours must be throttled
    await notifyByokKeyFailure(fakeShop, 'groq', 'โควตาข้อความหมดรอบสอง')
    assert.equal(pushCalls, 1) // should not increase
  } finally {
    globalThis.fetch = originalFetch
  }
})
