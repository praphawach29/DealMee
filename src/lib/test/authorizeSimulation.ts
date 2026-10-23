import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import { incrementProviderUsage, incrementUsage } from '@/lib/billing/usage'
import type { AgentUsage } from '@/lib/ai/salesAgentEngine'

type AuthOk = { shopId: string; error?: undefined }
type AuthErr = { shopId?: undefined; error: NextResponse }

/**
 * Channel simulators in settings call these routes. The caller must be signed in,
 * and the shop comes from their session unless they are a Super Admin.
 * A body shop_id for someone else's shop is rejected.
 */
export async function authorizeSimulationShop(requestedShopId: unknown): Promise<AuthOk | AuthErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) }
  }

  const requested = typeof requestedShopId === 'string' ? requestedShopId.trim() : ''

  if (isSuperAdminEmail(user.email)) {
    if (!requested) {
      return { error: NextResponse.json({ error: 'Missing shop_id' }, { status: 400 }) }
    }
    return { shopId: requested }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: NextResponse.json({ error: 'ไม่พบข้อมูลร้านค้า' }, { status: 404 }) }
  }
  if (requested && requested !== shop.id) {
    return { error: NextResponse.json({ error: 'ไม่มีสิทธิ์ทดสอบร้านนี้' }, { status: 403 }) }
  }
  return { shopId: shop.id as string }
}

/** Counts a simulator turn the same way a real customer message does. Skips quota-blocked turns. */
export async function recordSimulationUsage(
  shopId: string,
  result: { quotaExceeded?: boolean; usage?: AgentUsage } | null | undefined
): Promise<void> {
  if (!result || result.quotaExceeded) return
  const usage = result.usage
  await incrementUsage(shopId, { totalTokens: usage?.totalTokens || 0 })
  if (usage?.provider) {
    await incrementProviderUsage(shopId, usage)
  }
}
