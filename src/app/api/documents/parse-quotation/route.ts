import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { convertDocumentToQuotationDraft } from '@/lib/ai/documentToQuotation'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' }, { status: 401 })
    }

    const shop = await getOrCreateShopForUser(supabase, user)
    if (!shop?.id) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลร้านค้า' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const saveToDb = formData.get('save_to_db') === 'true'

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'กรุณาแนบไฟล์เอกสาร' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const quotation = await convertDocumentToQuotationDraft(
      buffer,
      file.name,
      shop.vat_enabled || false
    )

    if (!saveToDb) {
      return NextResponse.json({
        success: true,
        preview: true,
        quotation,
      })
    }

    // Generate quotation number and save to documents table
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randNum = Math.floor(1000 + Math.random() * 9000)
    const docNumber = `QT-${dateStr}-${randNum}`

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        shop_id: shop.id,
        doc_no: docNumber,
        doc_number: docNumber,
        doc_type: 'quotation',
        customer_name: quotation.customer_name || 'ลูกค้าผู้มีอุปการคุณ',
        customer_phone: quotation.customer_phone || '',
        customer_address: quotation.customer_address || '',
        items: quotation.items,
        subtotal: quotation.subtotal,
        discount_amount: quotation.discount_amount,
        vat_amount: quotation.vat_amount,
        total_amount: quotation.total_amount,
        notes: quotation.notes || `สร้างอัตโนมัติจากไฟล์ ${file.name}`,
      })
      .select('id')
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: `บันทึกเอกสารไม่สำเร็จ: ${docErr?.message}` }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const docUrl = `${baseUrl}/doc/quotation/${doc.id}`

    return NextResponse.json({
      success: true,
      docId: doc.id,
      docNumber,
      docUrl,
      quotation,
    })
  } catch (err: any) {
    console.error('[API parse-quotation error]:', err)
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร' },
      { status: 500 }
    )
  }
}
