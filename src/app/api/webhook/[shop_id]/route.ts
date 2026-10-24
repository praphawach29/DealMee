import { NextRequest, NextResponse, after } from 'next/server'
import { botMayReplyNow } from '@/lib/shop/businessHours'
import { notifyQuotaExhausted } from '@/lib/billing/ownerAlerts'
import { linkPlatformOwnerFromShopOa } from '@/lib/billing/platformLineAlerts'
import { adminPausePayload, isPauseExpired, resumePayload } from '@/lib/inbox/adminPause'
import { verifyLineSignature } from '@/lib/line/signature'
import { processSalesAgentChat, type AgentResult } from '@/lib/ai/salesAgentEngine'
import { incrementUsage, incrementProviderUsage } from '@/lib/billing/usage'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { buildAutoGreeting, isDefaultGreeting } from '@/lib/businessGreeting'
import { synthesizeFaqFromConversation } from '@/lib/ai/faqSynthesis'
import { scheduleCustomerMessage } from '@/lib/ai/proactiveFollowUp'

import { createAdminClient } from '@/lib/supabase/admin'
import { buildLineFlexProductCarousel } from '@/lib/line/flexHelper'
import {
  isKeywordProductQuery,
  isProductCardSuppressed,
  mergeProductCards,
  resolveChannelProductCards,
} from '@/lib/ai/productCards'
import { settleSlipImage } from '@/lib/slip/settleSlip'

const supabase = createAdminClient()

// LINE gets its 200 immediately; this bounds the after() work (AI planning, slip checks)
export const maxDuration = 60

async function buildFollowGreeting(shop: any) {
  if (!isDefaultGreeting(shop.greeting_message)) return shop.greeting_message

  const { data: templates } = await supabase
    .from('services')
    .select('name, booking_type, resource_label, staff_name')
    .eq('shop_id', shop.id)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })
    .limit(8)

  return buildAutoGreeting(shop, templates || [])
}

