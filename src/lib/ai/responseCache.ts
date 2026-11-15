import { createAdminClient } from '@/lib/supabase/admin'
import { hashQuery, isCacheableCustomerQuery } from '@/lib/ai/responseCachePolicy'

export { hashQuery, isCacheableCustomerQuery, mayStoreResponseCache, responseCacheIdentity } from '@/lib/ai/responseCachePolicy'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function getCachedResponse(shopId: string, query: string): Promise<string | null> {
  if (!shopId || !isCacheableCustomerQuery(query)) return null
  const hash = hashQuery(query)
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ai_response_cache')
    .select('response_text, expires_at, hit_count')
    .eq('shop_id', shopId)
    .eq('query_hash', hash)
    .maybeSingle()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('ai_response_cache').delete().eq('shop_id', shopId).eq('query_hash', hash)
    return null
  }

  const nextHits = Number(data.hit_count ?? 0)
  await supabase
    .from('ai_response_cache')
    .update({ hit_count: Number.isFinite(nextHits) ? nextHits + 1 : 1 })
    .eq('shop_id', shopId)
    .eq('query_hash', hash)

  return data.response_text
}

export async function setCachedResponse(shopId: string, query: string, response: string): Promise<void> {
  if (!shopId || !isCacheableCustomerQuery(query) || !response.trim()) return
  const hash = hashQuery(query)
  const supabase = createAdminClient()
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()

  await supabase
    .from('ai_response_cache')
    .upsert({
      shop_id: shopId,
      query_hash: hash,
      query_text: query.slice(0, 500),
      response_text: response,
      expires_at: expiresAt,
      hit_count: 1,
    }, { onConflict: 'shop_id,query_hash' })
}
