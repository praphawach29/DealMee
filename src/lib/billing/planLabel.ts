import { effectivePlanKey } from './trial'

/** Display name of a shop's current package, e.g. "TRIAL", "FREE", "PRO". */
export function planLabel(shop: { plan?: string | null; plan_key?: string | null; trial_expires_at?: string | null; plan_expires_at?: string | null } | null | undefined): string {
  if (!shop) return 'FREE'
  return effectivePlanKey(shop).toUpperCase()
}
