import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProductsManager from '../products/ProductsManager'

export default async function RestaurantMenuPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) redirect('/onboarding')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', profile.workspace_id)
    .order('created_at', { ascending: false })

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <ProductsManager products={products || []} />
    </div>
  )
}
