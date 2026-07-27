import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET() {
  return new NextResponse('LINE Webhook Endpoint Active', { status: 200 })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const body = await req.json()
    const events = body.events || []

    if (events.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    // 1. Fetch Shop details from Supabase
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single()

    if (!shop) {
      console.error(`Webhook Error: Shop ${shop_id} not found`)
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const lineToken = shop.line_token
    const features = (shop.features as Record<string, boolean>) || {}
    const isAutoReplyEnabled = features.auto_reply !== false

    // Process each LINE event
    for (const event of events) {
      const userId = event.source?.userId
      const replyToken = event.replyToken

      if (!userId) continue

      // Handle Follow Event (Add Friend)
      if (event.type === 'follow') {
        const greeting = shop.greeting_message || 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?'
        if (replyToken && lineToken) {
          await sendLineReply(replyToken, greeting, lineToken)
        }
        continue
      }

      // Handle Message Event
      if (event.type === 'message' && event.message?.type === 'text') {
        const userText = event.message.text

        // 2. Find or Create Conversation
        let { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('user_id', userId)
          .single()

        if (!conv) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              shop_id,
              user_id: userId,
              customer_name: `ลูกค้า LINE (${userId.substring(0, 6)})`,
              platform: 'LINE',
              last_message: userText,
              status: 'ai',
            })
            .select()
            .single()

          conv = newConv
        } else {
          await supabase
            .from('conversations')
            .update({
              last_message: userText,
              last_message_at: new Date().toISOString(),
            })
            .eq('id', conv.id)
        }

        if (!conv) continue

        // 3. Save incoming customer message to chat_messages
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          shop_id,
          sender_type: 'user',
          sender_name: 'ลูกค้า',
          message: userText,
        })

        // 4. Check if Admin Takeover is active OR Auto-Reply is disabled
        if (conv.status === 'human') {
          console.log(`[Webhook] Skipping AI reply for ${userId} (Admin Takeover active)`)
          continue
        }

        if (!isAutoReplyEnabled) {
          console.log(`[Webhook] Skipping AI reply for shop ${shop_id} (Auto-Reply feature disabled)`)
          continue
        }

        // 5. Call AI Sales Employee Engine (Gemini 3.6 Flash + Sales Pipeline & Memory)
        const aiReplyText = await processSalesAgentChat({
          shop,
          userQuery: userText,
          userId,
          conversationId: conv.id,
        })

        // 6. Save AI Reply to chat_messages
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          shop_id,
          sender_type: 'bot',
          sender_name: shop.bot_name || 'น้อง Botify',
          message: aiReplyText,
        })

        // Update conversation last_message
        await supabase
          .from('conversations')
          .update({
            last_message: aiReplyText,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conv.id)

        // 7. Reply back via LINE Messaging API
        if (replyToken && lineToken) {
          await sendLineReply(replyToken, aiReplyText, lineToken)
        }
      }
    }

    return NextResponse.json({ status: 'success' })
  } catch (error: any) {
    console.error('[LINE Webhook Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Helper: Send Reply via LINE Messaging API
async function sendLineReply(replyToken: string, text: string, channelAccessToken: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [
          {
            type: 'text',
            text,
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[LINE Reply API Error]:', errText)
    }
  } catch (err) {
    console.error('[LINE Reply Exception]:', err)
  }
}
