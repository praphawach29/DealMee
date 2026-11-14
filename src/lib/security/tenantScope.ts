/**
 * Pure tenant checks shared by routes and tests.
 * shop A must not read or write shop B. SQL policies for orders repeat the
 * same rule: shop_id is the caller's shop, and workspace_id is null or that shop.
 */

export function orderVisibleToShop(
  callerShopId: string | null | undefined,
  order: { shop_id: string | null | undefined; workspace_id?: string | null }
): boolean {
  if (!callerShopId || !order.shop_id || order.shop_id !== callerShopId) return false
  if (order.workspace_id != null && order.workspace_id !== order.shop_id) return false
  return true
}

/** Null when the list is not exactly one row, so a page id cannot pick a shop at random. */
export function exactlyOne<T>(rows: readonly T[] | null | undefined): T | null {
  if (!rows || rows.length !== 1) return null
  return rows[0]
}

export function liveShopDecision(
  sessionShopId: string | null | undefined,
  requestedShopId: string | null | undefined
): { status: 'ok'; shopId: string } | { status: 401 | 403 } {
  if (!sessionShopId) return { status: 401 }
  const requested = requestedShopId?.trim() || ''
  if (requested && requested !== sessionShopId) return { status: 403 }
  return { status: 'ok', shopId: sessionShopId }
}

/** A document is readable with a valid unguessable token, or by the owning shop's session. */
export function documentReadable(input: {
  documentShopId: string | null | undefined
  sessionShopId: string | null | undefined
  tokenValid: boolean
}): boolean {
  if (!input.documentShopId) return false
  if (input.tokenValid) return true
  return Boolean(input.sessionShopId && input.sessionShopId === input.documentShopId)
}
