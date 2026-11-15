import type { SupabaseClient } from '@supabase/supabase-js'
import { KNOWLEDGE_RELEVANT_MAX_CHARS, selectRelevantKnowledge, type KnowledgeItem } from '@/lib/ai/knowledgeSelect'
import { createEmbedder, safeErrorMessage } from './embed'
import { resolveEmbeddingCredentials, type EmbeddingHints } from './embedAuth'
import {
  assertShopScope,
  buildRetrievalQuery,
  escapeLike,
  isMissingKnowledgeSchema,
  keywordSearchArgs,
  mergeHybridResults,
  priorityForSource,
  providerFromModel,
  renderKnowledgeSection,
  renderToolResult,
  vectorSearchArgs,
  type HybridCandidate,
  type RankedChunk,
} from './hybrid'

const CANDIDATES = 20
const LEGACY_FETCH_LIMIT = 500

export interface RetrievalResult {
  chunks: RankedChunk[]
  shopHasKnowledge: boolean
  mode: 'hybrid' | 'keyword' | 'legacy' | 'none'
}

/**
 * Shop-scoped hybrid retrieval. Vector search runs only when this shop already
 * has embeddings and we can use the same provider. Keyword search still runs
 * when embedding fails. If the chunk tables are missing or empty, the previous
 * in-memory selector is used so a deploy before the migration does not blank the bot.
 */
export async function retrieveKnowledge(options: {
  supabase: SupabaseClient
  shopId: string
  query: string
  recentMessages?: string[]
  purpose?: 'prompt' | 'tool'
  limit?: number
} & EmbeddingHints): Promise<RetrievalResult> {
  const shopId = assertShopScope(options.shopId)
  const purpose = options.purpose || 'prompt'
  const limit = options.limit ?? (purpose === 'tool' ? 5 : 8)
  const query = buildRetrievalQuery(options.query, purpose === 'prompt' ? options.recentMessages || [] : [])
  if (!query) return { chunks: [], shopHasKnowledge: false, mode: 'none' }

  const hybrid = await hybridRetrieve({ ...options, shopId, query, limit })
  if (hybrid) return hybrid
  return legacyRetrieve({ ...options, shopId, query, limit, purpose })
}

export async function loadKnowledgeContext(options: {
  supabase: SupabaseClient
  shopId: string
  query: string
  recentMessages?: string[]
} & EmbeddingHints): Promise<{ text: string; chunks: RankedChunk[] }> {
  try {
    if (!options.shopId) return { text: '', chunks: [] }
    const found = await retrieveKnowledge({ ...options, purpose: 'prompt', limit: 8 })
    const section = renderKnowledgeSection({
      chunks: found.chunks,
      shopHasKnowledge: found.shopHasKnowledge,
      maxChars: KNOWLEDGE_RELEVANT_MAX_CHARS,
    })
    return { text: section.text, chunks: found.chunks }
  } catch (err) {
    console.error('[knowledge] retrieval failed:', safeErrorMessage(err))
    return { text: '', chunks: [] }
  }
}

export async function searchKnowledgeForTool(
  supabase: SupabaseClient,
  shopId: string,
  query: string
): Promise<string> {
  const found = await retrieveKnowledge({ supabase, shopId, query, purpose: 'tool', limit: 5 })
  return renderToolResult(query, found.chunks)
}

async function hybridRetrieve(options: {
  supabase: SupabaseClient
  shopId: string
  query: string
  limit: number
} & EmbeddingHints): Promise<RetrievalResult | null> {
  const head = await options.supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', options.shopId)
  if (head.error) {
    if (!isMissingKnowledgeSchema(head.error)) console.warn('[knowledge] chunk count failed:', head.error.message)
    return null
  }
  if (!head.count) return null

  const vectorHits = await vectorHitsFor(options)
  const keywordHits = await keywordHitsFor(options)
  if (vectorHits == null && keywordHits == null) return null

  return {
    chunks: mergeHybridResults({
      shopId: options.shopId,
      query: options.query,
      vectorHits: vectorHits || [],
      keywordHits: keywordHits || [],
      limit: options.limit,
    }),
    shopHasKnowledge: true,
    mode: vectorHits && vectorHits.length > 0 ? 'hybrid' : 'keyword',
  }
}

