import { createAdminClient } from '@/lib/supabase/admin'

/** Creates the customer's profile row on first contact, or bumps last_seen_at if it already exists. Call on every incoming message. */
export async function upsertCustomerProfile(
  shopId: string,
  userId: string,
  customerName?: string
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('upsert_customer_profile', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_customer_name: customerName || null,
    })
    if (error) console.error('[upsertCustomerProfile] RPC failed:', error.message)
  } catch (err) {
    console.error('[upsertCustomerProfile] Exception:', err)
  }
}

/** Appends a note to the customer's history instead of overwriting it. */
export async function appendCustomerNote(shopId: string, userId: string, note: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('append_customer_note', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_note: note,
    })
    if (error) console.error('[appendCustomerNote] RPC failed:', error.message)
  } catch (err) {
    console.error('[appendCustomerNote] Exception:', err)
  }
}

/** Adds a tag if the customer doesn't already have it (dedupe handled in the DB function). */
export async function addCustomerTagUnique(shopId: string, userId: string, tag: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('add_customer_tag_unique', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_tag: tag,
    })
    if (error) console.error('[addCustomerTagUnique] RPC failed:', error.message)
  } catch (err) {
    console.error('[addCustomerTagUnique] Exception:', err)
  }
}

/** Rolls up order stats (total_orders, total_spend, last_order_at) after a successful take_order. */
export async function recordCustomerOrder(shopId: string, userId: string, amount: number): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('record_customer_order', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_amount: amount,
    })
    if (error) console.error('[recordCustomerOrder] RPC failed:', error.message)
  } catch (err) {
    console.error('[recordCustomerOrder] Exception:', err)
  }
}

/** Merges a key/value pair into the customer's free-form preferences (not yet wired to an AI tool). */
export async function updateCustomerPreference(
  shopId: string,
  userId: string,
  key: string,
  value: string
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('update_customer_preference', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_key: key,
      p_value: value,
    })
    if (error) console.error('[updateCustomerPreference] RPC failed:', error.message)
  } catch (err) {
    console.error('[updateCustomerPreference] Exception:', err)
  }
}

export interface CustomerProfileSummary {
  tags: string[]
  notes: { text: string; created_at: string }[]
  preferences: Record<string, string>
  totalOrders: number
  totalSpend: number
}

/** total_spend (THB) at/above which a customer counts as VIP for Model Router routing purposes, even without an explicit "VIP" tag. */
export const VIP_SPEND_THRESHOLD_THB = 5000

/**
 * Raw profile fetch — single DB round-trip, reused by both the system-prompt
 * context builder below and the Model Router's VIP check, so a request never
 * queries customer_profiles twice for the same purpose.
 */
export async function getCustomerProfileSummary(shopId: string, userId: string): Promise<CustomerProfileSummary | null> {
  try {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('customer_profiles')
      .select('tags, notes, preferences, total_orders, total_spend, last_order_at')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile) return null

    return {
      tags: Array.isArray(profile.tags) ? profile.tags : [],
      notes: Array.isArray(profile.notes) ? profile.notes : [],
      preferences: (profile.preferences as Record<string, string>) || {},
      totalOrders: Number(profile.total_orders) || 0,
      totalSpend: Number(profile.total_spend) || 0,
    }
  } catch (err) {
    console.error('[getCustomerProfileSummary] Exception:', err)
    return null
  }
}

/** True if this customer should get high-persuasion-model routing regardless of what they say (Model Router §4 of ROADMAP_AI_AGENT.md). */
export function isVipProfile(profile: CustomerProfileSummary | null): boolean {
  if (!profile) return false
  return profile.tags.includes('VIP') || profile.totalSpend >= VIP_SPEND_THRESHOLD_THB
}

/** Pure formatter — no DB access — turns a profile summary into the Thai text block injected into the system prompt. */
export function formatCustomerProfileContext(profile: CustomerProfileSummary | null): string {
  if (!profile) return ''

  const lines: string[] = []
  if (profile.tags.length > 0) lines.push(`Tag: ${profile.tags.join(', ')}`)
  if (profile.notes.length > 0) {
    const recentNotes = profile.notes.slice(-5).map((n) => `- ${n.text}`).join('\n')
    lines.push(`บันทึกเกี่ยวกับลูกค้า:\n${recentNotes}`)
  }
  const prefEntries = Object.entries(profile.preferences)
  if (prefEntries.length > 0) {
    lines.push(`ความชอบ: ${prefEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }
  if (profile.totalOrders > 0) {
    lines.push(`ประวัติซื้อ: ${profile.totalOrders} ออเดอร์ รวม ${profile.totalSpend.toLocaleString()} บาท`)
  }

  if (lines.length === 0) return ''
  return `\n\n[ข้อมูลลูกค้ารายนี้ - จำได้จากการคุยครั้งก่อนๆ]\n${lines.join('\n')}`
}

/**
 * Formats a customer's profile into a Thai text block for system-prompt
 * injection — auto-included in every reply, no tool call required, the same
 * way productsContext/knowledgeContext already work in salesAgentEngine.ts.
 * Returns '' for a brand new customer with no profile yet.
 *
 * Kept as a convenience wrapper (fetch + format in one call); prefer calling
 * getCustomerProfileSummary() once and reusing it (e.g. also for Model
 * Router's VIP check) when both are needed in the same request, to avoid a
 * duplicate DB round-trip.
 */
export async function getCustomerProfileContext(shopId: string, userId: string): Promise<string> {
  const profile = await getCustomerProfileSummary(shopId, userId)
  return formatCustomerProfileContext(profile)
}
