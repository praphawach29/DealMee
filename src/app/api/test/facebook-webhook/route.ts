import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { authorizeSimulationShop, recordSimulationUsage } from '@/lib/test/authorizeSimulation'

/**
 * Developer Simulation API Route for Facebook Messenger
 * Allows testing Facebook webhook ingestion, AI reasoning, and Copilot suggestions
 * without needing a live Meta Graph API webhook or public domain tunnel.
 *
 * POST /api/test/facebook-webhook
 * Body: { shop_id: string, user_id?: string, message: string, ai_mode?: 'auto' | 'copilot' | 'manual' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, message, ai_mode, platform = 'facebook' } = body
    const auth = await authorizeSimulationShop(body.shop_id)
    if (auth.error) return auth.error
    const shop_id = auth.shopId
    const targetPlatform = platform === 'instagram' ? 'instagram' : 'facebook'

    if (!message) {
      return NextResponse.json(
        { error: 'Missing required parameters: message' },
        { status: 400 }
      )
    }

    const psid = user_id || `sim-${targetPlatform === 'instagram' ? 'ig' : 'fb'}-${Math.floor(100000 + Math.random() * 900000)}`
    const targetAiMode = ai_mode || 'auto'

    const admin = createAdminClient()

    // 1. Fetch shop record
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

    // 2. Find or create conversation
    let { data: conv } = await admin
      .from('conversations')
      .select('*')
      .eq('shop_id', shop_id)
      .eq('platform', targetPlatform)
      .eq('user_id', psid)
      .maybeSingle()

    if (!conv) {
      const defaultName = targetPlatform === 'instagram' ? `คุณ Instagram (จำลอง ${psid.slice(-4)})` : `คุณเฟสบุ๊ค (จำลอง ${psid.slice(-4)})`
      const { data: newConv, error: createError } = await admin
        .from('conversations')
        .insert({
          shop_id: shop_id,
          user_id: psid,
          platform_sender_id: psid,
          channel_account_id: shop.facebook_page_id || 'simulated-page-id',
          customer_name: defaultName,
          platform: targetPlatform,
          status: 'ai',
          ai_mode: targetAiMode,
          last_message: message,
        })
        .select('*')
        .single()

      if (createError || !newConv) {
        return NextResponse.json(
          { error: `Failed to create conversation: ${createError?.message}` },
          { status: 500 }
        )
      }
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

    // 3. Upsert customer memory
    await upsertCustomerProfile(shop_id, psid, conv.customer_name)

    // 4. Record incoming user message
    const { data: userMsg } = await admin
      .from('chat_messages')
      .insert({
        conversation_id: conv.id,
        shop_id: shop_id,
        sender_type: 'user',
        sender_name: conv.customer_name || (targetPlatform === 'instagram' ? 'ลูกค้า Instagram' : 'ลูกค้า Facebook'),
        message: message,
        platform: targetPlatform,
      })
      .select('id')
      .single()

    // 5. If manual mode, return without running AI
    if (targetAiMode === 'manual') {
      return NextResponse.json({
        status: 'manual_mode',
        message: 'Message received. AI auto-reply is turned off (manual mode).',
        conversationId: conv.id,
        psid,
      })
    }

    // 6. Run AI Sales Agent Engine
    const agentResult = await processSalesAgentChat({
      shop,
      userQuery: message,
      userId: psid,
      conversationId: conv.id,
      supabaseClient: admin,
    })
    await recordSimulationUsage(shop_id, agentResult)

    let aiText = agentResult.text || ''
    if (!aiText && agentResult.immediateMessages && agentResult.immediateMessages.length > 0) {
      const foundText = agentResult.immediateMessages.find((m) => m.type === 'text')
      if (foundText && 'text' in foundText && typeof (foundText as any).text === 'string') {
        aiText = (foundText as any).text
      }
    }
    if (!aiText) {
      aiText = `สวัสดีครับ ยินดีต้อนรับสู่ ${shop.name || 'ร้านค้า'} ครับ มีอะไรให้แอดมินช่วยดูแลหรือสนใจสอบถามข้อมูลตัวไหนเพิ่มเติมได้เลยนะครับ`
    }

    // 7. Handle Copilot Mode vs Auto Mode
    if (targetAiMode === 'copilot') {
      if (userMsg?.id && aiText) {
        await admin
          .from('chat_messages')
          .update({ ai_suggested_reply: aiText })
          .eq('id', userMsg.id)
      }

      return NextResponse.json({
        status: 'copilot_suggestion_ready',
        conversationId: conv.id,
        psid,
        mode: 'copilot',
        aiMode: 'copilot',
        reply: aiText,
        reply_text: aiText,
        suggestedReply: aiText,
        suggested_reply: aiText,
        toolsExecuted: agentResult.toolCallsExecuted || [],
        messageToAdmin: 'Drafted AI suggestion in Unified Inbox for admin 1-click approval',
      })
    }

    // Auto Mode: record AI response into chat_messages
    if (aiText) {
      await admin.from('chat_messages').insert({
        conversation_id: conv.id,
        shop_id: shop_id,
        sender_type: 'agent',
        sender_name: shop.bot_name || 'น้องบอท Dealmee',
        message: aiText,
        platform: targetPlatform,
      })

      await admin
        .from('conversations')
        .update({
          last_message: aiText,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conv.id)
    }

    return NextResponse.json({
      status: 'auto_reply_completed',
      conversationId: conv.id,
      psid,
      mode: 'auto',
      aiMode: 'auto',
      reply: aiText,
      reply_text: aiText,
      suggestedReply: aiText,
      suggested_reply: aiText,
      toolsExecuted: agentResult.toolCallsExecuted || [],
      productsRecommended: agentResult.productsData?.length || 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Facebook Simulator Error]:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
