import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EMBEDDING_DIMENSIONS,
  attachEmbeddings,
  embedTexts,
  l2Normalize,
  pickCredentialsForProvider,
  pickEmbeddingSource,
  safeErrorMessage,
  type EmbeddableRow,
} from '../src/lib/knowledge/embed.ts'

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? seed : 0.001))
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response
}

function geminiOk(count: number) {
  return jsonResponse(200, { embeddings: Array.from({ length: count }, (_, index) => ({ values: vector(index + 1) })) })
}

const row = (content: string): EmbeddableRow => ({
  content,
  source_file: 'prices.md',
  section: 'เสื้อยืด',
  embedding: null,
  embedding_model: null,
  embedding_status: 'pending',
  embedding_error: null,
})

test('Gemini embeddings retry and then normalise to 768 dimensions', async () => {
  let calls = 0
  let sleeps = 0
  const result = await embedTexts({
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-embedding-001',
    texts: ['เสื้อยืด SKU-8891'],
    task: 'document',
    maxAttempts: 3,
    sleep: async () => { sleeps++ },
    random: () => 0,
    fetchImpl: async () => {
      calls++
      if (calls < 3) return jsonResponse(500, { error: { message: 'busy' } })
      return geminiOk(1)
    },
  })
  assert.equal(calls, 3)
  assert.equal(sleeps, 2)
  assert.equal(result.vectors[0].length, 768)
  assert.equal(result.model, 'gemini:gemini-embedding-001')
  const magnitude = Math.sqrt(result.vectors[0].reduce((sum, value) => sum + value * value, 0))
  assert.ok(Math.abs(magnitude - 1) < 1e-6)
  const unit = l2Normalize([3, 4])
  assert.ok(Math.abs(unit[0] - 0.6) < 1e-9)
  assert.ok(Math.abs(unit[1] - 0.8) < 1e-9)
})

test('a rejected embedding request is not retried, and a missing Gemini model falls back once', async () => {
  let rejected = 0
  await assert.rejects(
    () => embedTexts({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-embedding-001',
      texts: ['ราคา'],
      task: 'query',
      sleep: async () => { throw new Error('should not sleep') },
      fetchImpl: async () => {
        rejected++
        return jsonResponse(400, { error: { message: 'bad request key=super-secret' } })
      },
    }),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      assert.equal(rejected, 1)
      assert.match(message, /HTTP 400/)
      assert.equal(message.includes('super-secret'), false)
      return true
    }
  )

  const urls: string[] = []
  const fallback = await embedTexts({
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-embedding-001',
    texts: ['ราคา'],
    task: 'document',
    sleep: async () => {},
    fetchImpl: async (url) => {
      urls.push(String(url))
      if (String(url).includes('text-embedding-004')) return geminiOk(1)
      return jsonResponse(404, { error: { message: 'model not found' } })
    },
  })
  assert.equal(fallback.model, 'gemini:text-embedding-004')
  assert.equal(urls.filter((url) => url.includes('text-embedding-004')).length, 1)
})

test('OpenAI embeddings keep input order', async () => {
  const result = await embedTexts({
    provider: 'openai',
    apiKey: 'sk-test',
    model: 'text-embedding-3-small',
    texts: ['หนึ่ง', 'สอง'],
    task: 'document',
    fetchImpl: async () => jsonResponse(200, {
      data: [
        { index: 1, embedding: vector(5) },
        { index: 0, embedding: vector(1) },
      ],
    }),
  })
  assert.equal(result.model, 'openai:text-embedding-3-small')
  assert.ok(result.vectors[0][0] < result.vectors[1][0])
})

test('a failed embedder does not throw and does not drop the chunk text', async () => {
  const failed = await attachEmbeddings([row('รหัส SKU-8891')], async () => {
    throw new Error('upstream failed key=super-secret')
  })
  assert.equal(failed.rows[0].embedding_status, 'failed')
  assert.equal(failed.rows[0].embedding, null)
  assert.equal(failed.rows[0].content, 'รหัส SKU-8891')
  assert.match(failed.warning || '', /upstream failed/)
  assert.equal((failed.warning || '').includes('super-secret'), false)

  const pending = await attachEmbeddings([row('ราคา 290')], null)
  assert.equal(pending.rows[0].embedding_status, 'pending')
  assert.equal(pending.rows[0].content, 'ราคา 290')
  assert.match(pending.warning || '', /ค้นด้วยคำสำคัญ/)
  assert.equal(safeErrorMessage('Bearer sk-abcdefghij1234567890'), 'Bearer REDACTED')
})

test('shop keys are used when they can embed, otherwise the platform Gemini key', () => {
  assert.deepEqual(
    pickEmbeddingSource({ shopProvider: 'gemini', shopKeyPresent: true, platformGemini: true, platformOpenai: true }),
    { source: 'shop', provider: 'gemini' }
  )
  assert.deepEqual(
    pickEmbeddingSource({ shopProvider: 'openai', shopKeyPresent: true, platformGemini: true, platformOpenai: false }),
    { source: 'shop', provider: 'openai' }
  )
  assert.deepEqual(
    pickEmbeddingSource({ shopProvider: 'claude', shopKeyPresent: true, platformGemini: true, platformOpenai: true }),
    { source: 'platform', provider: 'gemini' }
  )
  assert.deepEqual(
    pickEmbeddingSource({ shopProvider: 'claude', shopKeyPresent: true, platformGemini: false, platformOpenai: true }),
    { source: 'platform', provider: 'openai' }
  )
  assert.equal(
    pickEmbeddingSource({ shopProvider: null, shopKeyPresent: false, platformGemini: false, platformOpenai: false }),
    null
  )
  assert.deepEqual(
    pickCredentialsForProvider('gemini', { shopProvider: 'openai', shopKeyPresent: true, platformGemini: true, platformOpenai: true }),
    { source: 'platform' }
  )
  assert.equal(
    pickCredentialsForProvider('gemini', { shopProvider: 'openai', shopKeyPresent: true, platformGemini: false, platformOpenai: true }),
    null
  )
})
