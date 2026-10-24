/**
 * Embeddings for shop knowledge.
 *
 * Gemini is the platform's preferred embedding provider. A shop that brought
 * its own Gemini or OpenAI key is billed on that key; Claude has no embedding
 * API, so those shops use the platform Gemini key when one is set. Vectors
 * are 768 dimensions so they match the pgvector column. Gemini's reduced
 * dimensions are not unit length, so they are L2-normalised before storage.
 *
 * Failure is an EmbeddingError. Callers that are saving an upload must catch
 * it and keep the text: keyword search still works without vectors.
 */

export const EMBEDDING_DIMENSIONS = 768
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
/** Used only when the primary model returns 404. Google retired this model on 2026-01-14; a second 404 marks the chunks failed and leaves keyword search. */
export const GEMINI_EMBEDDING_FALLBACK_MODEL = 'text-embedding-004'
export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBED_BATCH_SIZE = 64

export type EmbeddingProvider = 'gemini' | 'openai'
export type EmbedTask = 'document' | 'query'

export class EmbeddingError extends Error {
  retryable: boolean
  status: number | null
  constructor(message: string, options: { retryable: boolean; status?: number | null }) {
    super(message)
    this.name = 'EmbeddingError'
    this.retryable = options.retryable
    this.status = options.status ?? null
  }
}

export interface EmbeddingCredentials {
  provider: EmbeddingProvider
  apiKey: string
  model: string
  source: 'shop' | 'platform'
  /** Stored on each chunk so a later query uses the same vector space. */
  modelLabel: string
}

export function modelLabel(provider: EmbeddingProvider, model: string): string {
  return `${provider}:${model}`
}

/**
 * Which key creates NEW embeddings.
 * A shop's own Gemini or OpenAI key wins so a BYOK shop pays for its own index.
 * Otherwise the platform Gemini key is preferred over the platform OpenAI key.
 * Claude keys cannot embed.
 */
export function pickEmbeddingSource(input: {
  shopProvider: string | null
  shopKeyPresent: boolean
  platformGemini: boolean
  platformOpenai: boolean
}): { source: 'shop' | 'platform'; provider: EmbeddingProvider } | null {
  if (input.shopKeyPresent && input.shopProvider === 'gemini') return { source: 'shop', provider: 'gemini' }
  if (input.shopKeyPresent && input.shopProvider === 'openai') return { source: 'shop', provider: 'openai' }
  if (input.platformGemini) return { source: 'platform', provider: 'gemini' }
  if (input.platformOpenai) return { source: 'platform', provider: 'openai' }
  return null
}

/** A query must use the same provider that wrote the stored vectors. */
export function pickCredentialsForProvider(
  provider: EmbeddingProvider,
  input: {
    shopProvider: string | null
    shopKeyPresent: boolean
    platformGemini: boolean
    platformOpenai: boolean
  }
): { source: 'shop' | 'platform' } | null {
  if (provider === 'gemini') {
    if (input.shopKeyPresent && input.shopProvider === 'gemini') return { source: 'shop' }
    if (input.platformGemini) return { source: 'platform' }
    return null
  }
  if (input.shopKeyPresent && input.shopProvider === 'openai') return { source: 'shop' }
  if (input.platformOpenai) return { source: 'platform' }
  return null
}

export function l2Normalize(vector: number[]): number[] {
  let sum = 0
  for (const value of vector) sum += value * value
  const magnitude = Math.sqrt(sum)
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new EmbeddingError('embedding provider returned an empty vector', { retryable: false })
  }
  return vector.map((value) => value / magnitude)
}

export function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/key=[^&\s]+/gi, 'key=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer REDACTED')
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, 'REDACTED')
    .replace(/sk-[A-Za-z0-9]{10,}/g, 'REDACTED')
    .slice(0, 300)
}

export function embedInput(row: { sourceFile?: string | null; section?: string | null; content: string }): string {
  const parts: string[] = []
  if (row.sourceFile) parts.push(`ไฟล์: ${row.sourceFile}`)
  if (row.section) parts.push(`หัวข้อ: ${row.section}`)
  parts.push(row.content)
  return Array.from(parts.join('\n')).slice(0, 6000).join('')
}

export interface EmbeddableRow {
  content: string
  source_file: string | null
  section: string | null
  embedding: string | null
  embedding_model: string | null
  embedding_status: 'pending' | 'ready' | 'failed'
  embedding_error: string | null
}

const NO_KEY_MESSAGE = 'ไม่มีคีย์สำหรับสร้าง embedding — บันทึกเนื้อหาแล้วและค้นด้วยคำสำคัญได้'

