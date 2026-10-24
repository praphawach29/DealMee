import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import InboxView, { type BotMuted, ChatMessage } from './InboxView'
import { botMayReplyNow, describeBusinessHours, readBusinessHours } from '@/lib/shop/businessHours'

import { getOrCreateShopForUser } from '@/lib/shopHelper'

export default async function InboxPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const shop = await getOrCreateShopForUser(supabase, user)

  if (!shop?.id) {
    redirect('/onboarding')
  }

  // Fetch conversations for this shop
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('shop_id', shop.id)
    .order('last_message_at', { ascending: false })

  // Fetch messages for all conversations
  const convIds = (conversations || []).map(c => c.id)
  const messagesMap: Record<string, ChatMessage[]> = {}

  if (convIds.length > 0) {
    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true })

    if (allMessages) {
      allMessages.forEach(msg => {
        if (!messagesMap[msg.conversation_id]) {
          messagesMap[msg.conversation_id] = []
        }
        messagesMap[msg.conversation_id].push(msg)
      })
    }
  }

  // Why the shop's bot is silent, so a quiet inbox doesn't look like a broken one
  const features = (shop.features as Record<string, any>) || {}
  const hours = readBusinessHours(features)
  const botMuted: BotMuted =
    features.auto_reply === false
      ? { reason: 'auto_reply_off', detail: 'ปุ่ม "ตอบกลับอัตโนมัติ" ถูกปิดอยู่ในหน้าตั้งค่าบอท เปิดใหม่เมื่อไหร่บอทจะกลับมาตอบทุกแชททันที' }
      : !botMayReplyNow(features)
        ? {
            reason: 'business_hours',
            detail: `ร้านตั้งให้บอทตอบเฉพาะนอกเวลาทำการ (${describeBusinessHours(hours)}) ตอนนี้อยู่ในเวลาทำการ แอดมินจึงตอบเอง — เปลี่ยนได้ที่ตั้งค่าบอท > เวลาทำการ`,
          }
        : null

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <InboxView conversations={conversations || []} messagesMap={messagesMap} botMuted={botMuted} />
    </div>
  )
}
