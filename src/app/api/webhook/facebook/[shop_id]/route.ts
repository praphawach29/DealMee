import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyFacebookSignature,
  sendFacebookMessage,
  sendFacebookTypingIndicator,
  fetchFacebookUserProfile,
} from '@/lib/facebook/messengerHelper'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { incrementUsage } from '@/lib/billing/usage'
import { upsertCustomerProfile } from '@/lib/customerMemory'

const supabase = createAdminClient()

/**
 * Helper to retrieve Facebook Page Access Token, App Secret, and Verify Token
 * Checking both `shops` table and `channel_accounts` table for maximum flexibility.
 */
async function getFacebookCredentials(shopId: string, shop: any) {
  let pageToken = shop.facebook_page_token?.trim() || ''
  let verifyToken = shop.facebook_verify_token?.trim() || ''
  let appSecret = shop.facebook_app_secret?.trim() || ''

  if (!pageToken || !verifyToken) {
    const { data: channelAcc } = await supabase
      .from('channel_accounts')
      .select('credentials, webhook_secret')
      .eq('shop_id', shopId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .maybeSingle()

    if (channelAcc?.credentials) {
      const creds = channelAcc.credentials as Record<string, string>
      if (!pageToken) pageToken = creds.page_access_token || creds.token || ''
      if (!verifyToken) verifyToken = creds.verify_token || channelAcc.webhook_secret || ''
      if (!appSecret) appSecret = creds.app_secret || ''
    }
  }

  return { pageToken, verifyToken, appSecret }
}

/**
 * GET Handler: Facebook Webhook Verification Handshake
 * Meta sends hub.mode, hub.verify_token, and hub.challenge
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const searchParams = req.nextUrl.searchParams

    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (!mode || !token) {
      return new NextResponse('Missing hub.mode or hub.verify_token', { status: 400 })
    }

    // 1. Fetch Shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('id, facebook_verify_token, facebook_page_token')
      .eq('id', shop_id)
      .single()

    if (!shop) {
      console.error(`[Facebook Webhook Verification] Shop ${shop_id} not found`)
      return new NextResponse('Shop not found', { status: 404 })
    }

    const { verifyToken } = await getFacebookCredentials(shop_id, shop)

    // Check subscribe mode and verify token
    if (mode === 'subscribe') {
      // If shop has configured a verify token, ensure it matches
      if (verifyToken && token !== verifyToken) {
        console.warn(`[Facebook Webhook Verification] Token mismatch for shop ${shop_id}. Expected: ${verifyToken}, Received: ${token}`)
        return new NextResponse('Forbidden: Token mismatch', { status: 403 })
      }

      console.log(`[Facebook Webhook Verification] Successfully verified webhook for shop ${shop_id}`)
      return new NextResponse(challenge || '', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return new NextResponse('Forbidden: Invalid mode', { status: 403 })
  } catch (err: any) {
    console.error('[Facebook Webhook GET Error]:', err)
    return new NextResponse(err?.message || 'Internal Server Error', { status: 500 })
  }
}

/**
 * POST Handler: Ingest Facebook Messenger Webhook Events
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const rawBody = await req.text()

    // 1. Fetch Shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single()

    if (!shop) {
      console.error(`[Facebook Webhook POST] Shop ${shop_id} not found`)
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const { pageToken, appSecret } = await getFacebookCredentials(shop_id, shop)

    // 2. Signature verification
    const signature = req.headers.get('x-hub-signature-256')
    if (appSecret) {
      const isValid = verifyFacebookSignature(rawBody, signature, appSecret)
      if (!isValid) {
        console.error(`[Facebook Security] Invalid signature for shop ${shop_id}`)
        return NextResponse.json({ error: 'Unauthorized signature' }, { status: 403 })
      }
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Facebook Webhook structure: object === 'page'
    if (body.object !== 'page') {
      return NextResponse.json({ status: 'ignored_not_page' }, { status: 200 })
    }

    const entries = body.entry || []
    const features = (shop.features as Record<string, boolean>) || {}
    const isAutoReplyEnabled = features.auto_reply !== false

    for (const entry of entries) {
      const messagingList = entry.messaging || []

      for (const event of messagingList) {
        // Skip message echoes (sent by page) or delivery confirmations
        if (event.message?.is_echo || event.delivery || event.read) {
          continue
        }

        const senderPsid = event.sender?.id
        const recipientPageId = event.recipient?.id
        const messageText = event.message?.text

        if (!senderPsid || !messageText) {
          continue
        }

        const cleanText = messageText.trim()

        // 3. Find or Create Conversation
        let { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('platform', 'facebook')
          .eq('user_id', senderPsid)
          .maybeSingle()

        if (!conv) {
          // Attempt to fetch Facebook user profile
          const profile = await fetchFacebookUserProfile(senderPsid, pageToken)

          const { data: newConv, error: convCreateError } = await supabase
            .from('conversations')
            .insert({
              shop_id,
              user_id: senderPsid,
              platform_sender_id: senderPsid,
              channel_account_id: recipientPageId || shop.facebook_page_id || null,
              customer_name: profile.name,
              customer_avatar: profile.profile_pic || null,
              platform: 'facebook',
              last_message: cleanText,
              status: 'ai',
              ai_mode: 'auto',
            })
            .select()
            .single()

          if (convCreateError || !newConv) {
            console.error('[Facebook Webhook] Error creating conversation:', convCreateError)
            continue
          }
          conv = newConv
        } else {
          await supabase
            .from('conversations')
            .update({
              last_message: cleanText,
              last_message_at: new Date().toISOString(),
            })
            .eq('id', conv.id)
        }

        if (!conv) continue

        // 4. Update Customer Memory Profile
        await upsertCustomerProfile(shop_id, senderPsid, conv.customer_name)

        // 5. Save incoming message into chat_messages
        const { data: savedUserMsg } = await supabase
          .from('chat_messages')
          .insert({
            conversation_id: conv.id,
            shop_id,
            sender_type: 'user',
            sender_name: conv.customer_name || 'ลูกค้า Facebook',
            message: cleanText,
            platform: 'facebook',
            platform_message_id: event.message?.mid || null,
          })
          .select('id')
          .single()

        // 6. Check for Pause/Admin Commands
        const lowerText = cleanText.toLowerCase()
        const isPauseCommand =
          ['/pause', '/stop', '/admin', '/human'].includes(lowerText) ||
          cleanText === 'ขอคุยกับแอดมิน' ||
          cleanText === 'ขอคุยกับเจ้าหน้าที่' ||
          cleanText === 'ติดต่อเจ้าหน้าที่'

        if (isPauseCommand) {
          console.log(`[Facebook Webhook] Explicit pause command detected for PSID: ${senderPsid}`)
          const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
          await supabase
            .from('conversations')
            .update({ status: 'human', paused_until: pausedUntil })
            .eq('id', conv.id)

          if (pageToken) {
            await sendFacebookMessage(
              senderPsid,
              'รับเรื่องเรียบร้อยแล้วค่ะ น้องบอทได้หยุดการตอบชั่วคราวและประสานงานเจ้าหน้าที่แอดมินให้แล้วนะคะ สักครู่จะมีเจ้าหน้าที่เข้ามาดูแลค่ะ 😊',
              pageToken
            )
          }
          continue
        }

        // 7. Check if Admin Takeover is active
        if (conv.status === 'human') {
          const now = new Date()
          const isPauseExpired = conv.paused_until
            ? now > new Date(conv.paused_until)
            : (conv.last_message_at ? now.getTime() - new Date(conv.last_message_at).getTime() > 60 * 60 * 1000 : true)
          const isExplicitReset = cleanText.startsWith('/ai') || isPauseExpired

          if (isExplicitReset) {
            console.log(`[Facebook Webhook] Auto-resuming AI mode for PSID ${senderPsid}`)
            await supabase.from('conversations').update({ status: 'ai', paused_until: null }).eq('id', conv.id)
            conv.status = 'ai'
            if (cleanText.startsWith('/ai') && pageToken) {
              await sendFacebookMessage(
                senderPsid,
                'น้องบอท AI กลับมาพร้อมดูแลคุณลูกค้าต่อแล้วค่ะ มีอะไรให้ช่วยสอบถามได้เลยนะคะ ✨',
                pageToken
              )
              continue
            }
          } else {
            console.log(`[Facebook Webhook] Skipping AI reply for PSID ${senderPsid} (Admin Takeover active)`)
            continue
          }
        }

        if (!isAutoReplyEnabled) {
          console.log(`[Facebook Webhook] Skipping AI reply for shop ${shop_id} (Auto-Reply disabled)`)
          continue
        }

        // 8. Send Typing Indicator (non-blocking)
        if (pageToken) {
          sendFacebookTypingIndicator(senderPsid, pageToken, 'typing_on').catch(() => {})
        }

        // 9. Call AI Sales Agent Engine
        const agentResult = await processSalesAgentChat({
          shop,
          userQuery: cleanText,
          userId: senderPsid,
          conversationId: conv.id,
          supabaseClient: supabase,
        })

        const aiReplyText = agentResult?.text?.trim() || ''

        // 10. Check conversation ai_mode:
        // - 'copilot': Save draft suggestion in chat_messages for admin approval
        // - 'auto': Deliver response to Facebook user via Graph API
        // - 'manual': Skip sending
        if (conv.ai_mode === 'copilot') {
          console.log(`[Facebook Webhook] Conversation in Copilot mode for ${senderPsid}. Saving draft suggestion.`)
          if (savedUserMsg?.id && aiReplyText) {
            await supabase
              .from('chat_messages')
              .update({
                ai_suggested_reply: aiReplyText,
              })
              .eq('id', savedUserMsg.id)
          }
          continue
        }

        if (conv.ai_mode === 'auto' && aiReplyText) {
          // Save AI reply message in database
          await supabase.from('chat_messages').insert({
            conversation_id: conv.id,
            shop_id,
            sender_type: 'agent',
            sender_name: shop.bot_name || 'น้องบอท Dealmee',
            message: aiReplyText,
            platform: 'facebook',
          })

          // Update conversation last message
          await supabase
            .from('conversations')
            .update({
              last_message: aiReplyText,
              last_message_at: new Date().toISOString(),
            })
            .eq('id', conv.id)

          // Deliver reply to customer on Facebook
          if (pageToken) {
            await sendFacebookMessage(senderPsid, aiReplyText, pageToken)
          }

          // Bill message usage
          incrementUsage(shop_id, { totalTokens: agentResult.usage?.totalTokens || 0 }).catch((err) =>
            console.error('[Billing Usage Error]:', err)
          )
          if (agentResult.usage) {
            const { incrementProviderUsage } = await import('@/lib/billing/usage')
            incrementProviderUsage(shop_id, agentResult.usage).catch((err) =>
              console.error('[Provider Usage Error]:', err)
            )
          }
        }
      }
    }

    // Always respond with 200 OK EVENT_RECEIVED to acknowledge Meta webhook
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 })
  } catch (error: any) {
    console.error('[Facebook Webhook Error]:', error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