export async function GET() {
  return new NextResponse('LINE Webhook Endpoint Active', { status: 200 })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
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

    const lineToken = shop.line_token ? shop.line_token.trim() : undefined
    const lineSecret = shop.line_secret ? shop.line_secret.trim() : undefined
    const features = (shop.features as Record<string, boolean>) || {}
    // Off when switched off, or while the shop is open and answers customers itself (business hours)
    const autoReplySwitchedOff = features.auto_reply === false
    const mutedByBusinessHours = !autoReplySwitchedOff && !botMayReplyNow(features)
    const isAutoReplyEnabled = !autoReplySwitchedOff && !mutedByBusinessHours

    // Reject when the shop has no Channel Secret or the signature does not match.
    // A missing secret used to log a warning and still run the bot.
    const lineSignature = req.headers.get('x-line-signature') || ''
    if (!lineSecret || !verifyLineSignature(rawBody, lineSignature, lineSecret)) {
      console.error(`[Security] Missing or invalid LINE signature for shop ${shop_id}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Answer LINE right away and do the real work afterwards. The AI can take several
    // planning steps; holding the webhook open that long made LINE time out and redeliver.
    after(async () => {
      try {
        await processLineEvents({ events, shop, shopId: shop_id, lineToken, features, isAutoReplyEnabled, mutedByBusinessHours })
      } catch (err) {
        console.error('[LINE Webhook] Background processing failed:', err)
      }
    })

    return NextResponse.json({ status: 'success' })
  } catch (error: any) {
    console.error('[LINE Webhook Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── Event processing (runs in after(), once LINE has its 200) ────────────────

async function processLineEvents({
  events, shop, shopId: shop_id, lineToken, features, isAutoReplyEnabled, mutedByBusinessHours,
}: {
  events: any[]
  shop: Record<string, any>
  shopId: string
  lineToken: string | undefined
  features: Record<string, boolean>
  isAutoReplyEnabled: boolean
  mutedByBusinessHours: boolean
}) {
  // Process each LINE event
  for (const event of events) {
    const userId = event.source?.userId
    const replyToken = event.replyToken

    if (!userId) continue

    // LINE redelivers an event when a webhook answers slowly or fails; without this the
    // same message could create a second order, QR or quotation.
    if (!(await claimWebhookEvent(event.webhookEventId, shop_id))) {
      console.log(`[Webhook] Skipping already-processed LINE event ${event.webhookEventId}`)
      continue
    }

    // Handle Follow Event (Add Friend)
    if (event.type === 'follow') {
      const greeting = await buildFollowGreeting(shop)
      if (replyToken && lineToken) {
        await sendLineReply(replyToken, greeting, lineToken)
      }
      continue
    }

    // Handle Message Event (Text)
    if (event.type === 'message' && event.message?.type === 'text') {
      const userText = event.message.text

      // 2. Find or Create Conversation
      let { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('shop_id', shop_id)
        .eq('platform', 'line')
        .eq('user_id', userId)
        .maybeSingle()

      if (!conv) {
        const { data: legacyConv } = await supabase
          .from('conversations')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (legacyConv) conv = legacyConv
      }

      if (!conv) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            shop_id,
            user_id: userId,
            platform_sender_id: userId,
            customer_name: `ลูกค้า LINE (${userId.substring(0, 6)})`,
            platform: 'line',
            last_message: userText,
            status: 'ai',
            ai_mode: 'auto',
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

      // Customer Memory Graph: create/touch the durable cross-conversation
      // profile for this customer before anything else runs, so it's
      // guaranteed to exist by the time any tool call below needs it.
      await upsertCustomerProfile(shop_id, userId, conv.customer_name)

      // 3. Save incoming customer message to chat_messages
      const { data: savedUserMsg } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conv.id,
          shop_id,
          sender_type: 'user',
          sender_name: 'ลูกค้า',
          message: userText,
          platform: 'line',
        })
        .select('id')
        .single()

      // 4. Check if Admin Takeover is active OR Auto-Reply is disabled
      const cleanText = userText.trim()
      const lowerText = cleanText.toLowerCase()

      // 3.1 Handle Admin Instant Linking Command (e.g. /admin-link ADM-123456)
      if (cleanText.startsWith('/admin-link') || cleanText.startsWith('/link-admin')) {
        const parts = cleanText.split(/\s+/)
        const code = parts[1]?.trim()
        const expectedCode = shop.features?.admin_link_code

        if (expectedCode && code && code.toUpperCase() === String(expectedCode).toUpperCase()) {
          let adminName = 'แอดมิน'
          if (lineToken) {
            try {
              const pRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
                headers: { Authorization: `Bearer ${lineToken}` },
              })
              if (pRes.ok) {
                const pData = await pRes.json()
                if (pData.displayName) adminName = pData.displayName
              }
            } catch {}
          }

          const updatedFeatures = {
            ...((shop.features as Record<string, any>) || {}),
            admin_line_user_id: userId,
            admin_line_name: adminName,
            admin_notify: true,
            admin_link_code: null,
          }

          await supabase
            .from('shops')
            .update({
              owner_line_id: userId,
              features: updatedFeatures,
              updated_at: new Date().toISOString(),
            })
            .eq('id', shop_id)

          if (replyToken && lineToken) {
            await sendLineReply(
              replyToken,
              `🎉 ยืนยันเชื่อมต่อแอดมินสำเร็จแล้วค่ะคุณ ${adminName}!\n\nระบบ DealMee ได้ผูกบัญชี LINE นี้เป็นแอดมินของร้าน "${shop.name || 'ร้านค้า'}" เรียบร้อยแล้วค่ะ\n\nต่อไปนี้น้องบอทจะส่งแจ้งเตือนมาที่นี่ทันทีเมื่อมี:\n• ออเดอร์ใหม่เข้ามา 🛒\n• ลูกค้าชำระเงิน / ตรวจสลิป 💰\n• ตรวจพบสลิปผิดปกติ ⚠️\n• ลูกค้าขอคุยกับแอดมิน 🔔`,
              lineToken
            )
          }
          continue
        } else {
          // The platform's own OA may run as this shop: its owner-link code (DM-…) lands here
          const platformName = code ? await linkPlatformOwnerFromShopOa(lineToken, code, userId) : null
          if (platformName) {
            if (replyToken && lineToken) {
              await sendLineReply(
                replyToken,
                `✅ ผูกบัญชีสำเร็จ คุณ ${platformName}\n\nต่อไปนี้ LINE นี้จะได้รับแจ้งเตือนจาก DealMee เมื่อ:\n• ร้านค้าเติมเงินสำเร็จ 💰\n• มีสลิปเติมเงินรอตรวจ ⏳`,
                lineToken
              )
            }
            continue
          }
          if (replyToken && lineToken) {
            await sendLineReply(
              replyToken,
              '❌ รหัสเชื่อมต่อแอดมินไม่ถูกต้อง หรือหมดอายุแล้วค่ะ\nกรุณากดรับรหัสหรือสแกน QR Code ใหม่จากหน้า Dashboard ตั้งค่าร้านค้านะคะ 🙏',
              lineToken
            )
          }
          continue
        }
      }

      const isPauseCommand = ['/pause', '/stop', '/admin', '/human'].includes(lowerText) ||
        cleanText === 'ขอคุยกับแอดมิน' || cleanText === 'ขอคุยกับเจ้าหน้าที่' || cleanText === 'ติดต่อเจ้าหน้าที่'

      if (isPauseCommand) {
        console.log(`[Webhook] Explicit pause command detected for ${userId}`)
        await supabase.from('conversations').update(adminPausePayload()).eq('id', conv.id)
        if (replyToken && lineToken) {
          await sendLineReply(replyToken, 'รับเรื่องเรียบร้อยแล้วค่ะ น้องบอทได้หยุดการตอบชั่วคราวและประสานงานเจ้าหน้าที่แอดมินให้แล้วนะคะ สักครู่จะมีเจ้าหน้าที่เข้ามาดูแลค่ะ 😊', lineToken)
        }
        continue
      }

      if (conv.status === 'human') {
        // Hand the chat back once the admin's hour is up (the cron does the same for
        // chats whose customer never writes again)
        const isExplicitReset = cleanText.startsWith('/ai') || (await isPauseExpired(supabase, conv))

        if (isExplicitReset) {
          console.log(`[Webhook] Auto-resuming AI mode for ${userId} (1-Hour Auto-Pause expired or explicit reset)`)
          await supabase.from('conversations').update(resumePayload()).eq('id', conv.id)
          conv.status = 'ai'
          conv.ai_mode = 'auto'
          if (cleanText.startsWith('/ai') && replyToken && lineToken) {
            await sendLineReply(replyToken, 'น้องบอท AI กลับมาพร้อมดูแลคุณลูกค้าต่อแล้วค่ะ มีอะไรให้ช่วยสอบถามได้เลยนะคะ ✨', lineToken)
            continue
          }
        } else {
          console.log(`[Webhook] Skipping AI reply for ${userId} (Admin Takeover active)`)
          continue
        }
      }

      if (!isAutoReplyEnabled) {
        // Two very different reasons: the owner switched the bot off, or the shop is open
        // and answers customers itself. Saying which one saves an hour of guessing.
        const why = mutedByBusinessHours
          ? 'bot set to reply outside business hours only, and the shop is open now'
          : 'Auto-Reply switched off in settings'
        console.log(`[Webhook] Skipping AI reply for shop ${shop_id} (${why})`)
        continue
      }

      // 5. Call AI Sales Agent Engine (runs all planning steps including tool calls)
      // with LINE's loading animation showing until the answer is ready
      const agentResult = await withLineLoading(userId, lineToken, () =>
        processSalesAgentChat({
          shop,
          userQuery: userText,
          userId,
          conversationId: conv.id,
          supabaseClient: supabase,
        })
      )

      // If in Copilot mode: do not send to user directly, instead save as ai_suggested_reply
      if (conv.ai_mode === 'copilot') {
        console.log(`[Webhook] Conversation is in Copilot mode for ${userId}. Saving draft suggestion.`)
        if (savedUserMsg?.id && agentResult.text) {
          await supabase.from('chat_messages').update({
            ai_suggested_reply: agentResult.text,
          }).eq('id', savedUserMsg.id)
        }
        continue
      }

      await deliverAgentResult({
        agentResult,
        conv,
        shop,
        shopId: shop_id,
        userId,
        userText,
        lineToken,
        replyToken,
        useReplyForText: true,
      })
    }

    // Handle Message Event (Image) - For Slip Verification
    if (event.type === 'message' && event.message?.type === 'image') {
      const messageId = event.message.id
      console.log(`[Webhook] Received image ${messageId} from ${userId}`)

      const isSlipVerifyActive = features.slip_verify !== false
      if (isSlipVerifyActive) {
        if (replyToken && lineToken) {
          await sendLineReply(replyToken, 'ได้รับรูปแล้วค่ะ 📄 รอสักครู่นะคะ...', lineToken)
        }
        if (lineToken) {
          await withLineLoading(userId, lineToken, () =>
            verifySlipAndNotify({ messageId, userId, lineToken, shopId: shop_id, shop })
          ).catch(err => console.error('[SlipVerify Error]', err))
        }
      } else {
        if (replyToken && lineToken) {
          await sendLineReply(replyToken, 'ได้รับรูปภาพเรียบร้อยแล้วค่ะ แอดมินจะเข้ามาตรวจสอบให้นะคะ 😊', lineToken)
        }
      }
    }
  }
}

// ─── Deliver a finished AgentResult (sync or from a background continuation) ──

/**
 * Saves the AI's reply + tool log to chat_messages, updates the
 * conversation, and delivers everything to LINE — shared by both the
 * single-step sync path (reply via replyToken) and the multi-step async
 * path (push via userId, since the replyToken was already spent on the ack).
 */
async function deliverAgentResult({
  agentResult, conv, shop, shopId, userId, userText, lineToken, replyToken, useReplyForText,
}: {
  agentResult: AgentResult
  conv: { id: string }
  shop: Record<string, any>
  shopId: string
  userId: string
  userText?: string
  lineToken: string | undefined
  replyToken: string | undefined
  useReplyForText: boolean
}) {
  const aiReplyText = agentResult.text || ''
  const features = (shop.features as Record<string, any>) || {}

  if (aiReplyText) {
    await supabase.from('chat_messages').insert({
      conversation_id: conv.id,
      shop_id: shopId,
      sender_type: 'bot',
      sender_name: (shop.bot_name && !/botify/i.test(shop.bot_name)) ? shop.bot_name : 'น้อง DealMee',
      message: aiReplyText,
      platform: 'line',
    })
  }

  const updatePayload: Record<string, any> = {
    last_message: aiReplyText || '[ส่ง QR Code]',
    last_message_at: new Date().toISOString(),
  }
  if (agentResult.salesStage) {
    updatePayload.sales_stage = agentResult.salesStage
  }

  await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', conv.id)

  // Trigger Hermes-inspired FAQ synthesis in background if human handover was requested
  const hasHumanHandover = agentResult.toolCallsExecuted.some((t) => t.name === 'request_human_agent')
  if (hasHumanHandover) {
    synthesizeFaqFromConversation({ shopId, conversationId: conv.id }).catch((err) =>
      console.error('[Webhook] Background FAQ synthesis error:', err)
    )
  }

  // One LINE Flex carousel: catalog rows from search_products / check_stock, or the
  // keyword fallback when those tools returned nothing. Never both in one reply.
  const toolNames = (agentResult.toolCallsExecuted || []).map((t) => t.name)
  const suppressProductCards =
    features.product_recommend === false || isProductCardSuppressed(userText, toolNames)
  const toolCards = suppressProductCards ? [] : mergeProductCards([], agentResult.productsData)
  let keywordCatalog: unknown[] = []
  if (!suppressProductCards && toolCards.length === 0 && lineToken && isKeywordProductQuery(userText)) {
    const { data: shopProducts } = await supabase
      .from('products')
      .select('id, name, price, stock, category, description, image_url')
      .eq('shop_id', shopId)
      .limit(10)
    keywordCatalog = shopProducts || []
  }
  const flexProducts = resolveChannelProductCards({
    suppress: suppressProductCards,
    toolProducts: agentResult.productsData,
    userText,
    catalogProducts: keywordCatalog,
  })

  const flexMsg = flexProducts.length > 0 ? buildLineFlexProductCarousel(flexProducts) : null

  // Bundle text, Flex Carousel, and any immediate Tool Messages (e.g. Quotation Flex Card) into single Reply API call (Zero Push Quota used)
  let immediateMessagesDelivered = false
  if (lineToken) {
    if (useReplyForText && replyToken) {
      const replyPayload: any[] = []
      if (aiReplyText) replyPayload.push({ type: 'text', text: aiReplyText })
      if (flexMsg) replyPayload.push(flexMsg)
      if (agentResult.immediateMessages && agentResult.immediateMessages.length > 0) {
        for (const im of agentResult.immediateMessages) {
          if (im.type === 'flex' && im.flexData) {
            replyPayload.push(im.flexData)
          } else if (im.type === 'image') {
            replyPayload.push({
              type: 'image',
              originalContentUrl: im.content,
              previewImageUrl: im.content,
            })
          } else if (im.type === 'text') {
            replyPayload.push({ type: 'text', text: im.content })
          }
        }
        immediateMessagesDelivered = true
      }

      if (replyPayload.length > 0) {
        // The Reply API rejects the whole call above 5 messages, so the customer got nothing
        const firstBatch = replyPayload.slice(0, LINE_MAX_MESSAGES_PER_CALL)
        if (!(await sendLineReply(replyToken, firstBatch, lineToken))) {
          // Reply tokens expire; a long AI run can outlive one, so push instead of going silent
          await sendLinePushMessages(userId, firstBatch, lineToken)
        }
        for (let i = LINE_MAX_MESSAGES_PER_CALL; i < replyPayload.length; i += LINE_MAX_MESSAGES_PER_CALL) {
          await sendLinePushMessages(userId, replyPayload.slice(i, i + LINE_MAX_MESSAGES_PER_CALL), lineToken)
        }
      }
    } else {
      // Fallback Push API if replyToken was already spent
      if (aiReplyText) {
        await sendLinePush(userId, aiReplyText, lineToken)
      }
      if (flexMsg) {
        await sendLineFlexPush(userId, flexMsg, lineToken)
      }
      if (agentResult.immediateMessages && agentResult.immediateMessages.length > 0) {
        for (const im of agentResult.immediateMessages) {
          if (im.type === 'flex' && im.flexData) {
            await sendLineFlexPush(userId, im.flexData, lineToken)
          } else if (im.type === 'image') {
            await sendLineImagePush(userId, im.content, lineToken)
          } else if (im.type === 'text') {
            await sendLinePush(userId, im.content, lineToken)
          }
        }
        immediateMessagesDelivered = true
      }
    }
  }

  // Skip tool logging + usage increment entirely if the AI never actually
  // ran (quota exceeded) — the customer already got the quota message above.
  if (agentResult.quotaExceeded) {
    await notifyQuotaExhausted(shop).catch((err) => console.error('[Webhook] quota alert failed:', err))
    return
  }

  if (agentResult.usage) {
    incrementUsage(shopId, agentResult.usage).catch((err) =>
      console.error('[Webhook] incrementUsage failed:', err)
    )
    incrementProviderUsage(shopId, agentResult.usage).catch((err) =>
      console.error('[Webhook] incrementProviderUsage failed:', err)
    )
  }

  // Tool execution happens INSIDE the Planning Layer (src/lib/ai/toolDispatcher.ts's
  // executeTool(), called possibly multiple times per customer message) —
  // this function's job is just to log what ran and deliver the results.
  // log tool calls to server console only, DO NOT store internal tool code in chat_messages table.
  for (const toolCall of agentResult.toolCallsExecuted) {
    console.log(`[Webhook] AI executed tool: ${toolCall.name}`, toolCall.args)
  }

  if (!immediateMessagesDelivered && lineToken) {
    for (const msg of agentResult.immediateMessages) {
      if (msg.type === 'image') {
        await sendLineImagePush(userId, msg.content, lineToken)
      } else if (msg.type === 'flex' && msg.flexData) {
        await sendLineFlexPush(userId, msg.flexData, lineToken)
      } else {
        await sendLinePush(userId, msg.content, lineToken)
      }
    }
  }

  // Queued in follow_up_tasks rather than setTimeout: a serverless function is frozen as
  // soon as the webhook responds, so in-memory timers never fired.
  for (const scheduled of agentResult.scheduledMessages) {
    await scheduleCustomerMessage({
      shopId,
      conversationId: conv.id,
      userId,
      message: scheduled.message.content,
      delayMs: scheduled.delayMs,
    })
  }
}

// ─── Slip Verification (supports EasySlip, Thunder Solution, SlipOK, Mock) ────

async function verifySlipAndNotify({
  messageId, userId, lineToken, shopId, shop,
}: {
  messageId: string
  userId: string
  lineToken: string
  shopId: string
  shop: Record<string, any>
}) {
  try {
    const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken}` },
    })
    if (!imageRes.ok) {
      console.error('[SlipVerify] Failed to download image:', await imageRes.text())
      await sendLinePush(userId, '❌ ไม่สามารถดาวน์โหลดรูปสลิปได้ค่ะ กรุณาส่งใหม่อีกครั้งนะคะ', lineToken)
      return
    }
    await settleSlipImage({
      shop,
      shopId,
      platform: 'line',
      userId,
      image: {
        base64: Buffer.from(await imageRes.arrayBuffer()).toString('base64'),
        mimeType: imageRes.headers.get('content-type') || 'image/jpeg',
      },
      imageRef: messageId,
      sendToCustomer: (text) => sendLinePush(userId, text, lineToken),
    })
  } catch (err) {
    console.error('[SlipVerify Exception]:', err)
    await sendLinePush(userId, '❌ ระบบตรวจสลิปขัดข้องชั่วคราวค่ะ กรุณาแจ้งแอดมินนะคะ 🙏', lineToken)
  }
}

