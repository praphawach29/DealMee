import type { SupabaseClient } from '@supabase/supabase-js'
import { chunkDocument, chunkQaEntry, contentHash, type DocumentChunk } from './chunk'
import { attachEmbeddings, type Embedder } from './embed'
import { assertShopScope, DOCUMENT_PRIORITY, isMissingKnowledgeSchema, priorityForSource } from './hybrid'

export interface IndexReport {
  documents: number
  entries: number
  chunks: number
  embedded: number
  pending: number
  failed: number
  warning: string | null
  /** Imported Q&A whose original file was never stored, so only the summary can be indexed. */
  missingOriginals: number
}

export interface KnowledgeEntryRow {
  id: string
  title: string
  content: string
  status?: string | null
  source?: string | null
  source_ref?: string | null
}

interface ChunkInsert {
  shop_id: string
  document_id: string | null
  knowledge_base_id: string | null
  source_kind: 'qa' | 'document'
  priority: number
  source_file: string | null
  section: string | null
  chunk_index: number
  chunk_key: string
  content: string
  content_hash: string
  embedding: string | null
  embedding_model: string | null
  embedding_status: 'pending' | 'ready' | 'failed'
  embedding_error: string | null
  updated_at: string
}

const EMPTY: IndexReport = {
  documents: 0,
  entries: 0,
  chunks: 0,
  embedded: 0,
  pending: 0,
  failed: 0,
  warning: null,
  missingOriginals: 0,
}

export function isActiveKnowledgeStatus(status: string | null | undefined): boolean {
  return status == null || status === '' || status === 'active'
}

export function qaFileName(entry: { source?: string | null; source_ref?: string | null }): string {
  if (entry.source_ref) return entry.source_ref
  if (!entry.source || entry.source === 'manual') return 'คำถามที่ร้านเขียนเอง'
  return entry.source
}

function chunkRows(input: {
  shopId: string
  chunks: DocumentChunk[]
  sourceKind: 'qa' | 'document'
  priority: number
  documentId: string | null
  knowledgeBaseId: string | null
  keyPrefix: string
}): ChunkInsert[] {
  const now = new Date().toISOString()
  return input.chunks.map((chunk) => ({
    shop_id: input.shopId,
    document_id: input.documentId,
    knowledge_base_id: input.knowledgeBaseId,
    source_kind: input.sourceKind,
    priority: input.priority,
    source_file: clip(chunk.fileName, 300),
    section: clip(chunk.section, 400),
    chunk_index: chunk.index,
    chunk_key: `${input.keyPrefix}:${chunk.index}`,
    content: chunk.content,
    content_hash: contentHash(chunk.content),
    embedding: null,
    embedding_model: null,
    embedding_status: 'pending',
    embedding_error: null,
    updated_at: now,
  }))
}

function storedEmbedding(value: unknown): string | null {
  if (typeof value === 'string' && value.startsWith('[')) return value
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'number')) {
    return `[${value.join(',')}]`
  }
  return null
}

function clip(value: string | null, max: number): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return Array.from(trimmed).slice(0, max).join('')
}

async function insertChunks(supabase: SupabaseClient, rows: ChunkInsert[]) {
  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40)
    const { error } = await supabase.from('knowledge_chunks').upsert(batch, { onConflict: 'shop_id,chunk_key' })
    if (error) throw error
  }
}

async function embedRows(rows: ChunkInsert[], embedder: Embedder | null, task: 'document' | 'query' = 'document') {
  return attachEmbeddings(rows, embedder ? async (texts) => embedder(texts, task) : null)
}

/**
 * Indexes one merchant Q&A row. Drafts are removed from retrieval.
 * Embedding failure is reported and does not throw.
 */
export async function indexKnowledgeEntry(options: {
  supabase: SupabaseClient
  shopId: string
  entry: KnowledgeEntryRow
  embedder: Embedder | null
}): Promise<IndexReport> {
  const shopId = assertShopScope(options.shopId)
  await forgetKnowledgeEntry(options.supabase, shopId, options.entry.id)
  if (!isActiveKnowledgeStatus(options.entry.status)) return { ...EMPTY }
  return writeQaChunks(options.supabase, shopId, [options.entry], options.embedder)
}

