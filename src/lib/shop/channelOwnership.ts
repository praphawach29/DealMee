import { createAdminClient } from '@/lib/supabase/admin'

/**
 * One LINE OA or Facebook page serves one shop. The OA's webhook URL points at a single
 * shop, so a second shop on the same OA pushes messages (alerts, tracking numbers) into
 * chats whose replies reach the other shop's bot. Seen in Oct 2026 with two test shops
 * on one OA: the tracking message arrived, and "ของถึงไหน" was answered from the other
 * shop's orders.
 */
export interface LineBotInfo {
  userId: string
  basicId: string
  displayName: string
}

/** null with rejected = true when LINE refuses the token; null alone when LINE can't be reached */
export async function fetchLineBotInfo(token: string): Promise<{ info: LineBotInfo | null; rejected: boolean }> {
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    if (res.status === 401 || res.status === 403) return { info: null, rejected: true }
    if (!res.ok) return { info: null, rejected: false }
    const data = await res.json()
    return {
      info: { userId: data.userId || '', basicId: data.basicId || '', displayName: data.displayName || '' },
      rejected: false,
    }
  } catch {
    return { info: null, rejected: false }
  }
}

/** True when another shop already uses this LINE OA (same token, or the same bot user ID) */
export async function lineOaUsedByOtherShop(shopId: string, token: string, botUserId: string | null): Promise<boolean> {
  const db = createAdminClient()
  const byToken = await db.from('shops').select('id').neq('id', shopId).eq('line_token', token).limit(1)
  if (byToken.data?.length) return true
  if (!botUserId) return false
  const byBot = await db.from('shops').select('id').neq('id', shopId).eq('line_bot_user_id', botUserId).limit(1)
  return Boolean(byBot.data?.length)
}

export async function facebookPageUsedByOtherShop(shopId: string, pageId: string): Promise<boolean> {
  const { data } = await createAdminClient().from('shops').select('id').neq('id', shopId).eq('facebook_page_id', pageId).limit(1)
  return Boolean(data?.length)
}
