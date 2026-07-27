import { createClient } from '@/utils/supabase/server'
import ShopsManagement from './ShopsManagement'

export default async function AdminShopsPage() {
  const supabase = await createClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, plan, status, msg_used, token_used, created_at')
    .order('created_at', { ascending: false })

  return <ShopsManagement initialShops={shops || []} />
}
