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

    // 2. Attempt to update with status and accepted_at columns
    let updateRes = await supabase
      .from('documents')
      .update({
        status: 'accepted',
        accepted_at: nowIso,
      })
      .eq('id', id)

    // 3. Fallback: If status column does not exist yet in schema, record in notes
    if (updateRes.error && (updateRes.error.message?.includes('status') || updateRes.error.code === '42703')) {
      const currentNotes = typeof doc.notes === 'string' ? doc.notes : ''
      const updatedNotes = `${currentNotes}\n[STATUS:ACCEPTED:${nowIso}]`.trim()
      updateRes = await supabase
        .from('documents')
        .update({
          notes: updatedNotes,
        })
        .eq('id', id)
    }

    if (updateRes.error) {
      return NextResponse.json(
        { error: `ไม่สามารถบันทึกการอนุมัติได้: ${updateRes.error.message}` },
        { status: 500 }
      )
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