export async function indexKnowledgeEntries(options: {
  supabase: SupabaseClient
  shopId: string
  entries: KnowledgeEntryRow[]
  embedder: Embedder | null
}): Promise<IndexReport> {
  const shopId = assertShopScope(options.shopId)
  const active = options.entries.filter((entry) => isActiveKnowledgeStatus(entry.status))
  const inactive = options.entries.filter((entry) => !isActiveKnowledgeStatus(entry.status))
  for (const entry of inactive) await forgetKnowledgeEntry(options.supabase, shopId, entry.id)
  if (active.length === 0) return { ...EMPTY, entries: options.entries.length }
  return writeQaChunks(options.supabase, shopId, active, options.embedder)
}

async function writeQaChunks(
  supabase: SupabaseClient,
  shopId: string,
  entries: KnowledgeEntryRow[],
  embedder: Embedder | null
): Promise<IndexReport> {
  const ids = entries.map((entry) => entry.id).filter(Boolean)
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('shop_id', shopId)
      .in('knowledge_base_id', ids.slice(i, i + 100))
    if (error) throw error
  }

  const rows = entries.flatMap((entry) => {
    const chunks = chunkQaEntry(
      { title: entry.title, content: entry.content, fileName: qaFileName(entry) },
    )
    return chunkRows({
      shopId,
      chunks,
      sourceKind: 'qa',
      priority: priorityForSource(entry.source),
      documentId: null,
      knowledgeBaseId: entry.id,
      keyPrefix: `qa:${entry.id}`,
    })
  })
  const attached = await embedRows(rows, embedder)
  await insertChunks(supabase, attached.rows)
  return {
    ...EMPTY,
    entries: entries.length,
    chunks: attached.rows.length,
    embedded: attached.embedded,
    pending: attached.pending,
    failed: attached.failed,
    warning: attached.warning,
  }
}

/**
 * Stores the original document and its chunks, and indexes the Q&A rows just
 * written for that import. Re-importing the same source replaces the document
 * when the text changed and reuses vectors when it did not.
 */
