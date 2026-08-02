'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface BroadcastItem {
  id: string
  title: string
  target_tag: string | null
  target_pref_key: string | null
  target_pref_value: string | null
  message: string
  recipient_count: number
  status: string
  created_at: string
}

export async function fetchBroadcastHistory(): Promise<BroadcastItem[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: userProfile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!userProfile?.workspace_id) return []

  const { data: list } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('shop_id', userProfile.workspace_id)
    .order('created_at', { ascending: false })

  return list || []
}

export async function getAudienceCount(
  targetTag?: string,
  prefKey?: string,
  prefValue?: string
): Promise<number> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: userProfile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!userProfile?.workspace_id) return 0

  const admin = createAdminClient()
  let query = admin
    .from('customer_profiles')
    .select('id, user_id, tags, preferences')
    .eq('shop_id', userProfile.workspace_id)

  const { data: profiles } = await query
  if (!profiles) return 0

  const filtered = profiles.filter((p) => {
    if (targetTag && targetTag.trim()) {
      const tags: string[] = Array.isArray(p.tags) ? p.tags : []
      if (!tags.includes(targetTag.trim())) return false
    }

    if (prefKey && prefKey.trim() && prefValue && prefValue.trim()) {
      const prefs: Record<string, string> = (p.preferences as Record<string, string>) || {}
      if (prefs[prefKey.trim()] !== prefValue.trim()) return false
    }

    return true
  })

  return filtered.length
}

export async function sendBroadcast(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const { data: userProfile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!userProfile?.workspace_id) return { error: 'No workspace' }

  const title = (formData.get('title') as string) || ''
  const message = (formData.get('message') as string) || ''
  const targetTag = (formData.get('targetTag') as string) || ''
  const prefKey = (formData.get('prefKey') as string) || ''
  const prefValue = (formData.get('prefValue') as string) || ''

  if (!title.trim() || !message.trim()) {
    return { error: 'กรุณากรอกชื่อแคมเปญและข้อความ' }
  }

  const admin = createAdminClient()

  // 1. Query target customer user_ids
  const { data: profiles } = await admin
    .from('customer_profiles')
    .select('user_id, tags, preferences')
    .eq('shop_id', userProfile.workspace_id)

  const recipients = (profiles || []).filter((p) => {
    if (targetTag.trim()) {
      const tags: string[] = Array.isArray(p.tags) ? p.tags : []
      if (!tags.includes(targetTag.trim())) return false
    }
    if (prefKey.trim() && prefValue.trim()) {
      const prefs: Record<string, string> = (p.preferences as Record<string, string>) || {}
      if (prefs[prefKey.trim()] !== prefValue.trim()) return false
    }
    return true
  })

  // 2. Insert broadcast campaign record
  const { error: insertError } = await admin.from('broadcasts').insert({
    shop_id: userProfile.workspace_id,
    title: title.trim(),
    target_tag: targetTag.trim() || null,
    target_pref_key: prefKey.trim() || null,
    target_pref_value: prefValue.trim() || null,
    message: message.trim(),
    recipient_count: recipients.length,
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  if (insertError) {
    return { error: `สร้างการบรอดแคสต์ไม่สำเร็จ: ${insertError.message}` }
  }

  revalidatePath('/dashboard/broadcast')
  return { success: true, count: recipients.length }
}
