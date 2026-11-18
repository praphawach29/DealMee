import { executeTool, type ToolExecutionContext } from '@/lib/ai/toolDispatcher'
import type { CatalogReadTool } from './catalogPrefetch'

/**
 * `prefetchCatalog`'s `execute` callback, wired to the real `search_products` /
 * `check_stock` handlers instead of a fixture. Every call still goes through
 * `executeTool`, so the shop_id-scoped Supabase query (RLS plus the explicit
 * `eq('shop_id', ...)` filter) runs the same as it does for a model-initiated
 * tool call — this does not add a second permission path, it only gives the
 * reply guard a shop-scoped snapshot to check the draft against.
 */
export function createCatalogPrefetchExecutor(ctx: ToolExecutionContext) {
  return async (name: CatalogReadTool, args: Record<string, unknown>, scope: { shopId: string }) => {
    if (scope.shopId !== ctx.shopId) throw new Error('Catalog prefetch scope does not match the active shop')
    const result = await executeTool(name, args, ctx)
    return { resultForAi: result.resultForAi, catalogSnapshot: result.catalogSnapshot }
  }
}
