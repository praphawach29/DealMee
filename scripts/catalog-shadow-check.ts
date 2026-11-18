/**
 * Read-only check: run the real catalogPrefetchAdapter against one real shop's
 * catalog to observe behavior with real data, without sending anything to a
 * customer or writing to the database.
 *
 * - Looks up the shop by name (read-only `select`).
 * - Calls search_products / check_stock through `createCatalogPrefetchExecutor`
 *   with `dryRun: true`, the same flag the shadow-replay path uses, so the
 *   sales-stage write in toolDispatcher.ts never runs.
 * - Prints the resulting catalogSnapshot and a reply-guard verdict for a
 *   synthetic draft. Does not call any write tool (take_order, book_appointment, ...).
 *
 *   node --env-file=.env.local --import ./scripts/register-hooks.mjs --experimental-strip-types scripts/catalog-shadow-check.ts "JackShop"
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { createCatalogPrefetchExecutor } from '@/lib/ai/catalogPrefetchAdapter'
import { prefetchCatalog } from '@/lib/ai/catalogPrefetch'
import { guardLocalReply } from '@/lib/ai/localReplyGuard'
import type { ToolExecutionContext } from '@/lib/ai/toolDispatcher'

const shopName = process.argv[2] || 'JackShop'
const db = createAdminClient()

async function main() {
  const { data: shop, error: shopError } = await db
    .from('shops')
    .select('*')
    .ilike('name', shopName)
    .maybeSingle()
  if (shopError) throw new Error(`shops lookup failed: ${shopError.message}`)
  if (!shop) {
    console.log(JSON.stringify({ ok: false, reason: `shop "${shopName}" not found` }, null, 2))
    return
  }

  const { data: sampleProducts } = await db
    .from('products')
    .select('name')
    .eq('shop_id', shop.id)
    .limit(3)

  const ctx: ToolExecutionContext = {
    shopId: shop.id,
    userId: 'catalog-shadow-check',
    conversationId: '00000000-0000-0000-0000-000000000000',
    shop,
    supabase: db,
    supabaseAdmin: db,
    language: 'th',
    dryRun: true, // read-only: skips the sales_stage write in toolDispatcher.ts
  }
  const execute = createCatalogPrefetchExecutor(ctx)

  const queries = [
    'มีสินค้าอะไรบ้างคะ',
    ...(sampleProducts || []).slice(0, 2).map((p: { name: string }) => `${p.name} ราคาเท่าไหร่คะ`),
  ]

  const report: unknown[] = []
  for (const query of queries) {
    try {
      const calls = await prefetchCatalog({
        shopId: shop.id,
        query,
        allowedTools: ['search_products', 'check_stock'],
        execute,
      })
      const lastSnapshot = calls.length > 0 ? calls[calls.length - 1].snapshot : undefined
      const verdict = guardLocalReply({
        draft: calls.length > 0 ? `${calls[calls.length - 1].result} ค่ะ สนใจสั่งเลยไหมคะ` : 'ขออภัยค่ะ',
        language: 'th',
        shopId: shop.id,
        catalogRequired: calls.length > 0,
        snapshot: lastSnapshot,
      })
      report.push({
        query,
        calls: calls.map((c) => ({ name: c.name, args: c.args, productCount: c.snapshot?.products.length ?? 0 })),
        lastSnapshotProductCount: lastSnapshot?.products.length ?? 0,
        guardReason: verdict.reason,
        guardSource: verdict.source,
        guardAccepted: verdict.draftAccepted,
      })
    } catch (err) {
      report.push({ query, failed: true, error: err instanceof Error ? err.message : String(err) })
    }
  }

  console.log(JSON.stringify({ ok: true, shopId: shop.id, shopName: shop.name, dryRun: true, results: report }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
