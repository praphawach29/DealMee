import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import InboxView, { ChatMessage } from './InboxView'

export default async function InboxPage() {
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

  // Fetch conversations for this shop
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('shop_id', profile.workspace_id)
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

  return (
    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1440px] mx-auto w-full">
      <InboxView conversations={conversations || []} messagesMap={messagesMap} />
    </div>
  )
}
