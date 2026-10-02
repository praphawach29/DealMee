import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ModulesView from './ModulesView'

export default async function ModulesPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) {
    redirect('/onboarding')
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('features, business_type')
    .eq('id', profile.workspace_id)
    .single()

  const initialFeatures = (shop?.features as Record<string, boolean>) || {}
  const bizType = shop?.business_type || 'retail'

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <ModulesView initialFeatures={initialFeatures} bizType={bizType} />
    </div>
  )
}