async function vectorHitsFor(options: {
  supabase: SupabaseClient
  shopId: string
  query: string
} & EmbeddingHints): Promise<HybridCandidate[] | null> {
  const stored = await options.supabase
    .from('knowledge_chunks')
    .select('embedding_model')
    .eq('shop_id', options.shopId)
    .eq('embedding_status', 'ready')
    .limit(1)
    .maybeSingle()
  if (stored.error) {
    if (isMissingKnowledgeSchema(stored.error)) return null
    console.warn('[knowledge] embedding model lookup failed:', stored.error.message)
    return []
  }
  const provider = providerFromModel(stored.data?.embedding_model)
  if (!provider) return []

  try {
    const creds = await resolveEmbeddingCredentials({ ...options, shopId: options.shopId, forceProvider: provider })
    if (!creds) return []
    const embedded = await createEmbedder(creds)([options.query], 'query')
    const vector = embedded.vectors[0]
    if (!vector) return []
    const rpc = await options.supabase.rpc('match_knowledge_chunks', vectorSearchArgs(options.shopId, vector, CANDIDATES))
    if (rpc.error) {
      if (!isMissingKnowledgeSchema(rpc.error)) console.warn('[knowledge] vector search failed:', rpc.error.message)
      return []
    }
    return (rpc.data || []).map((row: Record<string, unknown>) => mapHit(row, options.shopId, 'vector'))
  } catch (err) {
    console.warn('[knowledge] query embedding failed:', safeErrorMessage(err))
    return []
  }
}

async function keywordHitsFor(options: {
  supabase: SupabaseClient
  shopId: string
  query: string
}): Promise<HybridCandidate[] | null> {
  const rpc = await options.supabase.rpc(
    'search_knowledge_chunks_keyword',
    keywordSearchArgs(options.shopId, options.query, CANDIDATES)
  )
  if (!rpc.error) return (rpc.data || []).map((row: Record<string, unknown>) => mapHit(row, options.shopId, 'keyword'))
  if (!isMissingKnowledgeSchema(rpc.error)) {
    console.warn('[knowledge] keyword search failed:', rpc.error.message)
    return []
  }
  return keywordIlikeFallback(options.supabase, options.shopId, options.query)
}

async function keywordIlikeFallback(supabase: SupabaseClient, shopId: string, query: string): Promise<HybridCandidate[] | null> {
  const pattern = `%${escapeLike(Array.from(query).slice(0, 180).join(''))}%`
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('id, shop_id, content, source_file, section, source_kind, priority, chunk_index')
    .eq('shop_id', shopId)
    .ilike('content', pattern)
    .limit(CANDIDATES)
  if (error) {
    if (isMissingKnowledgeSchema(error)) return null
    console.warn('[knowledge] keyword fallback failed:', error.message)
    return []
  }
  return (data || []).map((row) => mapHit(row, shopId, 'keyword'))
}

function mapHit(row: Record<string, any>, shopId: string, kind: 'vector' | 'keyword'): HybridCandidate {
  return {
    id: String(row.id),
    shopId: row.shop_id ? String(row.shop_id) : shopId,
    content: String(row.content || ''),
    sourceFile: row.source_file ?? null,
    section: row.section ?? null,
    sourceKind: row.source_kind === 'document' ? 'document' : 'qa',
    priority: Number(row.priority) || 0,
    chunkIndex: Number(row.chunk_index) || 0,
    vectorScore: kind === 'vector' ? Number(row.vector_score) : undefined,
    keywordScore: kind === 'keyword' ? Number(row.keyword_score ?? 1) : undefined,
  }
}

async function legacyRetrieve(options: {
  supabase: SupabaseClient
  shopId: string
  query: string
  recentMessages?: string[]
  limit: number
  purpose: 'prompt' | 'tool'
}): Promise<RetrievalResult> {
  const { data, error } = await options.supabase
    .from('knowledge_base')
    .select('id, title, content, source, source_ref, status')
    .eq('shop_id', options.shopId)
    .or('status.eq.active,status.is.null')
    .order('created_at', { ascending: true })
    .limit(LEGACY_FETCH_LIMIT)
  if (error) {
    console.warn('[knowledge] legacy read failed:', error.message)
    return { chunks: [], shopHasKnowledge: false, mode: 'none' }
  }
  const items = (data || []) as KnowledgeItem[]
  if (items.length === 0) return { chunks: [], shopHasKnowledge: false, mode: 'legacy' }
  const mode = options.purpose === 'tool' ? 'search' : 'inline'
  const selected = selectRelevantKnowledge(
    items,
    options.query,
    options.recentMessages || [],
    KNOWLEDGE_RELEVANT_MAX_CHARS,
    mode,
    options.purpose === 'tool' ? options.limit : Number.POSITIVE_INFINITY
  )
  const chunks = selected.indexes.map((index) => legacyToChunk(items[index], options.shopId, index))
  return { chunks, shopHasKnowledge: true, mode: 'legacy' }
}

function legacyToChunk(item: KnowledgeItem, shopId: string, index: number): RankedChunk {
  const source = item.source || null
  return {
    id: item.id || `legacy-${index}`,
    shopId,
    content: `Q: ${item.title || ''}\nA: ${item.content || ''}`,
    sourceFile: item.source_ref || (!source || source === 'manual' ? 'คำถามที่ร้านเขียนเอง' : source),
    section: item.title,
    sourceKind: 'qa',
    priority: priorityForSource(source),
    chunkIndex: index,
    score: 0,
  }
}
