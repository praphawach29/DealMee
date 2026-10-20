import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * AI Live Studio is hidden until it can read real live comments (Oct 2026 audit: it
 * only takes comments typed in the dashboard, and its canned replies promised free
 * shipping / COD and a DM that was never sent). A shop sees it only with
 * shops.features.live_studio = true, so it can be developed and tested on one shop
 * without the others seeing it.
 */
export function liveStudioEnabled(features: unknown): boolean {
  return Boolean(features && typeof features === 'object' && (features as Record<string, unknown>).live_studio === true)
}

/** 404 for the live APIs when the shop hasn't been opted in; null when it may proceed. */
export async function liveStudioGuard(shopId: string): Promise<NextResponse | null> {
  const { data } = await createAdminClient().from('shops').select('features').eq('id', shopId).maybeSingle()
  if (liveStudioEnabled(data?.features)) return null
  return NextResponse.json({ error: 'AI Live Studio is not enabled for this shop' }, { status: 404 })
}
