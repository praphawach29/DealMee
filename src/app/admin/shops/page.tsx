import { createAdminClient } from '@/lib/supabase/admin'
import ShopsManagement from './ShopsManagement'

export default async function AdminShopsPage() {
  const admin = createAdminClient()

  // Fetch shops and registered user owners
  const [shopsRes, usersRes] = await Promise.all([
    admin
      .from('shops')
      .select('id, name, plan, status, msg_used, token_used, created_at, company_email, line_token, facebook_page_token, facebook_page_id')
      .order('created_at', { ascending: false }),
    admin
      .from('users')
      .select('id, workspace_id, email, name')
  ])

  // Map workspace_id (shop_id) to user owner details
  const userMap = new Map<string, { email: string; name?: string | null }>()
  for (const u of usersRes.data || []) {
    if (u.workspace_id && u.email) {
      userMap.set(u.workspace_id, { email: u.email, name: u.name })
    }
  }

  const enrichedShops = (shopsRes.data || []).map((s) => {
    const owner = userMap.get(s.id)
    return {
      id: s.id,
      name: s.name,
      plan: s.plan,
      status: s.status,
      msg_used: s.msg_used,
      token_used: s.token_used,
      created_at: s.created_at,
      owner_email: owner?.email || s.company_email || 'ไม่ระบุอีเมล',
      owner_name: owner?.name || null,
      has_line: Boolean(s.line_token && s.line_token.trim()),
      has_facebook: Boolean(s.facebook_page_token && s.facebook_page_token.trim()),
      facebook_page_id: s.facebook_page_id || null,
    }
  })

  return <ShopsManagement initialShops={enrichedShops} />
}

