'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { synthesizeFaqFromConversation } from '@/lib/ai/faqSynthesis'

export async function sendMessage(conversationId: string, messageText: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const trimmedText = messageText.trim()
  if (!trimmedText) {
    return { error: 'กรุณากรอกข้อความ' }
  }

  // 1. Fetch conversation details to verify shop ownership and get recipient ID
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('id, shop_id, user_id, platform, status')
    .eq('id', conversationId)
    .eq('shop_id', profile.workspace_id)
    .single()

  if (convError || !conv) {
    return { error: 'ไม่พบข้อมูลการสนทนานี้' }
  }

  // 2. If target is a real LINE user/group/room, push message via LINE Messaging API
  const isLineTarget = conv.user_id && /^[UCR][0-9a-fA-F]{32}$/.test(conv.user_id)
  if (isLineTarget) {
    const { data: shop } = await supabase
      .from('shops')
      .select('line_token')
      .eq('id', profile.workspace_id)
      .single()

    const lineToken = shop?.line_token?.trim()
    if (!lineToken) {
      return { error: 'ยังไม่ได้ตั้งค่า LINE Channel Access Token ในการตั้งค่าร้านค้า จึงไม่สามารถส่งข้อความเข้า LINE ได้' }
    }

    try {
      const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lineToken}`,
        },
        body: JSON.stringify({
          to: conv.user_id,
          messages: [{ type: 'text', text: trimmedText }],
        }),
      })

      if (!pushRes.ok) {
        const errorDetail = await pushRes.text()
        console.error('[Inbox Actions] LINE Push API error:', pushRes.status, errorDetail)
        return { error: `ส่งข้อความเข้า LINE ไม่สำเร็จ (${pushRes.status}): กรุณาตรวจสอบสถานะ LINE Token` }
      }
    } catch (err: any) {
      console.error('[Inbox Actions] LINE Push exception:', err)
      return { error: `เกิดข้อผิดพลาดในการเชื่อมต่อ LINE: ${err?.message || err}` }
    }
  }

  // 3. Insert message into chat_messages
  const { error: msgError } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      shop_id: profile.workspace_id,
      sender_type: 'agent',
      sender_name: 'แอดมิน',
      message: trimmedText,
    })

  if (msgError) {
    return { error: `บันทึกข้อความไม่สำเร็จ: ${msgError.message}` }
  }

  // 4. Update conversation last_message, status to 'human', and set paused_until for 1 hour Smart Auto-Pause
  const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  await supabase
    .from('conversations')
    .update({
      last_message: trimmedText,
      last_message_at: new Date().toISOString(),
      status: 'human', // Auto switch to Human when admin replies
      paused_until: pausedUntil,
    })
    .eq('id', conversationId)

  // 5. Trigger Hermes-inspired continuous learning in background
  synthesizeFaqFromConversation({
    shopId: profile.workspace_id,
    conversationId,
  }).catch((err) => console.error('[Inbox Actions] Background FAQ synthesis error:', err))

  revalidatePath('/dashboard/inbox')
  return { success: true }
}

export async function toggleHandoffStatus(conversationId: string, newStatus: 'ai' | 'human' | 'closed') {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) {
    return { error: 'ไม่พบข้อมูลร้านค้า' }
  }

  const pausedUntil = newStatus === 'human'
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : null

  const { error } = await supabase
    .from('conversations')
    .update({
      status: newStatus,
      paused_until: pausedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('shop_id', profile.workspace_id)

  if (error) {
    return { error: `เปลี่ยนสถานะไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/inbox')
  return { success: true }
}

export async function createMockConversation() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) return { error: 'No workspace' }

  // Create sample conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      shop_id: profile.workspace_id,
      user_id: `U${Math.random().toString(36).substring(2, 10)}`,
      customer_name: 'คุณสมชาย (ลูกค้าใหม่)',
      platform: 'LINE',
      last_message: 'สนใจสอบถามราคาและรายละเอียดสินค้าครับ',
      status: 'ai',
    })
    .select()
    .single()

  if (convError || !conv) return { error: convError?.message }

  // Insert initial messages
  await supabase.from('chat_messages').insert([
    {
      conversation_id: conv.id,
      shop_id: profile.workspace_id,
      sender_type: 'user',
      sender_name: 'คุณสมชาย',
      message: 'สวัสดีครับ มีสินค้าพร้อมส่งไหมครับ?',
    },
    {
      conversation_id: conv.id,
      shop_id: profile.workspace_id,
      sender_type: 'bot',
      sender_name: 'น้อง DealMee (AI)',
      message: 'สวัสดีค่ะ! สินค้าของทางร้านมีพร้อมส่งทุกรายการเลยนะคะ คุณลูกค้าสนใจสินค้าชิ้นไหนเป็นพิเศษไหมคะ? 😊',
    },
    {
      conversation_id: conv.id,
      shop_id: profile.workspace_id,
      sender_type: 'user',
      sender_name: 'คุณสมชาย',
      message: 'สนใจสอบถามราคาและรายละเอียดสินค้าครับ',
    },
  ])

  revalidatePath('/dashboard/inbox')
  return { success: true }
}

export async function fetchCustomerProfile(userId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Unauthenticated' }

  const { data: userProfile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!userProfile?.workspace_id) return { error: 'No workspace' }

  const { getCustomerProfileSummary, isVipProfile } = await import('@/lib/customerMemory')
  const profileSummary = await getCustomerProfileSummary(userProfile.workspace_id, userId)

  if (!profileSummary) return { profile: null, isVip: false }
  return {
    profile: profileSummary,
    isVip: isVipProfile(profileSummary),
  }
}
