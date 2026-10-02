import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateQuotationDocx,
  generateQuotationXlsx,
  generateOfficialLetterDocx,
} from '@/lib/office/officeDocumentService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = req.nextUrl.searchParams
    const format = (searchParams.get('format') || 'docx').toLowerCase()

    const supabase = createAdminClient()

    // 1. Fetch document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (docError || !doc) {
      return new NextResponse('ไม่พบเอกสารที่ต้องการดาวน์โหลด', { status: 404 })
    }

    // 2. Fetch shop profile & logo
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', doc.shop_id)
      .single()

    let logoBuffer: Buffer | undefined
    let logoUrl = shop?.company_logo_url || shop?.logo_url || shop?.image_url || ''
    if (!logoUrl && shop?.line_token) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/info', {
          headers: { Authorization: `Bearer ${shop.line_token}` },
        })
        if (lineRes.ok) {
          const botInfo = await lineRes.json()
          if (botInfo.pictureUrl) {
            logoUrl = botInfo.pictureUrl
          }
        }
      } catch (e) {
        // silent fallback
      }
    }

    if (logoUrl) {
      try {
        const imgRes = await fetch(logoUrl)
        if (imgRes.ok) {
          logoBuffer = Buffer.from(await imgRes.arrayBuffer())
        }
      } catch (e) {
        // silent fallback
      }
    }

    let signatureBuffer: Buffer | undefined
    const signatureUrl = shop?.company_signature_url || shop?.features?.company_signature_url || ''
    if (signatureUrl) {
      try {
        const sigRes = await fetch(signatureUrl)
        if (sigRes.ok) {
          signatureBuffer = Buffer.from(await sigRes.arrayBuffer())
        }
      } catch (e) {
        // silent fallback
      }
    }

    const shopProfile = {
      name: shop?.name,
      company_name: shop?.company_name,
      company_tax_id: shop?.company_tax_id,
      company_address: shop?.company_address,
      company_phone: shop?.company_phone,
      company_email: shop?.company_email,
      bank_name: shop?.bank_name || shop?.payment_bank_name,
      bank_account_number: shop?.bank_account_number || shop?.payment_bank_account,
      bank_account_name: shop?.bank_account_name || shop?.payment_bank_acc_name,
      promptpay_id: shop?.promptpay_number || shop?.payment_promptpay || shop?.promptpay_id,
      logo_buffer: logoBuffer,
      signature_buffer: signatureBuffer,
    }

    let fileBuffer: Buffer
    let mimeType: string
    let filename: string

    const docNo = doc.doc_number || doc.doc_no || id

    if (doc.doc_type === 'quotation') {
      if (format === 'xlsx' || format === 'excel') {
        fileBuffer = await generateQuotationXlsx(doc, shopProfile)
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = `ใบเสนอราคา_${docNo}.xlsx`
      } else {
        fileBuffer = await generateQuotationDocx(doc, shopProfile)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        filename = `ใบเสนอราคา_${docNo}.docx`
      }
    } else if (doc.doc_type === 'official_letter') {
      fileBuffer = await generateOfficialLetterDocx(doc, shopProfile)
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      filename = `หนังสือราชการ_${docNo}.docx`
    } else {
      // Default to docx quotation
      fileBuffer = await generateQuotationDocx(doc, shopProfile)
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      filename = `เอกสาร_${docNo}.docx`
    }

    const safeDocNo = String(docNo).replace(/[^a-zA-Z0-9_-]/g, '_')
    const ext = (format === 'xlsx' || format === 'excel') ? 'xlsx' : 'docx'
    const asciiFallback = doc.doc_type === 'quotation'
      ? `Quotation_${safeDocNo}.${ext}`
      : `Document_${safeDocNo}.${ext}`
    const encodedFilename = encodeURIComponent(filename)

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err: any) {
    console.error('[Document Download API Error]:', err)
    return new NextResponse(`เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร: ${err.message || 'Unknown error'}`, { status: 500 })
  }
}
