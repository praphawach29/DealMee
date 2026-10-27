/**
 * Cost / spam limits for FAQ auto-synthesis. Every run costs one Gemini call, and the
 * trigger fires on every admin reply, so three layers apply (cheapest first):
 *
 *  1. per conversation — one run per COOLDOWN, and none if the conversation already
 *     produced drafts in the last CONVERSATION_DRAFT_WINDOW (checked in the database,
 *     so it holds across serverless instances)
 *  2. per shop, database — at most MAX_PENDING_DRAFTS drafts waiting for the owner and
 *     MAX_DRAFTS_PER_DAY new ones per 24 h. Stops a shop's review queue from flooding.
 *  3. per shop, memory — at most MAX_CALLS_PER_HOUR Gemini calls per hour on THIS server
 *     instance. Best effort only (instances do not share memory); a durable per-shop call
 *     counter needs a table — see the PR notes.
 */

export const COOLDOWN_MS = 10 * 60 * 1000
export const CONVERSATION_DRAFT_WINDOW_MS = 60 * 60 * 1000
export const MAX_PENDING_DRAFTS = 30
export const MAX_DRAFTS_PER_DAY = 20
export const MAX_CALLS_PER_HOUR = 20

export type ThrottleReason = 'cooldown' | 'conversation_recent' | 'pending_full' | 'daily_quota' | 'hourly_calls' | 'check_failed'

const lastRun = new Map<string, number>()
const shopCalls = new Map<string, number[]>()

/** tests only */
export function resetFaqThrottle() {
  lastRun.clear()
  shopCalls.clear()
}

interface CountClient {
  from(table: string): any
}

async function countKb(
  supabase: CountClient,
  shopId: string,
  extra: (q: any) => any
): Promise<number | null> {
  const base = supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('source', 'ai_synthesis')
  const { count, error } = await extra(base)
  return error || typeof count !== 'number' ? null : count
}

/**
 * Returns null when the run may go ahead (and records it), or the reason it must not.
 * Fails closed: if a quota query errors, the run is skipped rather than risk a cost spike.
 */
export async function checkFaqThrottle(
  supabase: CountClient,
  { shopId, conversationId, now = Date.now() }: { shopId: string; conversationId: string; now?: number }
): Promise<ThrottleReason | null> {
  const convKey = `${shopId}:${conversationId}`
  const last = lastRun.get(convKey)
  if (last !== undefined && now - last < COOLDOWN_MS) return 'cooldown'

  const recent = await countKb(supabase, shopId, (q) =>
    q.eq('source_ref', conversationId).gte('created_at', new Date(now - CONVERSATION_DRAFT_WINDOW_MS).toISOString())
  )
  if (recent === null) return 'check_failed'
  if (recent > 0) return 'conversation_recent'

  const pending = await countKb(supabase, shopId, (q) => q.eq('status', 'draft'))
  if (pending === null) return 'check_failed'
  if (pending >= MAX_PENDING_DRAFTS) return 'pending_full'

  const today = await countKb(supabase, shopId, (q) => q.gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString()))
  if (today === null) return 'check_failed'
  if (today >= MAX_DRAFTS_PER_DAY) return 'daily_quota'

  const hour = (shopCalls.get(shopId) ?? []).filter((t) => now - t < 60 * 60 * 1000)
  if (hour.length >= MAX_CALLS_PER_HOUR) {
    shopCalls.set(shopId, hour)
    return 'hourly_calls'
  }

  // allowed — record it
  hour.push(now)
  shopCalls.set(shopId, hour)
  lastRun.set(convKey, now)
  return null
}
