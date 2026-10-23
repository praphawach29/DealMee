import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDocAcceptToken } from '@/lib/docs/acceptToken'

async function readAcceptToken(req: NextRequest): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get('accept') || req.nextUrl.searchParams.get('token')
  if (fromQuery) return fromQuery
  try {
    const body = await req.json()
    if (body && typeof body === 'object') {
      if (typeof body.token === 'string') return body.token
      if (typeof body.accept === 'string') return body.accept
    }
  } catch {
    // The button posts JSON; an empty body is just a missing token.
  }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tokenCheck = verifyDocAcceptToken(id, await readAcceptToken(req))
    if (!tokenCheck.ok) {
      const error =
        tokenCheck.reason === 'expired'
          ? 'ลิงก์ยืนยันหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากร้าน'
          : tokenCheck.reason === 'unconfigured'
            ? 'ระบบยืนยันเอกสารยังไม่พร้อมใช้งาน'
            : 'ลิงก์ยืนยันไม่ถูกต้องหรือไม่มีรหัส'
      return NextResponse.json({ error }, { status: tokenCheck.reason === 'unconfigured' ? 503 : 401 })
    }

    const supabase = createAdminClient()

    // 1. Fetch document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'ไม่พบเอกสารใบเสนอราคาที่ต้องการอนุมัติ' }, { status: 404 })
    }

    const alreadyAccepted =
      doc.status === 'accepted' || (typeof doc.notes === 'string' && doc.notes.includes('[STATUS:ACCEPTED'))
    if (alreadyAccepted) {
      return NextResponse.json({
        success: true,
        message: 'ยืนยันตกลงสั่งซื้อตามใบเสนอราคาเรียบร้อยแล้ว',
        accepted_at: doc.accepted_at || doc.updated_at || null,
      })
    }

    const nowIso = new Date().toISOString()
    const currentNotes = typeof doc.notes === 'string' ? doc.notes : ''
    const updatedNotes = currentNotes.includes('[STATUS:ACCEPTED')
      ? currentNotes
      : `${currentNotes}\n[STATUS:ACCEPTED:${nowIso}]`.trim()

    // 2. Update status to 'accepted', with timestamp in updated_at and notes
    let { error } = await supabase
      .from('documents')
      .update({
        status: 'accepted',
        updated_at: nowIso,
        notes: updatedNotes,
      })
      .eq('id', id)

    // Fallback: If status or updated_at fails for any reason, update notes only
    if (error) {
      const fallbackRes = await supabase
        .from('documents')
        .update({
          notes: updatedNotes,
        })
        .eq('id', id)
      error = fallbackRes.error
    }

    if (error) {
      return NextResponse.json(
        { error: `ไม่สามารถบันทึกการอนุมัติได้: ${error.message}` },
        { status: 500 }
      )
    }

    // 3. Send Real-time LINE Notification to Shop Admin / Team
    try {
      const { data: shop } = await supabase
        .from('shops')
        .select('*')
        .eq('id', doc.shop_id)
        .single()

      // Only the shop's configured admin LINE account. Never the latest customer chat:
      // that used to push the customer's name, phone and amount to a different person.
      const targetLineUserId =
        shop?.admin_line_user_id ||
        shop?.owner_line_id ||
        shop?.features?.admin_line_user_id ||
        shop?.features?.admin_notify_user_id

      if (shop?.line_token && shop?.features?.admin_notify !== false && targetLineUserId) {
          const docNo = doc.doc_number || doc.doc_no || 'QT'
          const totalStr = Number(doc.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'

          const flexPayload = {
            to: targetLineUserId,
            messages: [
              {
                type: 'flex',
                altText: `🎉 ลูกค้าอนุมัติใบเสนอราคา ${docNo} แล้ว! ยอด ฿${totalStr} บาท`,
                contents: {
                  type: 'bubble',
                  header: {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#059669',
                    paddingAll: '16px',
                    contents: [
                      {
                        type: 'text',
                        text: '🎉 ลูกค้าอนุมัติใบเสนอราคาแล้ว!',
                        weight: 'bold',
                        color: '#ffffff',
                        size: 'md',
                      },
                      {
                        type: 'text',
                        text: 'Quotation Accepted (ปิดการขายสำเร็จ)',
                        color: '#a7f3d0',
                        size: 'xs',
                        margin: 'xs',
                      },
                    ],
                  },
                  body: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    paddingAll: '16px',
                    contents: [
                      {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                          { type: 'text', text: 'เลขที่เอกสาร', size: 'xs', color: '#64748b', flex: 2 },
                          { type: 'text', text: docNo, size: 'xs', weight: 'bold', color: '#0f172a', flex: 3, align: 'end' },
                        ],
                      },
                      {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                          { type: 'text', text: 'ลูกค้า', size: 'xs', color: '#64748b', flex: 2 },
                          { type: 'text', text: doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ', size: 'xs', weight: 'bold', color: '#0f172a', flex: 3, align: 'end' },
                        ],
                      },
                      {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                          { type: 'text', text: 'เบอร์ติดต่อ', size: 'xs', color: '#64748b', flex: 2 },
                          { type: 'text', text: doc.customer_phone || '-', size: 'xs', weight: 'bold', color: '#0f172a', flex: 3, align: 'end' },
                        ],
                      },
                      {
                        type: 'separator',
                        margin: 'md',
                      },
                      {
                        type: 'box',
                        layout: 'horizontal',
                        margin: 'md',
                        contents: [
                          { type: 'text', text: 'ยอดรวมทั้งสิ้น', size: 'sm', weight: 'bold', color: '#334155', flex: 2 },
                          { type: 'text', text: `฿${totalStr} บ.`, size: 'md', weight: 'bold', color: '#059669', flex: 3, align: 'end' },
                        ],
                      },
                    ],
                  },
                  footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    paddingAll: '14px',
                    contents: [
                      {
                        type: 'button',
                        action: {
                          type: 'uri',
                          label: '📄 เปิดดูใบเสนอราคา',
                          uri: `${baseUrl}/doc/quotation/${doc.id}`,
                        },
                        style: 'primary',
                        color: '#2563eb',
                        height: 'sm',
                      },
                      {
                        type: 'button',
                        action: {
                          type: 'uri',
                          label: '📦 ดูคลังเอกสาร & จัดการบิล',
                          uri: `${baseUrl}/dashboard/documents`,
                        },
                        style: 'secondary',
                        height: 'sm',
                      },
                    ],
                  },
                },
              },
            ],
          }

          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${shop.line_token}`,
            },
            body: JSON.stringify(flexPayload),
          })
      }

      // In-app notice on the conversation this quotation was issued in. No LINE push
      // when the shop has not linked an admin account.
      const conversationId =
        doc.customer_info && typeof doc.customer_info === 'object'
          ? (doc.customer_info as { conversation_id?: string }).conversation_id
          : null
      if (conversationId && shop?.id) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, platform')
          .eq('id', conversationId)
          .eq('shop_id', shop.id)
          .maybeSingle()
        if (conv) {
          const docNo = doc.doc_number || doc.doc_no || 'QT'
          const totalStr = Number(doc.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })
          const note = `ลูกค้ายืนยันใบเสนอราคา ${docNo} แล้ว ยอด ฿${totalStr}`
          await supabase.from('chat_messages').insert({
            conversation_id: conv.id,
            shop_id: shop.id,
            sender_type: 'agent',
            sender_name: 'ระบบ DealMee',
            message: note,
            platform: conv.platform || 'line',
          })
          await supabase
            .from('conversations')
            .update({ last_message: note, last_message_at: nowIso })
            .eq('id', conv.id)
        }
      }
    } catch (notifyErr) {
      console.error('[Document Accept Notification Error]:', notifyErr)
      // Non-blocking notification failure
    }

    return NextResponse.json({
      success: true,
      message: 'ยืนยันตกลงสั่งซื้อตามใบเสนอราคาเรียบร้อยแล้ว',
      accepted_at: nowIso,
    })
  } catch (err: any) {
    console.error('[Document Accept API Error]:', err)
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการบันทึกการอนุมัติ' },
      { status: 500 }
    )
  }
}
