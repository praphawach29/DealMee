import { createClient } from '@/utils/supabase/server'
import PlansManagement from './PlansManagement'
import { getPlans } from '../actions'

export default async function AdminPlansPage() {
  const supabase = await createClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('plan')

  const shopsCountByPlan: Record<string, number> = {}

  if (shops) {
    for (const shop of shops) {
      const planKey = (shop.plan || 'free').toLowerCase()
      shopsCountByPlan[planKey] = (shopsCountByPlan[planKey] || 0) + 1
    }
  }

  const initialPlans = await getPlans()

  return <PlansManagement shopsCountByPlan={shopsCountByPlan} initialPlans={initialPlans} />
}
