import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { embedderForShop } from './embedAuth'
import { assertShopScope } from './hybrid'
import { listKnowledgeShopIds, reindexShop, type IndexReport } from './indexKnowledge'

export interface ReindexArgs {
  shopId?: string
  dryRun: boolean
}

export function parseReindexArgs(argv: string[]): ReindexArgs {
  let shopId: string | undefined
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--shop') shopId = argv[++i]
    else if (arg.startsWith('--shop=')) shopId = arg.slice('--shop='.length)
    else throw new Error(`Unknown argument "${arg}". Use --shop <uuid> and/or --dry-run.`)
  }
  if (shopId !== undefined) shopId = assertShopScope(shopId)
  return { shopId, dryRun }
}

/**
 * Backfill entry point. Requires SUPABASE_SERVICE_ROLE_KEY in the environment
 * and refuses to fall back to any key baked into the app. Embedding keys are
 * resolved the same way as a live upload (shop Gemini/OpenAI, then platform Gemini).
 */
export async function reindexFromEnv(argv: string[]): Promise<{ dryRun: boolean; reports: Array<IndexReport & { shopId: string }> }> {
  const args = parseReindexArgs(argv)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. This script does not use a baked-in key.'
    )
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const shopIds = args.shopId ? [args.shopId] : await listKnowledgeShopIds(supabase)
  const reports: Array<IndexReport & { shopId: string }> = []
  for (const shopId of shopIds) {
    const { embedder, credentials } = args.dryRun
      ? { embedder: null, credentials: null }
      : await embedderForShop(shopId)
    if (!args.dryRun && !credentials) {
      console.warn(`[reindex] ${shopId}: no embedding key; chunks will be stored for keyword search only`)
    }
    const report = await reindexShop({
      supabase: supabase as SupabaseClient,
      shopId,
      embedder,
      modelLabel: credentials?.modelLabel ?? null,
      dryRun: args.dryRun,
    })
    reports.push({ shopId, ...report })
    console.log(`[reindex] ${shopId} chunks=${report.chunks} embedded=${report.embedded} pending=${report.pending} failed=${report.failed} missingOriginals=${report.missingOriginals}${report.warning ? ` warning=${report.warning}` : ''}`)
  }
  return { dryRun: args.dryRun, reports }
}
