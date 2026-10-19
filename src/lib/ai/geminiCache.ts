import { createHash } from 'crypto'

/**
 * Explicit Gemini context caching for the per-shop part of the system prompt
 * (sales rules, catalog, booking setup) plus the tool declarations. That block
 * is identical for every message a shop receives and is resent on every
 * planning step; cached input bills at a tenth of the normal rate. Implicit
 * caching never hit in production ("cached 0" on every call), hence the
 * explicit cache.
 *
 * Everything here is best effort: any failure returns null and the caller
 * sends the request uncached, exactly as before.
 *
 * GEMINI_PROMPT_CACHE=off disables it; GEMINI_PROMPT_CACHE_TTL_SECONDS sets
 * how long an idle cache lives (storage is billed per hour, so keep it short).
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const TTL_SECONDS = Math.max(60, Number(process.env.GEMINI_PROMPT_CACHE_TTL_SECONDS) || 900)
// Don't hand out a cache that may expire mid-request
const REUSE_MARGIN_MS = 60_000
// After a failed create (model without caching, prompt under the minimum size), don't retry for a while
const FAILURE_BACKOFF_MS = 10 * 60_000

interface CacheEntry {
  name: string
  expiresAt: number
}

const entries = new Map<string, CacheEntry>()
const failedUntil = new Map<string, number>()
const inFlight = new Map<string, Promise<string | null>>()

export function geminiPromptCacheEnabled(): boolean {
  return process.env.GEMINI_PROMPT_CACHE !== 'off'
}

function cacheKey(model: string, systemText: string, tools: unknown): string {
  return createHash('sha256').update(model).update('\0').update(systemText).update('\0').update(JSON.stringify(tools)).digest('hex')
}

/** Returns a cachedContents name holding this system prompt and tool set, or null. */
export async function getGeminiPromptCache(args: {
  apiKey: string
  model: string
  systemText: string
  tools: unknown[]
}): Promise<string | null> {
  if (!geminiPromptCacheEnabled()) return null
  const key = cacheKey(args.model, args.systemText, args.tools)

  const existing = entries.get(key)
  if (existing && existing.expiresAt - Date.now() > REUSE_MARGIN_MS) return existing.name
  if ((failedUntil.get(key) || 0) > Date.now()) return null

  const pending = inFlight.get(key)
  if (pending) return pending

  const creation = createCache(key, args).finally(() => inFlight.delete(key))
  inFlight.set(key, creation)
  return creation
}

async function createCache(
  key: string,
  { apiKey, model, systemText, tools }: { apiKey: string; model: string; systemText: string; tools: unknown[] }
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/cachedContents?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model}`,
        systemInstruction: { parts: [{ text: systemText }] },
        tools,
        ttl: `${TTL_SECONDS}s`,
      }),
    })
    if (!res.ok) {
      console.warn(`[Gemini cache] create failed ${res.status} model=${model}:`, (await res.text()).slice(0, 300))
      failedUntil.set(key, Date.now() + FAILURE_BACKOFF_MS)
      return null
    }
    const data = await res.json()
    if (!data?.name) {
      failedUntil.set(key, Date.now() + FAILURE_BACKOFF_MS)
      return null
    }
    const expiresAt = data.expireTime ? new Date(data.expireTime).getTime() : Date.now() + TTL_SECONDS * 1000
    entries.set(key, { name: data.name, expiresAt })
    console.log(`[Gemini cache] created ${data.name} model=${model} tokens=${data.usageMetadata?.totalTokenCount ?? '?'} ttl=${TTL_SECONDS}s`)
    return data.name
  } catch (err) {
    console.warn('[Gemini cache] create exception:', err instanceof Error ? err.message : err)
    failedUntil.set(key, Date.now() + FAILURE_BACKOFF_MS)
    return null
  }
}

/** Forget a cache the API rejected (expired early, deleted), so the next call recreates it. */
export function dropGeminiPromptCache(name: string): void {
  for (const [key, entry] of entries) {
    if (entry.name === name) entries.delete(key)
  }
}
