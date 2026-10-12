import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { upsertCustomerProfile } from '@/lib/customerMemory'

const supabase = createAdminClient()

/**
 * Shopee Open Platform Webhook Handler
 * Endpoint: /api/webhook/shopee/[shop_id]
 *
 * Shopee Chat requires high Chat Response Rate (CRR > 85%) for Preferred Sellers.
 * DealMee automatically ingests buyer messages, reasons about products/order,
 * drafts a high-quality Thai reply, and lets the merchant approve in 1 click!
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  // Shopee Webhook validation handshake
  return NextResponse.json({ status: 'ok', message: 'Shopee Webhook active' })
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

    // Extract message from standard Shopee Open Platform push payload
    const data = rawBody?.data || rawBody
    const senderId = String(data?.from_id || data?.buyer_id || rawBody?.user_id || `shopee-${Date.now()}`)
    const text = String(data?.content?.text || data?.text || data?.message || rawBody?.message || '').trim()

    if (!text) {
      return NextResponse.json({ error: '', message: 'Acknowledged (No text payload)' })
    }

    // 1. Find or create conversation with ai_mode = 'copilot'
    let { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('shop_id', shop_id)
      .eq('platform', 'shopee')
      .eq('user_id', senderId)
      .maybeSingle()

    const customerName = data?.from_name || `ลูกค้า Shopee (${senderId.slice(-4)})`

    if (!conv) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          shop_id: shop_id,
          user_id: senderId,
          platform_sender_id: senderId,
          channel_account_id: shop.shopee_shop_id || 'shopee-shop',
          customer_name: customerName,
          platform: 'shopee',
          status: 'ai',
          ai_mode: 'copilot', // Shopee policy safe mode
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
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
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
        platform: 'shopee',
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

    return NextResponse.json({
      error: '',
      message: 'success',
      suggested_reply: suggestedText,
    })
  } catch (err: any) {
    console.error('[Shopee Webhook Error]:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