export async function indexImportedKnowledge(options: {
  supabase: SupabaseClient
  shopId: string
  source: string
  sourceRef: string
  fullText: string | null
  entries: KnowledgeEntryRow[]
  embedder: Embedder | null
}): Promise<IndexReport> {
  const shopId = assertShopScope(options.shopId)
  const qaReport = await indexKnowledgeEntries({
    supabase: options.supabase,
    shopId,
    entries: options.entries,
    embedder: options.embedder,
  })
  const text = (options.fullText || '').trim()
  if (!text) return qaReport

  const hash = contentHash(text)
  const existing = await options.supabase
    .from('knowledge_documents')
    .select('id, content_hash')
    .eq('shop_id', shopId)
    .eq('source', options.source)
    .eq('source_ref', options.sourceRef)
    .maybeSingle()
  if (existing.error) throw existing.error

  let documentId = existing.data?.id as string | undefined
  const unchanged = Boolean(documentId && existing.data?.content_hash === hash)
  if (!documentId) {
    const inserted = await options.supabase
      .from('knowledge_documents')
      .insert({
        shop_id: shopId,
        source: options.source,
        source_ref: options.sourceRef,
        title: options.sourceRef,
        body: text,
        content_hash: hash,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (inserted.error) throw inserted.error
    documentId = inserted.data.id
  } else if (!unchanged) {
    const updated = await options.supabase
      .from('knowledge_documents')
      .update({ body: text, content_hash: hash, title: options.sourceRef, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .eq('shop_id', shopId)
    if (updated.error) throw updated.error
    const removed = await options.supabase.from('knowledge_chunks').delete().eq('shop_id', shopId).eq('document_id', documentId)
    if (removed.error) throw removed.error
  }

  if (unchanged && documentId) {
    const existingChunks = await options.supabase
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('document_id', documentId)
    if (existingChunks.error) throw existingChunks.error
    if ((existingChunks.count || 0) > 0) return { ...qaReport, documents: 1 }
  }

  if (!documentId) throw new Error('knowledge document was not saved')
  const chunks = chunkDocument(text, { fileName: options.sourceRef })
  const rows = chunkRows({
    shopId,
    chunks,
    sourceKind: 'document',
    priority: DOCUMENT_PRIORITY,
    documentId,
    knowledgeBaseId: null,
    keyPrefix: `doc:${documentId}`,
  })
  const attached = await embedRows(rows, options.embedder)
  await insertChunks(options.supabase, attached.rows)
  return {
    documents: 1,
    entries: qaReport.entries,
    chunks: qaReport.chunks + attached.rows.length,
    embedded: qaReport.embedded + attached.embedded,
    pending: qaReport.pending + attached.pending,
    failed: qaReport.failed + attached.failed,
    warning: [qaReport.warning, attached.warning].filter(Boolean).join(' ') || null,
    missingOriginals: 0,
  }
}

export async function forgetKnowledgeEntry(supabase: SupabaseClient, shopId: string, entryId: string) {
  const { error } = await supabase.from('knowledge_chunks').delete().eq('shop_id', shopId).eq('knowledge_base_id', entryId)
  if (error && !isMissingKnowledgeSchema(error)) throw error
}

export async function forgetDocument(supabase: SupabaseClient, shopId: string, source: string, sourceRef: string) {
  const { error } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('shop_id', shopId)
    .eq('source', source)
    .eq('source_ref', sourceRef)
  if (error && !isMissingKnowledgeSchema(error)) throw error
}

async function fetchAll(run: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const page = 1000
  const all: any[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await run(from, from + page - 1)
    if (error) throw error
    const rows = data || []
    all.push(...rows)
    if (rows.length < page) break
  }
  return all
}

/**
 * Rebuilds chunks for one shop from knowledge_base and knowledge_documents.
 * Rows whose text and embedding model are unchanged keep their vectors.
 */
export async function reindexShop(options: {
  supabase: SupabaseClient
  shopId: string
  embedder: Embedder | null
  modelLabel: string | null
  dryRun?: boolean
}): Promise<IndexReport> {
  const shopId = assertShopScope(options.shopId)
  const entries = (await fetchAll((from, to) =>
    options.supabase
      .from('knowledge_base')
      .select('id, title, content, status, source, source_ref')
      .eq('shop_id', shopId)
      .or('status.eq.active,status.is.null')
      .order('created_at', { ascending: true })
      .range(from, to)
  )) as KnowledgeEntryRow[]

  let documents: Array<{ id: string; source: string; source_ref: string; title: string | null; body: string }> = []
  let documentsMissing = false
  try {
    documents = await fetchAll((from, to) =>
      options.supabase
        .from('knowledge_documents')
        .select('id, source, source_ref, title, body')
        .eq('shop_id', shopId)
        .eq('status', 'active')
        .range(from, to)
    )
  } catch (err) {
    if (!isMissingKnowledgeSchema(err)) throw err
    documentsMissing = true
  }

  const docKeys = new Set(documents.map((doc) => `${doc.source}\0${doc.source_ref}`))
  const missingOriginals = new Set(
    entries
      .filter((entry) => entry.source && entry.source !== 'manual' && entry.source_ref)
      .filter((entry) => !docKeys.has(`${entry.source}\0${entry.source_ref}`))
      .map((entry) => `${entry.source}\0${entry.source_ref}`)
  )

  const desired: ChunkInsert[] = []
  for (const doc of documents) {
    const chunks = chunkDocument(doc.body || '', { fileName: doc.source_ref || doc.title })
    desired.push(...chunkRows({
      shopId,
      chunks,
      sourceKind: 'document',
      priority: DOCUMENT_PRIORITY,
      documentId: doc.id,
      knowledgeBaseId: null,
      keyPrefix: `doc:${doc.id}`,
    }))
  }
  for (const entry of entries) {
    const chunks = chunkQaEntry({ title: entry.title, content: entry.content, fileName: qaFileName(entry) })
    desired.push(...chunkRows({
      shopId,
      chunks,
      sourceKind: 'qa',
      priority: priorityForSource(entry.source),
      documentId: null,
      knowledgeBaseId: entry.id,
      keyPrefix: `qa:${entry.id}`,
    }))
  }

  if (options.dryRun) {
    return {
      documents: documents.length,
      entries: entries.length,
      chunks: desired.length,
      embedded: 0,
      pending: 0,
      failed: 0,
      warning: documentsMissing ? 'knowledge_documents is not installed; apply the migration before backfill' : null,
      missingOriginals: missingOriginals.size,
    }
  }

  if (documentsMissing && desired.length === 0) {
    return {
      ...EMPTY,
      entries: entries.length,
      warning: 'knowledge chunk tables are not installed; apply the migration before backfill',
      missingOriginals: missingOriginals.size,
    }
  }

  let existing: Array<{ id: string; chunk_key: string; content_hash: string; embedding: string | null; embedding_model: string | null; embedding_status: string }> = []
  try {
    existing = await fetchAll((from, to) =>
      options.supabase
        .from('knowledge_chunks')
        .select('id, chunk_key, content_hash, embedding, embedding_model, embedding_status')
        .eq('shop_id', shopId)
        .range(from, to)
    )
  } catch (err) {
    if (!isMissingKnowledgeSchema(err)) throw err
    return {
      ...EMPTY,
      documents: documents.length,
      entries: entries.length,
      warning: 'knowledge_chunks is not installed; apply the migration before backfill',
      missingOriginals: missingOriginals.size,
    }
  }

  const previous = new Map(existing.map((row) => [row.chunk_key, row]))
  const reusable: ChunkInsert[] = []
  const fresh: ChunkInsert[] = []
  for (const row of desired) {
    const prior = previous.get(row.chunk_key)
    const sameModel = !options.modelLabel || prior?.embedding_model === options.modelLabel
    const keptEmbedding = storedEmbedding(prior?.embedding)
    if (prior && prior.embedding_status === 'ready' && keptEmbedding && prior.content_hash === row.content_hash && sameModel) {
      reusable.push({
        ...row,
        embedding: keptEmbedding,
        embedding_model: prior.embedding_model,
        embedding_status: 'ready',
        embedding_error: null,
      })
    } else {
      fresh.push(row)
    }
  }

  const attached = await embedRows(fresh, options.embedder)
  await insertChunks(options.supabase, [...reusable, ...attached.rows])

  const keep = new Set(desired.map((row) => row.chunk_key))
  const stale = existing.filter((row) => !keep.has(row.chunk_key)).map((row) => row.id)
  for (let i = 0; i < stale.length; i += 100) {
    const ids = stale.slice(i, i + 100)
    const { error } = await options.supabase.from('knowledge_chunks').delete().eq('shop_id', shopId).in('id', ids)
    if (error) throw error
  }

  return {
    documents: documents.length,
    entries: entries.length,
    chunks: desired.length,
    embedded: attached.embedded + reusable.length,
    pending: attached.pending,
    failed: attached.failed,
    warning: attached.warning,
    missingOriginals: missingOriginals.size,
  }
}

export async function listKnowledgeShopIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()
  const fromTable = async (table: string) => {
    const rows = await fetchAll((from, to) =>
      supabase.from(table).select('shop_id').range(from, to)
    )
    for (const row of rows) if (row.shop_id) ids.add(row.shop_id)
  }
  await fromTable('knowledge_base')
  try {
    await fromTable('knowledge_documents')
  } catch (err) {
    if (!isMissingKnowledgeSchema(err)) throw err
  }
  return [...ids]
}
