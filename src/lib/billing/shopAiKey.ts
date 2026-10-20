import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecretValue, encryptSecretValue } from '@/lib/platformSecrets'

/**
 * A BYOK shop's own AI key (table shop_ai_keys, service role only, encrypted).
 * The sales engine uses it instead of the platform's keys while the shop's
 * effective plan is 'byok'.
 */
export type ShopAiProvider = 'gemini' | 'openai' | 'claude'
export const SHOP_AI_PROVIDERS: ShopAiProvider[] = ['gemini', 'openai', 'claude']

export interface ShopAiKeyStatus {
  provider: ShopAiProvider
  hint: string
  updatedAt: string
}

export async function getShopAiKeyStatus(shopId: string): Promise<ShopAiKeyStatus | null> {
  const { data, error } = await createAdminClient()
    .from('shop_ai_keys')
    .select('provider, key_hint, updated_at')
    .eq('shop_id', shopId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { provider: data.provider, hint: data.key_hint, updatedAt: data.updated_at } : null
}

/** The decrypted key, or null when none is saved or it can't be decrypted */
export async function getShopAiKey(shopId: string): Promise<{ provider: ShopAiProvider; key: string } | null> {
  const { data, error } = await createAdminClient()
    .from('shop_ai_keys')
    .select('provider, key_ciphertext')
    .eq('shop_id', shopId)
    .maybeSingle()
  if (error) {
    console.error('[shopAiKey] read failed:', error.message)
    return null
  }
  if (!data) return null
  const key = decryptSecretValue(data.key_ciphertext)
  return key ? { provider: data.provider, key } : null
}

export async function setShopAiKey(shopId: string, provider: ShopAiProvider, key: string) {
  const value = key.trim()
  const { error } = await createAdminClient()
    .from('shop_ai_keys')
    .upsert({
      shop_id: shopId,
      provider,
      key_ciphertext: encryptSecretValue(value),
      key_hint: value.slice(-4),
      updated_at: new Date().toISOString(),
    })
  if (error) throw new Error(error.message)
}

export async function clearShopAiKey(shopId: string) {
  const { error } = await createAdminClient().from('shop_ai_keys').delete().eq('shop_id', shopId)
  if (error) throw new Error(error.message)
}
