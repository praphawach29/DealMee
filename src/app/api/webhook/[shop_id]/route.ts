import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { startSalesAgentPlanning, continueSalesAgentPlanning, planningAckMessage, type AgentResult } from '@/lib/ai/salesAgentEngine'
import { incrementUsage, incrementProviderUsage } from '@/lib/billing/usage'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { buildAutoGreeting, isDefaultGreeting } from '@/lib/businessGreeting'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

        // Customer Memory Graph: create/touch the durable cross-conversation
        // profile for this customer before anything else runs, so it's
        // guaranteed to exist by the time any tool call below needs it.
        await upsertCustomerProfile(shop_id, userId, conv.customer_name)

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

        // 5. Call AI Sales Agent Engine — run only the first planning step
        // here. Most messages resolve in one step (nothing changes for
        // those); if the AI needs to chain more tool calls, we get back a
        // continuation state instead of waiting for the whole plan to
        // finish, so we can ack the customer right away.
        const started = await startSalesAgentPlanning({
          shop,
          userQuery: userText,
          userId,
          conversationId: conv.id,
        })

        if (started.done) {
          // Single-step case (the common one) — unchanged behavior: reply
          // via the LINE Reply API once the final answer is ready.
          await deliverAgentResult({
            agentResult: started.result,
            conv,
            shop,
            shopId: shop_id,
            userId,
            lineToken,
            replyToken,
            useReplyForText: true,
          })
        } else {
          // Multi-step plan — send a short ack now (consumes the one-time
          // replyToken while it's still fresh), then finish the remaining
          // steps in the background and push the real answer once ready.
          // Same reply-then-push-later shape as verifySlipAndNotify below.
          if (replyToken && lineToken) {
            await sendLineReply(replyToken, planningAckMessage(started.state), lineToken)
          }
          continueSalesAgentPlanning(started.state)
            .then((agentResult) =>
              deliverAgentResult({
                agentResult,
                conv,
                shop,
                shopId: shop_id,
                userId,
                lineToken,
                replyToken: undefined,
                useReplyForText: false,
              })
            )
            .catch((err) => console.error('[Webhook] Planning Layer background continuation failed:', err))
        }
      }

      // Handle Message Event (Image) - For Slip Verification
      if (event.type === 'message' && event.message?.type === 'image') {
        const messageId = event.message.id
        console.log(`[Webhook] Received image ${messageId} from ${userId}`)

        if (replyToken && lineToken) {
          await sendLineReply(replyToken, 'ได้รับรูปสลิปแล้วค่ะ 📄 กำลังตรวจสอบความถูกต้อง รอสักครู่นะคะ...', lineToken)
        }
        // Run EasySlip verification in background (non-blocking)
        if (lineToken) {
          verifySlipAndNotify({ messageId, userId, lineToken, shopId: shop_id, shop })
            .catch(err => console.error('[SlipVerify BG Error]', err))
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
  agentResult, conv, shop, shopId, userId, lineToken, replyToken, useReplyForText,
}: {
  agentResult: AgentResult
  conv: { id: string }
  shop: Record<string, any>
  shopId: string
  userId: string
  lineToken: string | undefined
  replyToken: string | undefined
  useReplyForText: boolean
}) {
  const aiReplyText = agentResult.text || ''

  if (aiReplyText) {
    await supabase.from('chat_messages').insert({
      conversation_id: conv.id,
      shop_id: shopId,
      sender_type: 'bot',
      sender_name: shop.bot_name || 'น้อง Botify',
      message: aiReplyText,
    })
  }

  await supabase
    .from('conversations')
    .update({
      last_message: aiReplyText || '[ส่ง QR Code]',
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conv.id)

  if (aiReplyText && lineToken) {
    if (useReplyForText && replyToken) {
      await sendLineReply(replyToken, aiReplyText, lineToken)
    } else {
      await sendLinePush(userId, aiReplyText, lineToken)
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
  for (const toolCall of agentResult.toolCallsExecuted) {
    console.log(`[Webhook] AI called tool: ${toolCall.name}`, toolCall.args)
    await supabase.from('chat_messages').insert({
      conversation_id: conv.id,
      shop_id: shopId,
      sender_type: 'bot',
      sender_name: shop.bot_name || 'น้อง Botify',
      message: `[Tool: ${toolCall.name}] ${JSON.stringify(toolCall.args)}`,
    })
  }

  for (const msg of agentResult.immediateMessages) {
    if (!lineToken) continue
    if (msg.type === 'image') {
      await sendLineImagePush(userId, msg.content, lineToken)
    } else {
      await sendLinePush(userId, msg.content, lineToken)
    }
  }

  for (const scheduled of agentResult.scheduledMessages) {
    if (!lineToken) continue
    const { delayMs, message } = scheduled
    setTimeout(() => {
      sendLinePush(userId, message.content, lineToken).catch((err) =>
        console.error('[Webhook] scheduledMessage push failed:', err)
      )
    }, delayMs)
  }
}

// ─── EasySlip Verification (runs non-blocking in background) ─────────────────

async function verifySlipAndNotify({
  messageId, userId, lineToken, shopId, shop,
}: {
  messageId: string
  userId: string
  lineToken: string
  shopId: string
  shop: Record<string, unknown>
}) {
  try {
    const easySlipKey = process.env.EASYSLIP_API_KEY

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

    // 2. No API key → mock mode
    if (!easySlipKey) {
      console.warn('[SlipVerify] EASYSLIP_API_KEY not set — mock approval')
      await sendLinePush(userId, '✅ ตรวจสอบสลิปสำเร็จค่ะ! ออเดอร์ของคุณได้รับการยืนยันแล้ว 🎉', lineToken)
      return
    }

    // 3. Call EasySlip API
    const slipRes = await fetch('https://developer.easyslip.com/api/v1/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${easySlipKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: `data:${contentType};base64,${imageBase64}` }),
    })
    const slipData = await slipRes.json()
    console.log('[SlipVerify] EasySlip response:', JSON.stringify(slipData))

    if (slipRes.ok && slipData.status === 200) {
      const { amount, receiver, date, time, ref1 } = slipData.data ?? {}
      const amountThai = Number(amount?.amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })

      // 4. Update most recent pending order for this shop
      const { data: pendingOrds } = await supabase
        .from('orders')
        .select('id,order_no')
        .eq('shop_id', shopId)
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (pendingOrds && pendingOrds.length > 0) {
        await supabase.from('orders')
          .update({ payment_status: 'paid', slip_url: `LINE-Image:${messageId}` })
          .eq('id', pendingOrds[0].id)
      }

      await sendLinePush(
        userId,
        `✅ ตรวจสอบสลิปสำเร็จค่ะ!\n` +
        `💰 ยอดโอน: ${amountThai} บาท\n` +
        `👤 ผู้รับ: ${receiver?.displayName ?? shop.promptpay_name ?? 'ผู้รับเงิน'}\n` +
        `📅 ${date ?? ''} ${time ?? ''}` +
        (ref1 ? `\n📋 อ้างอิง: ${ref1}` : '') +
        `\n\nออเดอร์ยืนยันแล้วค่ะ 🎉 ขอบคุณที่ใช้บริการนะคะ 🙏`,
        lineToken
      )
    } else {
      const reason = slipData.message ?? 'ไม่สามารถอ่านข้อมูลได้'
      await sendLinePush(
        userId,
        `❌ ตรวจสอบสลิปไม่สำเร็จค่ะ (${reason})\n\nกรุณาตรวจสอบ:\n• ถ่ายหน้าจอสลิปให้ชัดเจน ไม่ตัด\n• ต้องเป็นสลิปโอนเงินจริง ไม่ใช่รูปถ่าย\n\nหากยังมีปัญหา แจ้งแอดมินได้เลยค่ะ 🙏`,
        lineToken
      )
    }
  } catch (err) {
    console.error('[SlipVerify Exception]:', err)
    await sendLinePush(userId, '❌ ระบบตรวจสลิปขัดข้องชั่วคราวค่ะ กรุณาแจ้งแอดมินนะคะ 🙏', lineToken)
  }
}

// ─── LINE Messaging Helpers ───────────────────────────────────────────────────

/** Send Reply via LINE Reply API (1 replyToken = 1 use only) */
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
        messages: [{ type: 'text', text }],
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
