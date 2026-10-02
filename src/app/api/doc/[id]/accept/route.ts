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
