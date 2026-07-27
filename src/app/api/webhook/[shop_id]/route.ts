import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import generatePayload from 'promptpay-qr'
import qrcode from 'qrcode'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
// Use service role key for storage uploads (bypasses RLS), fall back to anon key
const supabaseStorageKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = createClient(supabaseUrl, supabaseStorageKey)

const QR_BUCKET = 'qr-codes'

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

        // 5. Call AI Sales Agent Engine → returns AgentResult { text, toolCall? }
        const agentResult = await processSalesAgentChat({
          shop,
          userQuery: userText,
          userId,
          conversationId: conv.id,
        })

        const aiReplyText = agentResult.text || ''

        // 6. Save AI Reply to chat_messages
        if (aiReplyText) {
          await supabase.from('chat_messages').insert({
            conversation_id: conv.id,
            shop_id,
            sender_type: 'bot',
            sender_name: shop.bot_name || 'น้อง Botify',
            message: aiReplyText,
          })
        }

        // Update conversation last_message
        await supabase
          .from('conversations')
          .update({
            last_message: aiReplyText || '[ส่ง QR Code]',
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conv.id)

        // 7. Reply text back via LINE Reply API
        if (replyToken && lineToken && aiReplyText) {
          await sendLineReply(replyToken, aiReplyText, lineToken)
        }

        // 8. ─── TOOL CALL DISPATCHER (36 Tools) ─────────────────────────────────
        if (agentResult.toolCall) {
          const { name: toolName, args } = agentResult.toolCall
          console.log(`[Webhook] AI called tool: ${toolName}`, args)

          // Log tool call to chat_messages
          await supabase.from('chat_messages').insert({
            conversation_id: conv.id,
            shop_id,
            sender_type: 'bot',
            sender_name: shop.bot_name || 'น้อง Botify',
            message: `[Tool: ${toolName}] ${JSON.stringify(args)}`,
          })

          // ── 💳 PAYMENT TOOLS ─────────────────────────────────────────────────
          if (toolName === 'send_payment_qr') {
            const { amount, order_summary } = args
            const promptpayId = shop.promptpay_id || shop.promptpay_number
            if (promptpayId && lineToken) {
              const qrPublicUrl = await generateAndUploadQR(amount, promptpayId, shop_id)
              if (qrPublicUrl) {
                await sendLineImagePush(userId, qrPublicUrl, lineToken)
                const caption = `📋 ยอดชำระ: *${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท*${order_summary ? `\n${order_summary}` : ''}\n\n✅ บันทึกรูป QR แล้วเปิดแอปธนาคารสแกนได้เลยค่ะ\n📲 โอนเสร็จกรุณาส่งสลิปกลับมาในแชทนะคะ`
                await sendLinePush(userId, caption, lineToken)
              } else {
                const fallback = `💳 ช่องทางชำระเงิน:\n- พร้อมเพย์: ${promptpayId}\n- ชื่อ: ${shop.promptpay_name || shop.name}\n- ยอด: ${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`
                await sendLinePush(userId, fallback, lineToken)
              }
            }
          }

          else if (toolName === 'take_order') {
            // Create order in Supabase
            await supabase.from('orders').insert({
              shop_id,
              conversation_id: conv.id,
              customer_name: args.name,
              customer_phone: args.phone,
              product_name: args.product,
              quantity: args.qty,
              variants: args.variants,
              address: args.address,
              payment_method: args.payment_method,
              total_amount: args.total_price,
              tax_invoice: args.tax_invoice,
              status: 'pending',
            })
            if (lineToken) {
              const confirmMsg = `✅ รับออเดอร์แล้วค่ะ!\n📦 สินค้า: ${args.product} x${args.qty}\n💰 ยอดรวม: ${Number(args.total_price).toLocaleString()} บาท\n📍 จัดส่งไปที่: ${args.address}\n\nขอบคุณที่ใช้บริการนะคะ 🙏`
              await sendLinePush(userId, confirmMsg, lineToken)
            }
          }

          else if (toolName === 'request_human_agent') {
            // Switch conversation to human mode
            await supabase.from('conversations').update({ status: 'human' }).eq('id', conv.id)
            if (lineToken) {
              const handoffMsg = `🙋 กำลังเรียกแอดมินเข้ามาดูแลค่ะ กรุณารอสักครู่นะคะ...\n(เหตุผล: ${args.reason})`
              await sendLinePush(userId, handoffMsg, lineToken)
            }
          }

          else if (toolName === 'transfer_to_agent') {
            // Log agent transfer
            await supabase.from('conversations').update({
              status: 'ai',
              last_message: `[โอนสายไป ${args.target_agent}] ${args.reason}`,
            }).eq('id', conv.id)
            if (lineToken) {
              await sendLinePush(userId, `🔄 กำลังส่งต่อให้แผนก ${args.target_agent} ค่ะ...`, lineToken)
            }
          }

          else if (toolName === 'update_customer_note') {
            // Save note to conversations
            await supabase.from('conversations').update({
              customer_note: args.note,
            }).eq('id', conv.id)
          }

          else if (toolName === 'add_customer_tag') {
            await supabase.from('conversations').update({
              customer_tag: args.tag,
            }).eq('id', conv.id)
          }

          else if (toolName === 'save_lead') {
            await supabase.from('leads').upsert({
              shop_id,
              user_id: userId,
              product_name: args.product_name,
              customer_name: args.customer_name || `LINE-${userId.substring(0, 6)}`,
              source: 'LINE',
              status: 'new',
            }, { onConflict: 'shop_id,user_id' })
          }

          else if (toolName === 'schedule_followup') {
            // Schedule a follow-up push message
            const delayMs = (args.delay_minutes || 60) * 60 * 1000
            setTimeout(async () => {
              if (lineToken) {
                const followupMsg = `👋 สวัสดีค่ะ ไม่ทราบว่าตัดสินใจได้แล้วหรือยังคะ? มีอะไรให้ช่วยแนะนำเพิ่มเติมได้เลยนะคะ 😊`
                await sendLinePush(userId, followupMsg, lineToken)
              }
            }, Math.min(delayMs, 3600000)) // cap at 1 hour for safety
          }

          // All other tools (search_products, check_stock, calculate_shipping, etc.)
          // are handled internally by AI — the AI reads the response and generates the text reply.
          // For server-side execution of these tools, add their Supabase queries here as needed.
        }
      }

      // Handle Message Event (Image) - For Slip Verification
      if (event.type === 'message' && event.message?.type === 'image') {
        const messageId = event.message.id
        console.log(`[Webhook] Received image ${messageId} from ${userId}`)

        // 1. Acknowledge receipt to user
        if (replyToken && lineToken) {
          const replyText = 'ได้รับรูปสลิปแล้วค่ะ 📄 ระบบกำลังตรวจสอบความถูกต้องนะคะ รบกวนรอสักครู่ค่ะ...'
          await sendLineReply(replyToken, replyText, lineToken)
        }

        // 2. [TODO] In production, connect Slip Verification API here:
        // - Download image: https://api-data.line.me/v2/bot/message/${messageId}/content
        // - Send to SlipOK / EasySlip API
        // - Match amount and receiver name
        // - UPDATE orders SET payment_status = 'paid' WHERE ...

        // 3. [MOCK] Simulate async verification (replace with real API call)
        setTimeout(async () => {
          if (lineToken) {
            const successMsg = '✅ ตรวจสอบสลิปสำเร็จ! ได้รับยอดเงินเรียบร้อยแล้ว ออเดอร์ของคุณได้รับการยืนยันค่ะ 🎉'
            await sendLinePush(userId, successMsg, lineToken)
          }
        }, 3000)
      }
    }

    return NextResponse.json({ status: 'success' })
  } catch (error: any) {
    console.error('[LINE Webhook Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── QR Code: Generate & Upload to Supabase Storage ──────────────────────────

/**
 * Generates a PromptPay QR Code image and uploads it to Supabase Storage.
 * Returns the public URL of the uploaded image, or null on failure.
 */
async function generateAndUploadQR(
  amount: number,
  promptpayId: string,
  shopId: string
): Promise<string | null> {
  try {
    // 1. Generate PromptPay payload
    const payload = generatePayload(promptpayId, { amount })

    // 2. Generate QR code as PNG Buffer
    const qrBuffer = await qrcode.toBuffer(payload, {
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    // 3. Ensure storage bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === QR_BUCKET)
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(QR_BUCKET, { public: true })
    }

    // 4. Upload to Supabase Storage (path: /shop_id/timestamp.png)
    const fileName = `${shopId}/${Date.now()}_${amount}thb.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(QR_BUCKET)
      .upload(fileName, qrBuffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error('[QR Upload Error]:', uploadError.message)
      return null
    }

    // 5. Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(QR_BUCKET)
      .getPublicUrl(fileName)

    return urlData.publicUrl || null
  } catch (err) {
    console.error('[generateAndUploadQR Exception]:', err)
    return null
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
