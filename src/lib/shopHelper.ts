import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateShopForUser(supabase: SupabaseClient, user: any) {
  if (!user) return null

  // 1. Try to find shop by user_id directly in shops table
  let { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (shop) return shop

  // 2. Try to find workspace_id from users table if set
  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.workspace_id) {
    const { data: shopByWorkspace } = await supabase
      .from('shops')
      .select('*')
      .eq('id', profile.workspace_id)
      .maybeSingle()

    if (shopByWorkspace) return shopByWorkspace
  }

  // 3. Auto-create shop for new merchant user
  const emailPrefix = user.email?.split('@')[0] || 'สมาชิก'
  const shopName = `ร้านค้าของ ${emailPrefix}`

  const { data: newShop, error: createError } = await supabase
    .from('shops')
    .insert({
      user_id: user.id,
      name: shopName,
      bot_name: 'น้อง Botify',
      plan: 'pro',
      status: 'active',
      business_type: 'retail',
    })
    .select('*')
    .single()

  if (!createError && newShop) {
    // Update users.workspace_id as well
    await supabase.from('users').upsert({ id: user.id, workspace_id: newShop.id, email: user.email })
    return newShop
  }

  // 4. Fallback to any existing shop
  const { data: fallbackShop } = await supabase.from('shops').select('*').limit(1).single()
  return fallbackShop || null
}
