import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { processSalesAgentChat } from '@/lib/ai/salesAgentEngine'
import { createAdminClient } from '@/lib/supabase/admin'
import { incrementUsage } from '@/lib/billing/usage'
import generatePayload from 'promptpay-qr'
import qrcode from 'qrcode'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = createAdminClient()

const QR_BUCKET = 'qr-codes'

// ─── LINE Signature Verification ─────────────────────────────────────────────
function verifyLineSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  const hash = createHmac('SHA256', secret).update(rawBody).digest('base64')
  return hash === signature
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

    const lineToken = shop.line_token
    const features = (shop.features as Record<string, boolean>) || {}
    const isAutoReplyEnabled = features.auto_reply !== false

    // 2. Verify LINE Signature (reject fake webhooks)
    const lineSignature = req.headers.get('x-line-signature') || ''
    if (shop.line_secret && lineSignature) {
      const isValid = verifyLineSignature(rawBody, lineSignature, shop.line_secret)
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
        // Skip tool dispatch + usage increment entirely if the AI never actually
        // ran (quota exceeded) — the customer already got the quota message above.
        if (agentResult.quotaExceeded) {
          continue
        }

        if (agentResult.usage) {
          incrementUsage(shop_id, agentResult.usage).catch((err) =>
            console.error('[Webhook] incrementUsage failed:', err)
          )
        }

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


          // ── 📦 PRODUCT TOOLS ─────────────────────────────────────────────
          else if (toolName === 'search_products') {
            const limit = Math.min(Number(args.limit) || 5, 10)
            let q = supabase.from('products').select('name,price,stock,description').eq('shop_id', shop_id).limit(limit)
            if (args.keyword) q = q.ilike('name', `%${args.keyword}%`)
            if (args.category) q = q.eq('category', args.category)
            if (args.max_price) q = q.lte('price', Number(args.max_price))
            const { data: prods } = await q
            if (prods && prods.length > 0 && lineToken) {
              const list = prods.map((p: any, i: number) => `${i + 1}. ${p.name}\n   💰 ${Number(p.price).toLocaleString()} บาท ${p.stock > 0 ? `| ${p.stock} ชิ้น` : '| หมดสต๊อก'}`).join('\n\n')
              await sendLinePush(userId, `🛍️ สินค้าที่ค้นพบ:\n\n${list}\n\nสนใจสินค้าไหนบอกได้เลยนะคะ 😊`, lineToken)
            } else if (lineToken) {
              await sendLinePush(userId, '❌ ไม่พบสินค้าที่ค้นหาค่ะ ลองคำอื่นดูนะคะ', lineToken)
            }
          }

          else if (toolName === 'check_stock') {
            const { data: prods } = await supabase.from('products').select('name,stock,price').eq('shop_id', shop_id).ilike('name', `%${args.product_name}%`).limit(3)
            if (prods && prods.length > 0 && lineToken) {
              const info = prods.map((p: any) => `• ${p.name}: ${p.stock > 0 ? `${p.stock} ชิ้น | ${Number(p.price).toLocaleString()} บาท` : '❌ หมดสต๊อก'}`).join('\n')
              await sendLinePush(userId, `📦 สต๊อกสินค้า:\n\n${info}`, lineToken)
            } else if (lineToken) {
              await sendLinePush(userId, `❌ ไม่พบสินค้า "${args.product_name}" ค่ะ`, lineToken)
            }
          }

          else if (toolName === 'check_order_status') {
            const oid = args.order_id
            const { data: ord } = await supabase.from('orders').select('order_no,status,payment_status,tracking_no,product_name,total_amount').eq('shop_id', shop_id).or(`id.eq.${oid},order_no.ilike.%${oid}%`).single()
            if (ord && lineToken) {
              const sMap: Record<string, string> = { pending: '⏳ รอดำเนินการ', confirmed: '✅ ยืนยันแล้ว', processing: '🔄 กำลังดำเนินการ', shipped: '🚚 จัดส่งแล้ว', delivered: '✅ ส่งถึงแล้ว', cancelled: '❌ ยกเลิก' }
              const pMap: Record<string, string> = { pending: '⏳ รอชำระ', paid: '✅ ชำระแล้ว', failed: '❌ ล้มเหลว' }
              await sendLinePush(userId, `📦 ออเดอร์ ${ord.order_no}\nสินค้า: ${ord.product_name}\nยอด: ${Number(ord.total_amount).toLocaleString()} บาท\nสถานะ: ${sMap[ord.status] ?? ord.status}\nชำระเงิน: ${pMap[ord.payment_status] ?? ord.payment_status}${ord.tracking_no ? `\nพัสดุ: ${ord.tracking_no}` : ''}`, lineToken)
            } else if (lineToken) {
              await sendLinePush(userId, '❌ ไม่พบข้อมูลออเดอร์ค่ะ', lineToken)
            }
          }

          // ── 📅 BOOKING TOOLS ──────────────────────────────────────────────
          else if (toolName === 'check_available_slots') {
            const { data: booked } = await supabase.from('bookings').select('booking_time').eq('shop_id', shop_id).eq('booking_date', args.date).neq('status', 'cancelled')
            const bookedTimes = booked?.map((b: any) => b.booking_time) ?? []
            const allSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
            const free = allSlots.filter(s => !bookedTimes.some((t: string) => t?.startsWith(s)))
            if (lineToken) {
              if (free.length > 0) {
                await sendLinePush(userId, `📅 ช่วงเวลาว่างวันที่ ${args.date}:\n\n${free.map((s: string) => `• ${s} น.`).join('\n')}\n\nต้องการจองเวลาไหนคะ?`, lineToken)
              } else {
                await sendLinePush(userId, `❌ ไม่มีเวลาว่างวันที่ ${args.date} ค่ะ กรุณาเลือกวันอื่นนะคะ`, lineToken)
              }
            }
          }

          else if (toolName === 'book_appointment') {
            const bookingNo = `BK-${Date.now().toString().slice(-6)}`
            await supabase.from('bookings').insert({
              shop_id, booking_no: bookingNo,
              customer_name: args.customer_name || `LINE-${userId.substring(0, 6)}`,
              phone: args.phone, service_name: args.service_name,
              booking_date: args.date, booking_time: args.time,
              status: 'confirmed', note: args.note,
            })
            if (lineToken) {
              await sendLinePush(userId, `✅ จองคิวเรียบร้อยค่ะ!\n📋 หมายเลข: ${bookingNo}\n💆 บริการ: ${args.service_name}\n📅 ${args.date} เวลา ${args.time} น.\n\nขอบคุณค่ะ 🙏`, lineToken)
            }
          }

          else if (toolName === 'cancel_booking') {
            const bid = args.booking_id
            const { data: bk } = await supabase.from('bookings').select('booking_no,service_name,booking_date').eq('shop_id', shop_id).or(`id.eq.${bid},booking_no.ilike.%${bid}%`).single()
            if (bk) {
              await supabase.from('bookings').update({ status: 'cancelled' }).or(`id.eq.${bid},booking_no.ilike.%${bid}%`)
              if (lineToken) await sendLinePush(userId, `✅ ยกเลิกการจอง ${bk.booking_no} (${bk.service_name} วันที่ ${bk.booking_date}) เรียบร้อยค่ะ`, lineToken)
            } else if (lineToken) {
              await sendLinePush(userId, '❌ ไม่พบข้อมูลการจองค่ะ', lineToken)
            }
          }

          // ── 👤 CUSTOMER TOOLS ─────────────────────────────────────────────
          else if (toolName === 'get_customer_history') {
            const { data: ords } = await supabase.from('orders').select('order_no,product_name,total_amount,status,created_at').eq('shop_id', shop_id).eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(5)
            if (ords && ords.length > 0 && lineToken) {
              const hist = ords.map((o: any) => `• ${o.order_no} - ${o.product_name}\n  ${Number(o.total_amount).toLocaleString()} บาท | ${o.status}`).join('\n\n')
              await sendLinePush(userId, `📋 ประวัติการสั่งซื้อ:\n\n${hist}`, lineToken)
            } else if (lineToken) {
              await sendLinePush(userId, '📋 ยังไม่มีประวัติการสั่งซื้อค่ะ', lineToken)
            }
          }

          else if (toolName === 'check_loyalty_points') {
            const { data: paidOrds } = await supabase.from('orders').select('total_amount').eq('shop_id', shop_id).eq('conversation_id', conv.id).eq('payment_status', 'paid')
            if (lineToken) {
              const total = paidOrds?.reduce((s: number, o: any) => s + Number(o.total_amount), 0) ?? 0
              const pts = Math.floor(total / 100)
              await sendLinePush(userId, `⭐ แต้มสะสมของคุณ\n💰 ยอดซื้อทั้งหมด: ${total.toLocaleString()} บาท\n🎁 แต้มสะสม: ${pts.toLocaleString()} แต้ม\n(ทุก 100 บาท = 1 แต้ม)`, lineToken)
            }
          }

          // ── 🎁 PROMOTIONS ─────────────────────────────────────────────────
          else if (toolName === 'get_active_promotions') {
            const today = new Date().toISOString().split('T')[0]
            const { data: promos } = await supabase.from('promotions').select('name,description,discount_type,discount_value,end_date,code').eq('shop_id', shop_id).eq('status', 'active').or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false }).limit(5)
            if (promos && promos.length > 0 && lineToken) {
              const list = promos.map((p: any) => {
                const d = p.discount_type === 'percent' ? `ลด ${p.discount_value}%` : `ลด ${Number(p.discount_value).toLocaleString()} บาท`
                return `🎁 ${p.name}\n   ${d}${p.end_date ? ` | ถึง ${p.end_date}` : ''}${p.code ? `\n   โค้ด: ${p.code}` : ''}`
              }).join('\n\n')
              await sendLinePush(userId, `🔥 โปรโมชั่นพิเศษ:\n\n${list}`, lineToken)
            } else if (lineToken) {
              await sendLinePush(userId, '❌ ยังไม่มีโปรโมชั่นในขณะนี้ค่ะ', lineToken)
            }
          }
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
