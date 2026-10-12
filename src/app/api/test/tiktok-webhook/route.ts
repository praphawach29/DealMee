import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { upsertCustomerProfile } from '@/lib/customerMemory'

/**
 * Developer Simulation API Route for TikTok Shop
 * Allows testing TikTok buyer questions, AI reasoning, and Copilot suggestions.
 *
 * POST /api/test/tiktok-webhook
 * Body: { shop_id: string, user_id?: string, message: string, ai_mode?: 'copilot' | 'auto' | 'manual' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shop_id, user_id, message, ai_mode } = body

    if (!shop_id || !message) {
      return NextResponse.json(
        { error: 'Missing required parameters: shop_id, message' },
        { status: 400 }
      )
    }

    const senderId = user_id || `sim-tt-${Math.floor(100000 + Math.random() * 900000)}`
    const targetAiMode = ai_mode || 'copilot'

    const admin = createAdminClient()

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .maybeSingle()

    if (shopError || !shop) {
      return NextResponse.json(
        { error: `Shop not found with ID "${shop_id}"` },
        { status: 404 }
      )
    }

    // 1. Find or create conversation
    let { data: conv } = await admin
      .from('conversations')
      .select('*')
      .eq('shop_id', shop_id)
      .eq('platform', 'tiktok')
      .eq('user_id', senderId)
      .maybeSingle()

    const customerName = `คุณติ๊กต๊อก (${senderId.slice(-4)})`

    if (!conv) {
      const { data: newConv } = await admin
        .from('conversations')
        .insert({
          shop_id: shop_id,
          user_id: senderId,
          platform_sender_id: senderId,
          channel_account_id: shop.tiktok_shop_id || 'simulated-tiktok-shop',
          customer_name: customerName,
          platform: 'tiktok',
          status: 'ai',
          ai_mode: targetAiMode,
          last_message: message,
        })
        .select('*')
        .single()
      conv = newConv
    } else {
      await admin
        .from('conversations')
        .update({
          last_message: message,
          last_message_at: new Date().toISOString(),
          ai_mode: targetAiMode,
        })
        .eq('id', conv.id)
    }

    if (!conv) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    await upsertCustomerProfile(shop_id, senderId, customerName)

    // 2. Record incoming message
    const { data: userMsg } = await admin
      .from('chat_messages')
      .insert({
        conversation_id: conv.id,
        shop_id: shop_id,
        sender_type: 'user',
        sender_name: customerName,
        message: message,
        platform: 'tiktok',
      })
      .select('id')
      .single()

    // 3. Process AI
    const agentResult = await processSalesAgentChat({
      shop,
      userQuery: message,
      userId: senderId,
      conversationId: conv.id,
      supabaseClient: admin,
    })

    let aiText = agentResult.text?.trim() || ''
    if (!aiText) {
      aiText = `สวัสดีครับ ยินดีต้อนรับสู่ ${shop.name || 'ร้านค้า'} ใน TikTok Shop ครับ สนใจสินค้าชิ้นไหนสอบถามแอดมินได้เลยนะครับ`
    }

    // Save suggestion in chat_messages
    if (userMsg?.id && aiText) {
      await admin
        .from('chat_messages')
        .update({ ai_suggested_reply: aiText })
        .eq('id', userMsg.id)
    }

    return NextResponse.json({
      status: 'copilot_suggestion_ready',
      conversationId: conv.id,
      senderId,
      mode: targetAiMode,
      aiMode: targetAiMode,
      suggestedReply: aiText,
      suggested_reply: aiText,
      reply: aiText,
      reply_text: aiText,
      toolsExecuted: agentResult.toolCallsExecuted || [],
      messageToAdmin: 'ร่างคำตอบแนะนำสำหรับ TikTok Shop พร้อมส่งใน 1 คลิกใน Unified Inbox',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[TikTok Simulator Error]:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
