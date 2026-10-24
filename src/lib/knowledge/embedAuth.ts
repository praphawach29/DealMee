import { getShopAiKey } from '@/lib/billing/shopAiKey'
import { platformSecret } from '@/lib/platformSecrets'
import {
  createEmbedder,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  modelLabel,
  pickCredentialsForProvider,
  pickEmbeddingSource,
  type EmbeddingCredentials,
  type EmbeddingProvider,
  type Embedder,
} from './embed'

export interface EmbeddingHints {
  shopId?: string
  /** True when this turn is already using the shop's own chat key. */
  byok?: boolean
  shopProvider?: string | null
  shopKey?: string | null
  /** undefined = look the platform key up. '' = already known to be absent. */
  platformGeminiKey?: string | null
  platformOpenaiKey?: string | null
  /** Query-time only: stay in the vector space already stored for this shop. */
  forceProvider?: EmbeddingProvider | null
}

/**
 * Resolves the embedding key for a shop.
 * Chat BYOK is unchanged. Embeddings use the shop's Gemini or OpenAI key when
 * they brought one, otherwise the platform Gemini key, otherwise platform OpenAI.
 */
export async function resolveEmbeddingCredentials(hints: EmbeddingHints = {}): Promise<EmbeddingCredentials | null> {
  const availability = await loadAvailability(hints)
  if (hints.forceProvider) {
    const forced = pickCredentialsForProvider(hints.forceProvider, availability)
    if (!forced) return null
    return credentialsFor(hints.forceProvider, forced.source, availability)
  }
  const picked = pickEmbeddingSource(availability)
  if (!picked) return null
  return credentialsFor(picked.provider, picked.source, availability)
}

function credentialsFor(
  provider: EmbeddingProvider,
  source: 'shop' | 'platform',
  availability: Availability
): EmbeddingCredentials | null {
  const apiKey = keyFor(provider, source, availability)
  if (!apiKey) return null
  const model = provider === 'gemini'
    ? process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL
    : process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL
  return { provider, apiKey, model, source, modelLabel: modelLabel(provider, model) }
}

export async function embedderForShop(shopId: string, hints: EmbeddingHints = {}): Promise<{
  embedder: Embedder | null
  credentials: EmbeddingCredentials | null
}> {
  const credentials = await resolveEmbeddingCredentials({ ...hints, shopId })
  if (!credentials) return { embedder: null, credentials: null }
  return { embedder: createEmbedder(credentials), credentials }
}

interface Availability {
  shopProvider: string | null
  shopKeyPresent: boolean
  shopGeminiKey: string
  shopOpenaiKey: string
  platformGemini: boolean
  platformOpenai: boolean
  platformGeminiKey: string
  platformOpenaiKey: string
}

async function loadAvailability(hints: EmbeddingHints): Promise<Availability> {
  let shopProvider = hints.shopProvider || null
  let shopGeminiKey = ''
  let shopOpenaiKey = ''

  if (hints.byok && hints.shopKey && shopProvider === 'gemini') shopGeminiKey = hints.shopKey
  if (hints.byok && hints.shopKey && shopProvider === 'openai') shopOpenaiKey = hints.shopKey

  // The chat path already loaded the shop key. The tool and upload paths have
  // not, so they read shop_ai_keys here. byok: false means "platform plan".
  if (hints.byok == null && hints.shopId && !shopGeminiKey && !shopOpenaiKey) {
    try {
      const own = await getShopAiKey(hints.shopId)
      if (own?.provider === 'gemini') {
        shopProvider = 'gemini'
        shopGeminiKey = own.key
      } else if (own?.provider === 'openai') {
        shopProvider = 'openai'
        shopOpenaiKey = own.key
      } else if (own?.provider === 'claude') {
        shopProvider = 'claude'
      }
    } catch (err) {
      console.warn('[embeddings] could not read shop key:', err instanceof Error ? err.message : err)
    }
  }

  const platformGeminiKey = hints.platformGeminiKey !== undefined && hints.platformGeminiKey !== null
    ? hints.platformGeminiKey
    : await lookupPlatform('GEMINI_API_KEY')
  const platformOpenaiKey = hints.platformOpenaiKey !== undefined && hints.platformOpenaiKey !== null
    ? hints.platformOpenaiKey
    : await lookupPlatform('OPENAI_API_KEY')

  const shopKey = shopProvider === 'openai' ? shopOpenaiKey : shopGeminiKey
  return {
    shopProvider,
    shopKeyPresent: Boolean(shopKey),
    shopGeminiKey,
    shopOpenaiKey,
    platformGemini: Boolean(platformGeminiKey),
    platformOpenai: Boolean(platformOpenaiKey),
    platformGeminiKey,
    platformOpenaiKey,
  }
}

function keyFor(provider: EmbeddingProvider, source: 'shop' | 'platform', availability: Availability): string {
  if (provider === 'gemini') {
    return source === 'shop' ? availability.shopGeminiKey : availability.platformGeminiKey
  }
  return source === 'shop' ? availability.shopOpenaiKey : availability.platformOpenaiKey
}

async function lookupPlatform(name: 'GEMINI_API_KEY' | 'OPENAI_API_KEY'): Promise<string> {
  try {
    return (await platformSecret(name)) || ''
  } catch (err) {
    console.warn(`[embeddings] could not read ${name}:`, err instanceof Error ? err.message : err)
    return ''
  }
}
