import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { processSalesAgentChat, type AgentResult } from '@/lib/ai/salesAgentEngine'
import { incrementUsage, incrementProviderUsage } from '@/lib/billing/usage'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { buildAutoGreeting, isDefaultGreeting } from '@/lib/businessGreeting'
import { synthesizeFaqFromConversation } from '@/lib/ai/faqSynthesis'
import { cancelFollowUpTasks, scheduleRepurchaseFollowUp, scheduleCustomerMessage } from '@/lib/ai/proactiveFollowUp'
import { extractGoldenTrajectoryFromOrder } from '@/lib/ai/salesTrajectory'

import { createAdminClient } from '@/lib/supabase/admin'
import { buildLineFlexProductCarousel } from '@/lib/line/flexHelper'
import { verifySlip } from '@/lib/slip/verifySlip'

const supabase = createAdminClient()

// ─── LINE Signature Verification ─────────────────────────────────────────────
function verifyLineSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  const cleanSecret = secret.trim()
  const cleanSignature = signature.trim()
  const hash = createHmac('SHA256', cleanSecret).update(rawBody).digest('base64')
  return hash === cleanSignature
}


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
    const isAutoReplyEnabled = features.auto_reply !== false

    // 2. Verify LINE Signature (reject fake webhooks)
    const lineSignature = req.headers.get('x-line-signature') || ''
    if (lineSecret && lineSignature) {
      const isValid = verifyLineSignature(rawBody, lineSignature, lineSecret)
      if (!isValid) {
        console.error(`[Security] Invalid LINE signature for shop ${shop_id}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Process each LINE event
    for (const event of events) {
      const userId = event.source?.userId
      const replyToken = event.replyToken

      if (!userId) continue

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
        const isPauseCommand = ['/pause', '/stop', '/admin', '/human'].includes(lowerText) ||
          cleanText === 'ขอคุยกับแอดมิน' || cleanText === 'ขอคุยกับเจ้าหน้าที่' || cleanText === 'ติดต่อเจ้าหน้าที่'

        if (isPauseCommand) {
          console.log(`[Webhook] Explicit pause command detected for ${userId}`)
          const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
          await supabase.from('conversations').update({ 
            status: 'human', 
            ai_mode: 'manual', 
            paused_until: pausedUntil 
          }).eq('id', conv.id)
          if (replyToken && lineToken) {
            await sendLineReply(replyToken, 'รับเรื่องเรียบร้อยแล้วค่ะ น้องบอทได้หยุดการตอบชั่วคราวและประสานงานเจ้าหน้าที่แอดมินให้แล้วนะคะ สักครู่จะมีเจ้าหน้าที่เข้ามาดูแลค่ะ 😊', lineToken)
          }
          continue
        }

        if (conv.status === 'human') {
          // Check if Smart Auto-Pause timer (1 hour) has expired OR if last chat was >1 hour ago (e.g. overnight)
          const now = new Date()
          const isPauseExpired = conv.paused_until
            ? now > new Date(conv.paused_until)
            : (conv.last_message_at ? (now.getTime() - new Date(conv.last_message_at).getTime() > 60 * 60 * 1000) : true)
          const isExplicitReset = cleanText.startsWith('/ai') || isPauseExpired

          if (isExplicitReset) {
            console.log(`[Webhook] Auto-resuming AI mode for ${userId} (1-Hour Auto-Pause expired or explicit reset)`)
            await supabase.from('conversations').update({ 
              status: 'ai', 
              ai_mode: 'auto', 
              paused_until: null 
            }).eq('id', conv.id)
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
          console.log(`[Webhook] Skipping AI reply for shop ${shop_id} (Auto-Reply feature disabled)`)
          continue
        }

        // Show LINE thinking / loading animation immediately while AI generates response
        if (lineToken) {
          sendLineLoadingAnimation(userId, lineToken).catch(() => {})
        }

        // 5. Call AI Sales Agent Engine (Synchronous execution — runs all planning steps
        // including tool calls and returns final answer, while LINE Thinking Indicator is active)
        const agentResult = await processSalesAgentChat({
          shop,
          userQuery: userText,
          userId,
          conversationId: conv.id,
          supabaseClient: supabase,
        })

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
            await sendLineReply(replyToken, 'ได้รับรูปสลิปแล้วค่ะ 📄 กำลังตรวจสอบความถูกต้อง รอสักครู่นะคะ...', lineToken)
          }
          // Run Slip verification and await so serverless execution context does not freeze before completion
          if (lineToken) {
            await verifySlipAndNotify({ messageId, userId, lineToken, shopId: shop_id, shop })
              .catch(err => console.error('[SlipVerify Error]', err))
          }
        } else {
          if (replyToken && lineToken) {
            await sendLineReply(replyToken, 'ได้รับรูปภาพเรียบร้อยแล้วค่ะ แอดมินจะเข้ามาตรวจสอบให้นะคะ 😊', lineToken)
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' })
  } catch (error: any) {
    console.error('[LINE Webhook Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  // Send LINE Flex Product Carousel if products were searched/recommended OR specifically requested
  let flexProducts = agentResult.productsData || []

  // Check if current turn is related to quotation or official documents
  const isDocOrQuotation =
    /(ใบเสนอราคา|เสนอราคา|quotation|หนังสือราชการ|บันทึกข้อความ|เอกสารทางการ)/i.test(userText || '') ||
    agentResult.toolCallsExecuted.some(
      (t) => t.name === 'create_quotation' || t.name === 'create_official_letter'
    )

  if (features.product_recommend === false || isDocOrQuotation) {
    // When product recommendation is disabled or requesting quotation/official docs, don't send product cards
    flexProducts = []
  } else if (flexProducts.length === 0 && lineToken) {
    const rawUserQuery = (userText || '').toLowerCase().trim()
    // Explicit product inquiry keywords like "มีเสื้อยืดไหม", "ขอดูเสื้อ", "มีสินค้าอะไรบ้าง"
    const isExplicitProductQuery =
      /(มี|ขอ|ดู|ค้นหา|แนะนำ|ซื้อ|สั่ง|ขาย)\s*(เสื้อ|กางเกง|กระเป๋า|รองเท้า|หมวก|เคส|ผ้าพันคอ|กระบอกน้ำ|สินค้า|แคตตาล็อก)/i.test(rawUserQuery) ||
      /(มี.*ไหม|มี.*มั้ย|ขอดู.*หน่อย|ราคาเท่าไหร่|มีแบบไหนบ้าง)/i.test(rawUserQuery)

    if (isExplicitProductQuery) {
      const { data: shopProducts } = await supabase
        .from('products')
        .select('id, name, price, stock, category, description, image_url')
        .eq('shop_id', shopId)
        .limit(10)

      if (shopProducts && shopProducts.length > 0) {
        const matched = shopProducts.filter((p: any) => {
          const pName = (p.name || '').toLowerCase()
          const pCat = (p.category || '').toLowerCase()
          return (
            rawUserQuery.includes(pName) ||
            (pCat && rawUserQuery.includes(pCat)) ||
            pName.split(' ').some((w: string) => w.length >= 2 && rawUserQuery.includes(w))
          )
        })

        if (matched.length > 0) {
          flexProducts = matched
        } else if (/(สินค้าทั้งหมด|มีอะไรบ้าง|มีอะไรขายบ้าง|ขอดูสินค้า|แนะนำสินค้า)/i.test(rawUserQuery)) {
          flexProducts = shopProducts.slice(0, 5)
        }
      }
    }
  }

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
        await sendLineReply(replyToken, replyPayload, lineToken)
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
  if (agentResult.quotaExceeded) return

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
    // 1. Download image content from LINE
    const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken}` },
    })
    if (!imageRes.ok) {
      console.error('[SlipVerify] Failed to download image:', await imageRes.text())
      await sendLinePush(userId, '❌ ไม่สามารถดาวน์โหลดรูปสลิปได้ค่ะ กรุณาส่งใหม่อีกครั้งนะคะ', lineToken)
      return
    }

    const imageBuffer = await imageRes.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg'

    // 2. Find conversation for this user
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .maybeSingle()

    // 3. Find most recent pending order for this customer/shop
    let pendingOrder: any = null
    if (conv?.id) {
      const { data: ords } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .eq('conversation_id', conv.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      if (ords && ords.length > 0) {
        pendingOrder = ords[0]
      }
    }
    if (!pendingOrder) {
      const { data: ords } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      if (ords && ords.length > 0) {
        pendingOrder = ords[0]
      }
    }

    const expectedAmount = pendingOrder ? Number(pendingOrder.total_amount) : undefined
    const slipConfig = shop?.features?.slip_verification

    // 4. Verify slip via unified engine
    const verifyResult = await verifySlip({
      imageBase64,
      mimeType: contentType,
      shopSettings: slipConfig,
      expectedAmount,
    })

    console.log('[SlipVerify] Verification result:', JSON.stringify(verifyResult))

    if (verifyResult.success) {
      const amountVal = Number(verifyResult.amount || expectedAmount || 0)
      const amountThai = amountVal.toLocaleString('th-TH', { minimumFractionDigits: 2 })

      // 5. Update pending order to 'paid'
      if (pendingOrder) {
        await supabase
          .from('orders')
          .update({
            status: 'paid',
            note: (pendingOrder.note ? `${pendingOrder.note}\n` : '') + `[ตรวจสลิปผ่านโดย ${verifyResult.provider}]: ยอด ${amountThai} บ. (LINE-Image:${messageId})`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingOrder.id)

        await cancelFollowUpTasks({
          shopId,
          referenceId: pendingOrder.order_no,
          taskType: 'qr_recovery',
        })

        await scheduleRepurchaseFollowUp({
          shopId,
          userId,
          orderNumber: pendingOrder.order_no,
          productSummary: pendingOrder.product_name,
          daysDelay: 21,
        })

        // Extract Golden Trajectory from this winning order
        extractGoldenTrajectoryFromOrder({
          shopId,
          orderId: pendingOrder.id,
          conversationId: pendingOrder.conversation_id,
          revenue: amountVal,
        }).catch((err) => console.error('[SalesTrajectory Error]:', err))
      }

      const orderRefText = pendingOrder?.order_no ? `\n📦 ออเดอร์: ${pendingOrder.order_no}` : ''
      const successMsg =
        `✅ ตรวจสอบสลิปสำเร็จค่ะ!\n` +
        `💰 ยอดโอน: ${amountThai} บาท\n` +
        `👤 ผู้รับ: ${verifyResult.receiverName || shop.promptpay_name || 'ร้านค้า'}\n` +
        (verifyResult.date ? `📅 วันที่: ${verifyResult.date} ${verifyResult.time || ''}\n` : '') +
        (verifyResult.transRef ? `📋 อ้างอิง: ${verifyResult.transRef}\n` : '') +
        orderRefText +
        `\n\nออเดอร์ได้รับการยืนยันเรียบร้อยแล้วค่ะ 🎉 ขอบพระคุณที่ใช้บริการนะคะ 🙏`

      await sendLinePush(userId, successMsg, lineToken)

      if (conv?.id) {
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          shop_id: shopId,
          sender_type: 'bot',
          sender_name: (shop.bot_name && !/botify/i.test(shop.bot_name)) ? shop.bot_name : 'น้อง DealMee',
          message: successMsg,
        })
      }
    } else {
      const reason = verifyResult.rawMessage ?? 'ไม่สามารถอ่านข้อมูลสลิปได้'
      const failMsg =
        `❌ ตรวจสอบสลิปไม่สำเร็จค่ะ (${reason})\n\nกรุณาตรวจสอบ:\n• ถ่ายหน้าจอสลิปให้ชัดเจน ไม่ตัดขอบหรือ QR Code\n• ต้องเป็นสลิปโอนเงินจริงจากธนาคาร\n• ยอดเงินตรงกับยอดในออเดอร์\n\nหากท่านโอนเงินเรียบร้อยแล้ว สามารถแจ้งแอดมินให้ตรวจสอบได้เลยนะคะ 🙏`

      await sendLinePush(userId, failMsg, lineToken)

      if (conv?.id) {
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          shop_id: shopId,
          sender_type: 'bot',
          sender_name: (shop.bot_name && !/botify/i.test(shop.bot_name)) ? shop.bot_name : 'น้อง DealMee',
          message: failMsg,
        })
      }
    }
  } catch (err) {
    console.error('[SlipVerify Exception]:', err)
    await sendLinePush(userId, '❌ ระบบตรวจสลิปขัดข้องชั่วคราวค่ะ กรุณาแจ้งแอดมินนะคะ 🙏', lineToken)
  }
}

// ─── LINE Messaging Helpers ───────────────────────────────────────────────────

/** Send Reply via LINE Reply API (1 replyToken = 1 use only, up to 5 message objects per replyToken, consuming ZERO push quota) */
async function sendLineReply(replyToken: string, payload: string | any[], channelAccessToken: string) {
  try {
    const rawMessages = typeof payload === 'string' ? [{ type: 'text', text: payload }] : payload
    const messages = (rawMessages || []).filter(Boolean)
    if (messages.length === 0) return

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
    }
  } catch (err) {
    console.error('[LINE Reply Exception]:', err)
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

/** Start LINE Chat Loading Animation (Thinking Indicator for up to 20s) */
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
        loadingSeconds: 20,
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
