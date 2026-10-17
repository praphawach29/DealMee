import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the signed-in merchant's shop, or null when the account isn't linked
 * to one yet (callers send those users to /onboarding, which creates the shop).
 *
 * A shop belongs to a user through `users.workspace_id`; the `shops` table has
 * no owner column. This helper used to look shops up by `shops.user_id`, try to
 * insert one with that column (which doesn't exist, so it always failed), and
 * then fall back to the first shop in the table — handing an unlinked account
 * somebody else's shop whenever row-level security allowed the read.
 *
 * The name is kept for its many callers; it no longer creates anything.
 */
export async function getOrCreateShopForUser(supabase: SupabaseClient, user: { id: string; email?: string } | null) {
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.workspace_id) return null

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', profile.workspace_id)
    .maybeSingle()

  if (!shop) return null

  if (shop.bot_name && /botify/i.test(shop.bot_name)) {
    shop.bot_name = 'น้อง DealMee'
    supabase.from('shops').update({ bot_name: 'น้อง DealMee' }).eq('id', shop.id).then()
  }
  return shop
}