const LINE_MAX_MESSAGES_PER_CALL = 5

/**
 * Records a LINE webhookEventId; returns false when it was already processed.
 * Fails open (returns true) if the table is missing or the insert errors for any
 * other reason, so a database problem never silences the bot.
 */
async function claimWebhookEvent(eventId: string | undefined, shopId: string): Promise<boolean> {
  if (!eventId) return true
  const { error } = await supabase.from('processed_webhook_events').insert({ event_id: eventId, shop_id: shopId })
  if (!error) return true
  if (error.code === '23505') return false
  console.warn('[Webhook] Could not record webhook event (dedupe skipped):', error.message)
  return true
}

/** Push several message objects in one call (max 5) */
async function sendLinePushMessages(to: string, messages: any[], channelAccessToken: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ to, messages }),
    })
    if (!res.ok) {
      console.error('[LINE Push API Error]:', await res.text())
    }
  } catch (err) {
    console.error('[LINE Push Exception]:', err)
  }
}

// ─── LINE Messaging Helpers ───────────────────────────────────────────────────

/**
 * Send Reply via LINE Reply API (1 replyToken = 1 use only, up to 5 message objects per replyToken, consuming ZERO push quota).
 * Returns false when LINE rejected the reply (e.g. an expired token).
 */
async function sendLineReply(replyToken: string, payload: string | any[], channelAccessToken: string): Promise<boolean> {
  try {
    const rawMessages = typeof payload === 'string' ? [{ type: 'text', text: payload }] : payload
    const messages = (rawMessages || []).filter(Boolean)
    if (messages.length === 0) return true

    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    })
    if (!res.ok) {
      console.error('[LINE Reply API Error]:', await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[LINE Reply Exception]:', err)
    return false
  }
}

