import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

      if (shop?.line_token && shop?.features?.admin_notify !== false) {
        // Resolve target LINE User ID:
        // Priority 1: shop.admin_line_user_id or features.admin_line_user_id
        let targetLineUserId =
          shop.admin_line_user_id ||
          shop.owner_line_id ||
          shop.features?.admin_line_user_id ||
          shop.features?.admin_notify_user_id

        // Priority 2: Most recent human-takeover or admin conversation
        if (!targetLineUserId) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('user_id')
            .eq('shop_id', shop.id)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (conv?.user_id) {
            targetLineUserId = conv.user_id
          }
        }

        if (targetLineUserId) {
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
