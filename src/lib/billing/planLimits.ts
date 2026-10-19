import { createAdminClient } from '@/lib/supabase/admin'
import { effectivePlanKey, TRIAL_MESSAGE_LIMIT, TRIAL_SLIP_LIMIT } from './trial'
import { getCurrentPeriod } from './usage'

export type AddonKind = 'messages' | 'slips'

export interface PlanLimits {
  planKey: string
  /** AI messages per month; -1 = unlimited */
  messages: number
  /** Automatic slip checks per month with the platform's provider key; -1 = unlimited */
  slips: number
}

// Used when a plan has no row in `plans` (matches the 2026-10-20 wallet migration)
const DEFAULT_LIMITS: Record<string, { messages: number; slips: number }> = {
  free: { messages: 100, slips: 0 },
  starter: { messages: 1000, slips: 100 },
  pro: { messages: 3000, slips: 300 },
  agency: { messages: 8000, slips: 1000 },
  byok: { messages: -1, slips: 300 },
}

/**
 * Monthly allowances for the plan the shop is entitled to right now (trial while
 * it runs, Free once a trial or a paid plan has lapsed). Read from the
 * admin-editable `plans` table so a plan edit takes effect immediately.
 */
export async function getPlanLimits(shop: any): Promise<PlanLimits> {
  const planKey = effectivePlanKey(shop)
  if (planKey === 'trial') return { planKey, messages: TRIAL_MESSAGE_LIMIT, slips: TRIAL_SLIP_LIMIT }

  const admin = createAdminClient()
  const { data: row } = await admin.from('plans').select('messages, slips').eq('key', planKey).maybeSingle()
  const fallback = DEFAULT_LIMITS[planKey] ?? DEFAULT_LIMITS.free
  return {
    planKey,
    messages: row ? Number(row.messages) : fallback.messages,
    slips: row && row.slips != null ? Number(row.slips) : fallback.slips,
  }
}

/** Units left across the shop's unexpired add-on packs of one kind. */
export async function getAddonRemaining(shopId: string, kind: AddonKind): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('shop_addon_credits')
    .select('remaining')
    .eq('shop_id', shopId)
    .eq('kind', kind)
    .gt('remaining', 0)
    .gt('expires_at', new Date().toISOString())
  return (data || []).reduce((sum, row) => sum + Number(row.remaining || 0), 0)
}

/** Takes one unit from the add-on pack that expires first; false when none is left. */
export async function consumeAddonCredit(shopId: string, kind: AddonKind): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_addon_credit', { p_shop_id: shopId, p_kind: kind })
  if (error) {
    console.error('[consumeAddonCredit] RPC failed:', error.message)
    return false
  }
  return data === true
}

/**
 * Counts one automatic slip check against the month's plan allowance, then
 * against slip add-on packs. 'none' means both are used up and the slip should
 * go to the shop admin instead. Fails open on a database error so a billing bug
 * never blocks a customer's payment.
 */
export async function claimSlipCheck(shop: any): Promise<'plan' | 'addon' | 'none'> {
  try {
    const { slips } = await getPlanLimits(shop)
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('claim_slip_check', {
      p_shop_id: shop.id,
      p_period: getCurrentPeriod(),
      p_limit: slips,
    })
    if (error) {
      console.error('[claimSlipCheck] RPC failed (fail-open):', error.message)
      return 'plan'
    }
    return data === 'none' ? 'none' : data === 'addon' ? 'addon' : 'plan'
  } catch (err) {
    console.error('[claimSlipCheck] Exception (fail-open):', err)
    return 'plan'
  }
}