/**
 * Attaches vectors to chunk rows. A missing key or a failed request does not
 * throw: the text is kept and marked pending or failed so the upload can finish.
 */
export async function attachEmbeddings<T extends EmbeddableRow>(
  rows: T[],
  embedder: ((texts: string[]) => Promise<{ vectors: number[][]; model: string }>) | null
): Promise<{ rows: T[]; embedded: number; failed: number; pending: number; warning: string | null }> {
  if (rows.length === 0) return { rows, embedded: 0, failed: 0, pending: 0, warning: null }
  if (!embedder) {
    const next = rows.map((row) => ({
      ...row,
      embedding: null,
      embedding_model: null,
      embedding_status: 'pending' as const,
      embedding_error: NO_KEY_MESSAGE,
    }))
    return { rows: next, embedded: 0, failed: 0, pending: next.length, warning: NO_KEY_MESSAGE }
  }

  const texts = rows.map((row) => embedInput({ sourceFile: row.source_file, section: row.section, content: row.content }))
  try {
    const result = await embedder(texts)
    let embedded = 0
    let failed = 0
    const next = rows.map((row, index) => {
      const vector = result.vectors[index]
      if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
        failed++
        return {
          ...row,
          embedding: null,
          embedding_model: null,
          embedding_status: 'failed' as const,
          embedding_error: 'embedding มีขนาดไม่ตรงกับคอลัมน์ (ต้องเป็น 768 มิติ)',
        }
      }
      embedded++
      return {
        ...row,
        embedding: `[${vector.join(',')}]`,
        embedding_model: result.model,
        embedding_status: 'ready' as const,
        embedding_error: null,
      }
    })
    const warning = failed > 0 ? `สร้าง embedding ไม่ครบ ${failed} ส่วน` : null
    return { rows: next, embedded, failed, pending: 0, warning }
  } catch (err) {
    const message = safeErrorMessage(err)
    const next = rows.map((row) => ({
      ...row,
      embedding: null,
      embedding_model: null,
      embedding_status: 'failed' as const,
      embedding_error: message,
    }))
    return { rows: next, embedded: 0, failed: next.length, pending: 0, warning: message }
  }
}

export type Embedder = (texts: string[], task: EmbedTask) => Promise<{ vectors: number[][]; model: string }>

export function createEmbedder(creds: EmbeddingCredentials, hooks?: EmbedHooks): Embedder {
  return (texts, task) =>
    embedTexts({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      texts,
      task,
      ...hooks,
    })
}

interface EmbedHooks {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  batchSize?: number
  maxAttempts?: number
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function embedTexts(options: {
  provider: EmbeddingProvider
  apiKey: string
  model?: string
  texts: string[]
  task: EmbedTask
} & EmbedHooks): Promise<{ vectors: number[][]; model: string }> {
  const texts = options.texts.map((text) => text.trim())
  if (texts.length === 0) {
    return { vectors: [], model: modelLabel(options.provider, options.model || defaultModel(options.provider)) }
  }
  if (texts.some((text) => text.length === 0)) {
    throw new EmbeddingError('refusing to embed an empty chunk', { retryable: false })
  }
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new EmbeddingError('missing embedding API key', { retryable: false })

  const fetchImpl = options.fetchImpl || fetch
  const sleep = options.sleep || defaultSleep
  const random = options.random || Math.random
  const batchSize = options.batchSize || EMBED_BATCH_SIZE
  const maxAttempts = options.maxAttempts || 3
  let model = options.model || defaultModel(options.provider)
  const vectors: number[][] = []

  for (let start = 0; start < texts.length; start += batchSize) {
    const slice = texts.slice(start, start + batchSize)
    const batch = await embedBatchWithRetry({
      provider: options.provider,
      apiKey,
      model,
      texts: slice,
      task: options.task,
      fetchImpl,
      sleep,
      random,
      maxAttempts,
    })
    model = batch.model
    vectors.push(...batch.vectors)
  }
  return { vectors, model: modelLabel(options.provider, model) }
}

function defaultModel(provider: EmbeddingProvider): string {
  if (provider === 'openai') return process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL
  return process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL
}

async function embedBatchWithRetry(options: {
  provider: EmbeddingProvider
  apiKey: string
  model: string
  texts: string[]
  task: EmbedTask
  fetchImpl: typeof fetch
  sleep: (ms: number) => Promise<void>
  random: () => number
  maxAttempts: number
}): Promise<{ vectors: number[][]; model: string }> {
  let model = options.model
  let lastError: EmbeddingError | null = null
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      const vectors = await embedBatchOnce({ ...options, model })
      return { vectors, model }
    } catch (err) {
      const wrapped = err instanceof EmbeddingError
        ? err
        : new EmbeddingError(safeErrorMessage(err), { retryable: true })
      lastError = wrapped
      const canTryFallback =
        options.provider === 'gemini' &&
        wrapped.status === 404 &&
        model !== GEMINI_EMBEDDING_FALLBACK_MODEL
      if (canTryFallback) {
        model = GEMINI_EMBEDDING_FALLBACK_MODEL
        continue
      }
      if (!wrapped.retryable || attempt === options.maxAttempts - 1) break
      const backoff = 400 * 2 ** attempt + Math.floor(options.random() * 150)
      await options.sleep(backoff)
    }
  }
  throw lastError || new EmbeddingError('embedding request failed', { retryable: false })
}

