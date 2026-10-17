/** Display name of a shop's current package, e.g. "TRIAL", "STARTER", "PRO". */
export function planLabel(shop: { plan?: string | null; plan_key?: string | null } | null | undefined): string {
  if (!shop) return 'FREE'
  if ((shop.plan || '').toLowerCase() === 'trial') return 'TRIAL'
  return (shop.plan_key || shop.plan || 'free').toUpperCase()
}
