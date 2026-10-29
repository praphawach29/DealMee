import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function hashQuery(text: string): string {
  return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex').slice(0, 32)
}

export async function getCachedResponse(shopId: string, query: string): Promise<string | null> {
  const hash = hashQuery(query)
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ai_response_cache')
    .select('response_text, expires_at')
    .eq('shop_id', shopId)
    .eq('query_hash', hash)
    .maybeSingle()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    // Expired — delete
    await supabase.from('ai_response_cache').delete().eq('shop_id', shopId).eq('query_hash', hash)
    return null
  }

  // Increment hit count
  await supabase
    .from('ai_response_cache')
    .update({ hit_count: (data as any).hit_count + 1 })
    .eq('shop_id', shopId)
    .eq('query_hash', hash)

  return data.response_text
}

export async function setCachedResponse(shopId: string, query: string, response: string): Promise<void> {
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
