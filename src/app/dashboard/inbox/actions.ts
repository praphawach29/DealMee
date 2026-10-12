'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { synthesizeFaqFromConversation } from '@/lib/ai/faqSynthesis'
import { SupportedPlatform, AiMode, normalizePlatform } from '@/types/omnichannel'

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
    .select('id, shop_id, user_id, platform, status, ai_mode')
    .eq('id', conversationId)
    .eq('shop_id', profile.workspace_id)
    .single()

  if (convError || !conv) {
    return { error: 'ไม่พบข้อมูลการสนทนานี้' }
  }

  const normalizedPlat = normalizePlatform(conv.platform)

  // 2. If target is a real LINE user/group/room, push message via LINE Messaging API
  const isLineTarget = normalizedPlat === 'line' && conv.user_id && /^[UCR][0-9a-fA-F]{32}$/.test(conv.user_id)
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

  // 2.1 If target is Facebook Messenger, push message via Facebook Graph API
  const isFacebookTarget = normalizedPlat === 'facebook' && conv.user_id && !conv.user_id.startsWith('mock-')
  if (isFacebookTarget) {
    const { data: shop } = await supabase
      .from('shops')
      .select('facebook_page_token')
      .eq('id', profile.workspace_id)
      .single()

    let fbToken = shop?.facebook_page_token?.trim()
    if (!fbToken) {
      const { data: channelAcc } = await supabase
        .from('channel_accounts')
        .select('credentials')
        .eq('shop_id', profile.workspace_id)
        .eq('platform', 'facebook')
        .eq('is_active', true)
        .maybeSingle()

      if (channelAcc?.credentials) {
        const creds = channelAcc.credentials as Record<string, string>
        fbToken = creds.page_access_token || creds.token || ''
      }
    }

    if (fbToken) {
      const { sendFacebookMessage } = await import('@/lib/facebook/messengerHelper')
      const fbRes = await sendFacebookMessage(conv.user_id, trimmedText, fbToken)
      if (!fbRes.success) {
        console.error('[Inbox Actions] Facebook Send error:', fbRes.error)
        return { error: `ส่งข้อความเข้า Facebook Messenger ไม่สำเร็จ: ${fbRes.error}` }
      }
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
      platform: normalizedPlat,
    })

  if (msgError) {
    return { error: `บันทึกข้อความไม่สำเร็จ: ${msgError.message}` }
  }

  // 4. Update conversation last_message, status to 'human', and ai_mode to 'manual'
  const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  await supabase
    .from('conversations')
    .update({
      last_message: trimmedText,
      last_message_at: new Date().toISOString(),
      status: 'human', // Auto switch to Human when admin replies
      ai_mode: 'manual',
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

  const newAiMode: AiMode = newStatus === 'human' ? 'manual' : 'auto'

  const { error } = await supabase
    .from('conversations')
    .update({
      status: newStatus,
      ai_mode: newAiMode,
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

export async function toggleAiMode(conversationId: string, newMode: AiMode) {
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

  const newStatus = newMode === 'manual' ? 'human' : 'ai'
  const pausedUntil = newMode === 'manual'
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : null

  const { error } = await supabase
    .from('conversations')
    .update({
      ai_mode: newMode,
      status: newStatus,
      paused_until: pausedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('shop_id', profile.workspace_id)

  if (error) {
    return { error: `เปลี่ยนโหมด AI ไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard/inbox')
  return { success: true }
}

export async function createMockConversation(platform: SupportedPlatform = 'line') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) return { error: 'No workspace' }

  // Sample data based on platform
  const sampleMap: Record<SupportedPlatform, { name: string; msg1: string; reply: string; msg2: string; mode: AiMode }> = {
    line: {
      name: 'คุณสมชาย (ลูกค้า LINE)',
      msg1: 'สวัสดีครับ มีสินค้าพร้อมส่งไหมครับ?',
      reply: 'สวัสดีค่ะ! สินค้าของทางร้านมีพร้อมส่งทุกรายการเลยนะคะ คุณลูกค้าสนใจรุ่นไหนเป็นพิเศษไหมคะ? 😊',
      msg2: 'สนใจสอบถามราคาและส่งรูปสลิปให้ตรวจครับ',
      mode: 'auto',
    },
    facebook: {
      name: 'คุณพิมพ์ใจ (Facebook Messenger)',
      msg1: 'สอบถามโปรโมชั่นที่เพจลงไว้หน่อยค่ะ',
      reply: 'ยินดีเลยค่ะคุณพิมพ์ใจ! โปรโมชั่น 1 แถม 1 สิ้นสุดสิ้นเดือนนี้นะคะ จัดส่งฟรีทั่วประเทศค่ะ ✨',
      msg2: 'รบกวนขอเลขที่บัญชีเพื่อโอนเงินหน่อยค่ะ',
      mode: 'auto',
    },
    tiktok: {
      name: 'user_tiktok_998 (TikTok Shop)',
      msg1: 'เสื้อตัวนี้ไซส์ L อกเท่าไหร่คะ?',
      reply: 'ไซส์ L รอบอก 42 นิ้ว ความยาว 28 นิ้วค่ะ ผ้าคอตตอน 100% นุ่มใส่สบายมากค่ะ',
      msg2: 'มีสีดำพร้อมส่งไหมคะ กำลังจะกดสั่งในตะกร้า',
      mode: 'copilot',
    },
    shopee: {
      name: 'shopee_buyer_th (Shopee)',
      msg1: 'จัดส่งวันไหนคะถ้าสั่งวันนี้?',
      reply: 'ถ้าสั่งก่อนบ่าย 2 โมง ร้านจัดส่งให้วันนี้เลยค่ะ ได้รับสินค้าใน 1-2 วันทำการนะคะ',
      msg2: 'โอเคค่ะ เดี๋ยวสั่งทันทีเลยค่ะ ขอบคุณค่ะ',
      mode: 'manual',
    },
    lazada: {
      name: 'lazada_customer_45 (Lazada)',
      msg1: 'มีใบกำกับภาษีให้ด้วยไหมครับ?',
      reply: 'ทางร้านออกใบกำกับภาษีเต็มรูปแบบได้ค่ะ แจ้งชื่อที่อยู่และเลขผู้เสียภาษีได้เลยนะคะ',
      msg2: 'แจ้งข้อมูลในนี้ได้เลยใช่ไหมครับ',
      mode: 'manual',
    },
    instagram: {
      name: 'maya_style (Instagram DM)',
      msg1: 'ชอบคอลเลกชันใหม่มากค่ะ มีของเลยไหมคะ',
      reply: 'ขอบคุณมากค่ะคุณ Maya! มีพร้อมส่งครบทุกสีเลยค่ะ ทักเลือกสีได้เลยน้าา 💖',
      msg2: 'ขอสั่งสีครีม 1 ตัวค่ะ',
      mode: 'auto',
    },
    web: {
      name: 'ผู้เยี่ยมชมเว็บ #309 (Web Chat)',
      msg1: 'สอบถามบริการจัดส่งด่วนแมสเซนเจอร์ครับ',
      reply: 'มีบริการจัดส่งด่วนคิดตามระยะทางจริงใน กทม. ค่ะ แจ้งพิกัดให้แอดมินเช็กค่าส่งได้เลยค่ะ',
      msg2: 'อยู่แถวสยามครับ คิดค่าส่งเท่าไหร่',
      mode: 'auto',
    },
  }

  const target = sampleMap[platform] || sampleMap.line
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const userId = platform === 'line' ? `U${randomSuffix}${randomSuffix}` : `user_${randomSuffix}`

  // Create sample conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      shop_id: profile.workspace_id,
      user_id: userId,
      platform_sender_id: userId,
      customer_name: target.name,
      platform: platform,
      last_message: target.msg2,
      status: target.mode === 'manual' ? 'human' : 'ai',
      ai_mode: target.mode,
      metadata: { mock: true, platform },
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
      sender_name: target.name.split(' ')[0],
      message: target.msg1,
      platform: platform,
    },
    {
      conversation_id: conv.id,
      shop_id: profile.workspace_id,
      sender_type: 'bot',
      sender_name: 'น้อง DealMee (AI)',
      message: target.reply,
      platform: platform,
    },
    {
      conversation_id: conv.id,
      shop_id: profile.workspace_id,
      sender_type: 'user',
      sender_name: target.name.split(' ')[0],
      message: target.msg2,
      platform: platform,
      ai_suggested_reply: target.mode === 'copilot'
        ? 'มีสีดำพร้อมส่งเลยค่ะ สามารถกดสั่งซื้อในตะกร้าหน้าไลฟ์หรือลิงก์ด้านล่างได้ทันทีนะคะ ทางร้านจะรีบแพ็กส่งให้รอบเช้าเลยค่ะ 😊'
        : null,
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