async function embedBatchOnce(options: {
  provider: EmbeddingProvider
  apiKey: string
  model: string
  texts: string[]
  task: EmbedTask
  fetchImpl: typeof fetch
}): Promise<number[][]> {
  if (options.provider === 'openai') return embedOpenAI(options)
  try {
    return await embedGeminiBatch(options)
  } catch (err) {
    // A 404 on the batch method can mean that method is missing while embedContent works.
    // Probe one text first: if the model itself is missing, don't fan out a request per chunk.
    if (!(err instanceof EmbeddingError) || err.status !== 404) throw err
  }
  const singles = [await embedGeminiOne({ ...options, text: options.texts[0] })]
  for (const text of options.texts.slice(1)) {
    singles.push(await embedGeminiOne({ ...options, text }))
  }
  return singles
}

async function embedGeminiBatch(options: {
  apiKey: string
  model: string
  texts: string[]
  task: EmbedTask
  fetchImpl: typeof fetch
}): Promise<number[][]> {
  const response = await options.fetchImpl(geminiUrl(options.model, 'batchEmbedContents', options.apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: options.texts.map((text) => geminiRequest(options.model, text, options.task)),
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await readJson(response)
  if (!response.ok) throw httpError('Gemini', response.status, payload)
  const rows = Array.isArray(payload.embeddings) ? payload.embeddings : []
  if (rows.length !== options.texts.length) {
    throw new EmbeddingError('Gemini returned a different number of embeddings than requested', { retryable: true, status: response.status })
  }
  return rows.map((row: { values?: number[] }) => normalizeProviderVector(row?.values))
}

async function embedGeminiOne(options: {
  apiKey: string
  model: string
  text: string
  task: EmbedTask
  fetchImpl: typeof fetch
}): Promise<number[]> {
  const response = await options.fetchImpl(geminiUrl(options.model, 'embedContent', options.apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiRequest(options.model, options.text, options.task)),
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await readJson(response)
  if (!response.ok) throw httpError('Gemini', response.status, payload)
  return normalizeProviderVector(payload.embedding?.values)
}

function geminiRequest(model: string, text: string, task: EmbedTask) {
  return {
    model: `models/${model}`,
    content: { parts: [{ text }] },
    taskType: task === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }
}

function geminiUrl(model: string, method: string, apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}?key=${encodeURIComponent(apiKey)}`
}

async function embedOpenAI(options: {
  apiKey: string
  model: string
  texts: string[]
  fetchImpl: typeof fetch
}): Promise<number[][]> {
  const response = await options.fetchImpl('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      input: options.texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await readJson(response)
  if (!response.ok) throw httpError('OpenAI', response.status, payload)
  const rows = Array.isArray(payload.data) ? [...payload.data] : []
  rows.sort((a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0))
  if (rows.length !== options.texts.length) {
    throw new EmbeddingError('OpenAI returned a different number of embeddings than requested', { retryable: true, status: response.status })
  }
  return rows.map((row: { embedding?: number[] }) => normalizeProviderVector(row?.embedding))
}

function normalizeProviderVector(values: unknown): number[] {
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError('embedding provider returned a vector that is not 768 dimensions', { retryable: false })
  }
  return l2Normalize(values.map((value) => Number(value)))
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 500) }
  }
}

function httpError(provider: string, status: number, payload: any): EmbeddingError {
  const detail = typeof payload?.error?.message === 'string'
    ? payload.error.message
    : typeof payload?.raw === 'string'
      ? payload.raw
      : ''
  const retryable = status === 408 || status === 429 || status >= 500
  return new EmbeddingError(safeErrorMessage(`${provider} embeddings HTTP ${status} ${detail}`), { retryable, status })
}
