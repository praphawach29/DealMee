import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { upsertCustomerProfile } from '@/lib/customerMemory'

const supabase = createAdminClient()

// The platform gets its answer immediately; this bounds the after() AI draft
export const maxDuration = 60

/**
 * TikTok Shop Webhook Handler
 * Endpoint: /api/webhook/tiktok/[shop_id]
 *
 * TikTok Shop requires merchants to reply quickly to avoid response rate penalty.
 * DealMee automatically ingests customer inquiries, uses AI reasoning to compose
 * a high-converting suggestion, and places it in the Unified Inbox for 1-click admin approval.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  // TikTok Shop Webhook verification / health check handshake
  return NextResponse.json({ status: 'ok', message: 'TikTok Shop Webhook active' })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const rawBody = await req.json().catch(() => ({}))

    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .maybeSingle()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Extract message data from standard TikTok Shop webhook payload
    const data = rawBody?.data || rawBody
    const senderId = String(data?.sender_id || data?.buyer_user_id || rawBody?.open_id || `tt-${Date.now()}`)
    const text = String(data?.content || data?.text || data?.message || rawBody?.message || '').trim()

    if (!text) {
      return NextResponse.json({ code: 0, message: 'Acknowledged (No text payload)' })
    }

    // Acknowledge right away: the AI draft can take several planning steps, longer
    // than the platform waits for a webhook answer.
    after(async () => {
      try {
        await draftReply({ shop, shopId: shop_id, data, senderId, text })
      } catch (err) {
        console.error('[TikTok Webhook] Background draft failed:', err)
      }
    })

    return NextResponse.json({
      code: 0,
      message: 'success',
    })
  } catch (err: any) {
    console.error('[TikTok Webhook Error]:', err)
    return NextResponse.json({ code: -1, error: err?.message || 'Server error' }, { status: 500 })
  }
}

async function draftReply({ shop, shopId: shop_id, data, senderId, text }: {
  shop: Record<string, any>
  shopId: string
  data: any
  senderId: string
  text: string
}) {
  // 1. Find or create conversation with ai_mode = 'copilot'
  let { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('shop_id', shop_id)
    .eq('platform', 'tiktok')
    .eq('user_id', senderId)
    .maybeSingle()

  const customerName = data?.sender_name || `ลูกค้า TikTok Shop (${senderId.slice(-4)})`

  if (!conv) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        shop_id: shop_id,
        user_id: senderId,
        platform_sender_id: senderId,
        channel_account_id: shop.tiktok_shop_id || 'tiktok-shop',
        customer_name: customerName,
        platform: 'tiktok',
        status: 'ai',
        ai_mode: 'copilot', // Marketplace best practice: AI drafts, Admin 1-clicks
        last_message: text,
      })
      .select('*')
      .single()
    conv = newConv
  } else {
    await supabase
      .from('conversations')
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        customer_name: customerName,
      })
      .eq('id', conv.id)
  }

  if (!conv) {
    console.error('[TikTok Webhook] Failed to create conversation')
    return
  }

  // 2. Upsert customer profile memory
  await upsertCustomerProfile(shop_id, senderId, customerName)

  // 3. Save incoming customer message
  const { data: savedMsg } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conv.id,
      shop_id: shop_id,
      sender_type: 'user',
      sender_name: customerName,
      message: text,
      platform: 'tiktok',
    })
    .select('id')
    .single()

  // 4. Run AI engine to draft response
  const agentResult = await processSalesAgentChat({
    shop,
    userQuery: text,
    userId: senderId,
    conversationId: conv.id,
    supabaseClient: supabase,
  })

  const suggestedText = agentResult.text?.trim() || ''

  // 5. Save AI suggestion for 1-click admin approval in Unified Inbox
  if (savedMsg?.id && suggestedText) {
    await supabase
      .from('chat_messages')
      .update({
        ai_suggested_reply: suggestedText,
      })
      .eq('id', savedMsg.id)
  }
}
