import { NextRequest, NextResponse, after } from 'next/server'
import { botMayReplyNow } from '@/lib/shop/businessHours'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { verifyShopeePushSignature } from '@/lib/marketplace/webhookSignature'

const supabase = createAdminClient()

// The platform gets its answer immediately; this bounds the after() AI draft
export const maxDuration = 60

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
    // The signature covers the exact bytes received, so read the body as text first
    const rawText = await req.text()
    let rawBody: any = {}
    try {
      rawBody = JSON.parse(rawText)
    } catch {}

    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .maybeSingle()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Only Shopee, holding the shop's partner key, can produce this signature. Without it
    // anyone with the URL could create conversations and spend the shop's AI quota.
    const partnerKey = String(shop.shopee_partner_key || '').trim()
    if (!partnerKey) {
      console.error(`[Shopee Webhook] Shop ${shop_id} has no Shopee partner key; rejecting unverifiable webhook`)
      return NextResponse.json({ error: 'Shopee app not configured' }, { status: 401 })
    }
    // Shopee signs the callback URL as registered, whichever of our hosts that names
    const path = `${req.nextUrl.pathname}${req.nextUrl.search}`
    const hosts = [req.headers.get('x-forwarded-host'), req.headers.get('host'), req.nextUrl.host]
    const callbackUrls = [
      req.nextUrl.href,
      ...hosts.filter(Boolean).map((h) => `https://${h}${path}`),
      process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}${path}` : '',
      `https://app.dealmee.app${path}`,
    ]
    if (!verifyShopeePushSignature(rawText, req.headers.get('authorization'), partnerKey, callbackUrls)) {
      console.error(`[Shopee Webhook] Invalid signature for shop ${shop_id}`)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Extract message from standard Shopee Open Platform push payload
    const data = rawBody?.data || rawBody
    const senderId = String(data?.from_id || data?.buyer_id || rawBody?.user_id || `shopee-${Date.now()}`)
    const text = String(data?.content?.text || data?.text || data?.message || rawBody?.message || '').trim()

    if (!text) {
      return NextResponse.json({ error: '', message: 'Acknowledged (No text payload)' })
    }

    // Acknowledge right away: the AI draft can take several planning steps, longer
    // than the platform waits for a webhook answer.
    after(async () => {
      try {
        await draftReply({ shop, shopId: shop_id, data, senderId, text })
      } catch (err) {
        console.error('[Shopee Webhook] Background draft failed:', err)
      }
    })

    return NextResponse.json({
      error: '',
      message: 'success',
    })
  } catch (err: any) {
    console.error('[Shopee Webhook Error]:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
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
    console.error('[Shopee Webhook] Failed to create conversation')
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
      platform: 'shopee',
    })
    .select('id')
    .single()

  // The message stays in the Inbox; with AI replies switched off (or the shop open and
  // answering itself) nothing is drafted
  if (shop.features?.auto_reply === false || !botMayReplyNow(shop.features)) return

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
