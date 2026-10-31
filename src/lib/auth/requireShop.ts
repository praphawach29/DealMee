import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'

/**
 * Resolves the signed-in merchant's shop for an API route.
 * The shop always comes from the session, never from request input, so a caller
 * cannot act on another shop by passing its shop_id.
 */
export async function requireShop(): Promise<
  | { shopId: string; userId: string; error?: undefined }
  | { shopId?: undefined; userId?: undefined; error: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop?.id) {
    return { error: NextResponse.json({ error: 'Shop not found' }, { status: 404 }) }
  }

  return { shopId: shop.id as string, userId: user.id }
}