/** Send Push Text Message via LINE Push API */
async function sendLinePush(to: string, text: string, channelAccessToken: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    })
    if (!res.ok) {
      console.error('[LINE Push API Error]:', await res.text())
    }
  } catch (err) {
    console.error('[LINE Push Exception]:', err)
  }
}

/** Send Image Message via LINE Push API (requires public HTTPS image URL) */
async function sendLineImagePush(to: string, imageUrl: string, channelAccessToken: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: 'image',
            originalContentUrl: imageUrl,
            previewImageUrl: imageUrl,
          },
        ],
      }),
    })
    if (!res.ok) {
      console.error('[LINE Image Push Error]:', await res.text())
    }
  } catch (err) {
    console.error('[LINE Image Push Exception]:', err)
  }
}

const LINE_LOADING_SECONDS = 20

/**
 * Runs `work` with LINE's loading animation showing. The animation lasts at most
 * LINE_LOADING_SECONDS, so it is restarted shortly before it runs out; LINE also
 * hides it as soon as a message reaches the chat.
 */
async function withLineLoading<T>(chatId: string, channelAccessToken: string | undefined, work: () => Promise<T>): Promise<T> {
  if (!channelAccessToken) return work()
  sendLineLoadingAnimation(chatId, channelAccessToken).catch(() => {})
  const timer = setInterval(() => {
    sendLineLoadingAnimation(chatId, channelAccessToken).catch(() => {})
  }, (LINE_LOADING_SECONDS - 5) * 1000)
  try {
    return await work()
  } finally {
    clearInterval(timer)
  }
}

/** Start LINE Chat Loading Animation (Thinking Indicator) */
async function sendLineLoadingAnimation(chatId: string, channelAccessToken: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        chatId,
        loadingSeconds: LINE_LOADING_SECONDS,
      }),
    })
    if (!res.ok) {
      console.log('[LINE Loading Animation Note]:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[LINE Loading Animation Exception]:', err)
  }
}

/** Send LINE Flex Message (Product Carousel / Rich Cards) via LINE Push API */
async function sendLineFlexPush(to: string, flexObject: any, channelAccessToken: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [flexObject],
      }),
    })
    if (!res.ok) {
      console.error('[LINE Flex Push Error]:', await res.text())
    }
  } catch (err) {
    console.error('[LINE Flex Push Exception]:', err)
  }
}
