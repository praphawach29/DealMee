import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateShopForUser(supabase: SupabaseClient, user: { id: string; email?: string } | null) {
  if (!user) return null

  // 1. Try to find shop by user_id directly in shops table
  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (shop) {
    if (shop.bot_name && /botify/i.test(shop.bot_name)) {
      shop.bot_name = 'น้อง DealMee'
      supabase.from('shops').update({ bot_name: 'น้อง DealMee' }).eq('id', shop.id).then()
    }
    return shop
  }

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

    if (shopByWorkspace) {
      if (shopByWorkspace.bot_name && /botify/i.test(shopByWorkspace.bot_name)) {
        shopByWorkspace.bot_name = 'น้อง DealMee'
        supabase.from('shops').update({ bot_name: 'น้อง DealMee' }).eq('id', shopByWorkspace.id).then()
      }
      return shopByWorkspace
    }
  }

  // 3. Auto-create shop for new merchant user
  const emailPrefix = user.email?.split('@')[0] || 'สมาชิก'
  const shopName = `ร้านค้าของ ${emailPrefix}`

  const { data: newShop, error: createError } = await supabase
    .from('shops')
    .insert({
      user_id: user.id,
      name: shopName,
      bot_name: 'น้อง DealMee',
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
  if (fallbackShop) {
    if (fallbackShop.bot_name && /botify/i.test(fallbackShop.bot_name)) {
      fallbackShop.bot_name = 'น้อง DealMee'
      supabase.from('shops').update({ bot_name: 'น้อง DealMee' }).eq('id', fallbackShop.id).then()
    }
    return fallbackShop
  }
  return null
}
