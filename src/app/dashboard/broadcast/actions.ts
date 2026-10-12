'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendFacebookMessage } from '@/lib/facebook/messengerHelper'

export interface BroadcastItem {
  id: string
  title: string
  target_tag: string | null
  target_pref_key: string | null
  target_pref_value: string | null
  message: string
  channels?: string[]
  channel_stats?: { line?: number; facebook?: number }
  recipient_count: number
  success_count?: number
  failed_count?: number
  status: string
  created_at: string
}

export interface AudienceCountResult {
  total: number
  lineCount: number
  facebookCount: number
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
  prefValue?: string,
  selectedChannels: string[] = ['line', 'facebook']
): Promise<AudienceCountResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, lineCount: 0, facebookCount: 0 }

  const { data: userProfile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!userProfile?.workspace_id) return { total: 0, lineCount: 0, facebookCount: 0 }

  const admin = createAdminClient()

  // 1. Fetch customer memory profiles
  const { data: profiles } = await admin
    .from('customer_profiles')
    .select('user_id, tags, preferences')
    .eq('shop_id', userProfile.workspace_id)

  const profileMap = new Map<string, any>()
  ;(profiles || []).forEach((p) => {
    profileMap.set(p.user_id, p)
  })

  // Filter profiles matching tags and preferences
  const matchesFilter = (userId: string) => {
    const p = profileMap.get(userId)
    if (targetTag && targetTag.trim()) {
      const tags: string[] = Array.isArray(p?.tags) ? p.tags : []
      if (!tags.includes(targetTag.trim())) return false
    }
    if (prefKey && prefKey.trim() && prefValue && prefValue.trim()) {
      const prefs: Record<string, string> = (p?.preferences as Record<string, string>) || {}
      if (prefs[prefKey.trim()] !== prefValue.trim()) return false
    }
    return true
  }

  // 2. Fetch conversations to identify platforms
  const { data: convs } = await admin
    .from('conversations')
    .select('user_id, platform')
    .eq('shop_id', userProfile.workspace_id)

  const lineUsers = new Set<string>()
  const fbUsers = new Set<string>()

  ;(convs || []).forEach((c) => {
    const uid = c.user_id
    if (!uid) return
    const plat = (c.platform || 'line').toLowerCase()
    if (plat === 'line' && /^[UCR][0-9a-fA-F]{32}$/.test(uid)) {
      if (matchesFilter(uid)) lineUsers.add(uid)
    } else if (plat === 'facebook' && !uid.startsWith('mock-')) {
      if (matchesFilter(uid)) fbUsers.add(uid)
    }
  })

  // Also include profiles that have valid LINE ID even if conversation record was archived
  ;(profiles || []).forEach((p) => {
    if (p.user_id && /^[UCR][0-9a-fA-F]{32}$/.test(p.user_id)) {
      if (matchesFilter(p.user_id)) lineUsers.add(p.user_id)
    }
  })

  const lineCount = selectedChannels.includes('line') ? lineUsers.size : 0
  const facebookCount = selectedChannels.includes('facebook') ? fbUsers.size : 0

  return {
    total: lineCount + facebookCount,
    lineCount,
    facebookCount,
  }
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
  const channelsRaw = (formData.get('channels') as string) || 'line,facebook'
  const selectedChannels = channelsRaw.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)

  if (!title.trim() || !message.trim()) {
    return { error: 'กรุณากรอกชื่อแคมเปญและข้อความ' }
  }

  if (selectedChannels.length === 0) {
    return { error: 'กรุณาเลือกอย่างน้อยหนึ่งช่องทางในการบรอดแคสต์' }
  }

  const admin = createAdminClient()

  // 1. Fetch shop credentials
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, line_token, facebook_page_token')
    .eq('id', userProfile.workspace_id)
    .single()

  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }

  // 2. Fetch customer memory profiles
  const { data: profiles } = await admin
    .from('customer_profiles')
    .select('user_id, tags, preferences')
    .eq('shop_id', userProfile.workspace_id)

  const profileMap = new Map<string, any>()
  ;(profiles || []).forEach((p) => {
    profileMap.set(p.user_id, p)
  })

  const matchesFilter = (userId: string) => {
    const p = profileMap.get(userId)
    if (targetTag.trim()) {
      const tags: string[] = Array.isArray(p?.tags) ? p.tags : []
      if (!tags.includes(targetTag.trim())) return false
    }
    if (prefKey.trim() && prefValue.trim()) {
      const prefs: Record<string, string> = (p?.preferences as Record<string, string>) || {}
      if (prefs[prefKey.trim()] !== prefValue.trim()) return false
    }
    return true
  }

  // 3. Fetch conversations
  const { data: convs } = await admin
    .from('conversations')
    .select('id, user_id, platform')
    .eq('shop_id', userProfile.workspace_id)

  const lineTargets: { convId?: string; userId: string }[] = []
  const fbTargets: { convId: string; psid: string }[] = []

  ;(convs || []).forEach((c) => {
    const uid = c.user_id
    if (!uid) return
    const plat = (c.platform || 'line').toLowerCase()
    if (plat === 'line' && /^[UCR][0-9a-fA-F]{32}$/.test(uid)) {
      if (matchesFilter(uid)) {
        lineTargets.push({ convId: c.id, userId: uid })
      }
    } else if (plat === 'facebook' && !uid.startsWith('mock-')) {
      if (matchesFilter(uid)) {
        fbTargets.push({ convId: c.id, psid: uid })
      }
    }
  })

  let lineSuccess = 0
  let lineFailed = 0
  let fbSuccess = 0
  let fbFailed = 0

  // 4. Send to LINE if selected
  if (selectedChannels.includes('line') && lineTargets.length > 0) {
    const lineToken = shop.line_token?.trim()
    if (lineToken) {
      // Chunk into 500 for LINE Multicast API
      const chunkSize = 500
      for (let i = 0; i < lineTargets.length; i += chunkSize) {
        const chunk = lineTargets.slice(i, i + chunkSize)
        const recipientIds = chunk.map((t) => t.userId)

        try {
          const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${lineToken}`,
            },
            body: JSON.stringify({
              to: recipientIds,
              messages: [{ type: 'text', text: message.trim() }],
            }),
          })

          if (res.ok) {
            lineSuccess += chunk.length
          } else {
            const errText = await res.text()
            console.error('[LINE Broadcast Error]:', res.status, errText)
            lineFailed += chunk.length
          }
        } catch (err) {
          console.error('[LINE Broadcast Exception]:', err)
          lineFailed += chunk.length
        }
      }

      // Record in chat_messages for conversation history
      const lineMsgInserts = lineTargets
        .filter((t) => t.convId)
        .map((t) => ({
          conversation_id: t.convId,
          shop_id: userProfile.workspace_id,
          sender_type: 'agent',
          sender_name: 'แอดมิน (Broadcast)',
          message: message.trim(),
          platform: 'line',
          metadata: { broadcast_title: title.trim() },
        }))

      if (lineMsgInserts.length > 0) {
        await admin.from('chat_messages').insert(lineMsgInserts)
      }
    } else {
      console.warn('[Broadcast]: LINE channel selected but shop.line_token is missing.')
    }
  }

  // 5. Send to Facebook if selected
  if (selectedChannels.includes('facebook') && fbTargets.length > 0) {
    const fbToken = shop.facebook_page_token?.trim()
    if (fbToken) {
      for (const target of fbTargets) {
        try {
          const res = await sendFacebookMessage(
            target.psid,
            message.trim(),
            fbToken,
            { messagingType: 'MESSAGE_TAG', tag: 'CONFIRMED_EVENT_UPDATE' }
          )
          if (res.success) {
            fbSuccess++
            // Record in chat_messages
            await admin.from('chat_messages').insert({
              conversation_id: target.convId,
              shop_id: userProfile.workspace_id,
              sender_type: 'agent',
              sender_name: 'แอดมิน (Broadcast)',
              message: message.trim(),
              platform: 'facebook',
              metadata: { broadcast_title: title.trim() },
            })
          } else {
            console.error('[Facebook Broadcast Error]:', target.psid, res.error)
            fbFailed++
          }
        } catch (err) {
          console.error('[Facebook Broadcast Exception]:', err)
          fbFailed++
        }
      }
    } else {
      console.warn('[Broadcast]: Facebook channel selected but shop.facebook_page_token is missing.')
    }
  }

  const totalSuccess = lineSuccess + fbSuccess
  const totalFailed = lineFailed + fbFailed
  const totalAttempted = lineTargets.length + fbTargets.length

  // 6. Insert broadcast record
  const { error: insertError } = await admin.from('broadcasts').insert({
    shop_id: userProfile.workspace_id,
    title: title.trim(),
    target_tag: targetTag.trim() || null,
    target_pref_key: prefKey.trim() || null,
    target_pref_value: prefValue.trim() || null,
    message: message.trim(),
    channels: selectedChannels,
    channel_stats: { line: lineSuccess, facebook: fbSuccess },
    recipient_count: totalAttempted > 0 ? totalAttempted : 0,
    success_count: totalSuccess,
    failed_count: totalFailed,
    status: totalAttempted === 0 ? 'sent' : totalSuccess > 0 ? 'sent' : 'failed',
    sent_at: new Date().toISOString(),
  })

  if (insertError) {
    return { error: `สร้างการบรอดแคสต์ไม่สำเร็จ: ${insertError.message}` }
  }

  revalidatePath('/dashboard/broadcast')
  revalidatePath('/dashboard/inbox')

  return {
    success: true,
    count: totalSuccess,
    totalAttempted,
    lineCount: lineSuccess,
    facebookCount: fbSuccess,
    failedCount: totalFailed,
  }
}
