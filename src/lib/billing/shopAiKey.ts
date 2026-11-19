import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecretValue, encryptSecretValue } from '@/lib/platformSecrets'

/**
 * A BYOK shop's own AI key (table shop_ai_keys, service role only, encrypted).
 * The sales engine uses it instead of the platform's keys while the shop's
 * effective plan is 'byok'.
 *
 * Supports major cloud models as well as fast/affordable alternatives:
 * - Direct: Google Gemini, Anthropic Claude, OpenAI
 * - OpenAI-compatible: Groq (ultra fast LPU), DeepSeek (high capability & value),
 *   OpenRouter (multi-model hub), Ollama (local/VPS), and Custom endpoints.
 */
export type ShopAiProvider =
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'ollama'
  | 'custom_openai'

export const SHOP_AI_PROVIDERS: ShopAiProvider[] = [
  'gemini',
  'openai',
  'claude',
  'groq',
  'deepseek',
  'openrouter',
  'ollama',
  'custom_openai',
]

export interface ShopAiKeyOptions {
  model?: string
  baseUrl?: string
}

export interface ShopAiKeyStatus {
  provider: ShopAiProvider
  hint: string
  model?: string
  baseUrl?: string
  updatedAt: string
}

export function packShopAiKeySecret(provider: ShopAiProvider, key: string, options?: ShopAiKeyOptions): string {
  return JSON.stringify({
    key: key.trim(),
    provider,
    model: options?.model || '',
    baseUrl: options?.baseUrl || '',
  })
}

export function unpackShopAiKeySecret(defaultProvider: string, raw: string): {
  provider: ShopAiProvider
  key: string
  model?: string
  baseUrl?: string
} {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.key) {
      return {
        provider: (parsed.provider || defaultProvider) as ShopAiProvider,
        key: parsed.key,
        model: parsed.model || undefined,
        baseUrl: parsed.baseUrl || undefined,
      }
    }
  } catch {
    // Legacy plain string format
  }
  return { provider: defaultProvider as ShopAiProvider, key: raw }
}

/** The decrypted key and optional options, or null when none is saved or it can't be decrypted */
export async function getShopAiKey(shopId: string): Promise<{
  provider: ShopAiProvider
  key: string
  model?: string
  baseUrl?: string
} | null> {
  const { data, error } = await createAdminClient()
    .from('shop_ai_keys')
    .select('provider, key_ciphertext, key_hint')
    .eq('shop_id', shopId)
    .maybeSingle()
  if (error) {
    console.error('[shopAiKey] read failed:', error.message)
    return null
  }
  if (!data) return null
  const decrypted = decryptSecretValue(data.key_ciphertext)
  if (!decrypted) return null

  return unpackShopAiKeySecret(data.provider, decrypted)
}

export async function getShopAiKeyStatus(shopId: string): Promise<ShopAiKeyStatus | null> {
  const { data, error } = await createAdminClient()
    .from('shop_ai_keys')
    .select('provider, key_ciphertext, key_hint, updated_at')
    .eq('shop_id', shopId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const own = await getShopAiKey(shopId)
  return own
    ? {
        provider: own.provider,
        hint: own.key.slice(-4),
        model: own.model,
        baseUrl: own.baseUrl,
        updatedAt: data.updated_at,
      }
    : null
}

export async function setShopAiKey(
  shopId: string,
  provider: ShopAiProvider,
  key: string,
  options?: ShopAiKeyOptions
) {
  const value = key.trim()
  const payload = packShopAiKeySecret(provider, value, options)

  // Map to safe column provider for database compatibility
  const dbProvider = provider === 'gemini' ? 'gemini' : provider === 'claude' ? 'claude' : 'openai'

  const { error } = await createAdminClient()
    .from('shop_ai_keys')
    .upsert({
      shop_id: shopId,
      provider: dbProvider,
      key_ciphertext: encryptSecretValue(payload),
      key_hint: `${provider}:${value.slice(-4)}`,
      updated_at: new Date().toISOString(),
    })
  if (error) throw new Error(error.message)
}

export async function clearShopAiKey(shopId: string) {
  const { error } = await createAdminClient().from('shop_ai_keys').delete().eq('shop_id', shopId)
  if (error) throw new Error(error.message)
}
