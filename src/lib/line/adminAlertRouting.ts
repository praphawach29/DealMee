type ShopWithAdminLine = {
  admin_line_user_id?: unknown
  owner_line_id?: unknown
  features?: Record<string, unknown> | null
}

export function adminLineRecipient(shop: ShopWithAdminLine): string | null {
  const recipient =
    shop.admin_line_user_id ||
    shop.owner_line_id ||
    shop.features?.admin_line_user_id ||
    shop.features?.admin_notify_user_id
  return typeof recipient === 'string' && recipient.trim() ? recipient.trim() : null
}

export function shouldSendAdminAlert(shop: ShopWithAdminLine, excludeLineUserId?: string | null): boolean {
  const recipient = adminLineRecipient(shop)
  return Boolean(recipient && (!excludeLineUserId || recipient !== excludeLineUserId))
}
