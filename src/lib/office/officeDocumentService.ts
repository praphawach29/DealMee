import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
} from 'docx'
import ExcelJS from 'exceljs'

/**
 * Executes officecli with required environment variables.
 * Specifically sets DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 for Vercel/Linux serverless compatibility.
 */
async function runOfficeCli(bin: string, args: string[]) {
  return promisify(execFile)(bin, args, {
    env: {
      ...process.env,
      DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1',
    },
    maxBuffer: 10 * 1024 * 1024,
  })
}

/**
 * Resolves the path to the officecli executable.
 * Prioritizes the pre-downloaded vendor binary inside node_modules/@officecli/officecli/vendor.
 */
function getOfficeCliBinary(): string {
  const isWin = process.platform === 'win32'
  const binaryName = isWin ? 'officecli.exe' : 'officecli'
  const vendorPath = path.join(process.cwd(), 'node_modules', '@officecli', 'officecli', 'vendor', binaryName)

  if (fs.existsSync(vendorPath)) {
    if (!isWin) {
      try {
        fs.chmodSync(vendorPath, 0o755)
      } catch {}
    }
    return vendorPath
  }

  const shimPath = path.join(process.cwd(), 'node_modules', '.bin', isWin ? 'officecli.cmd' : 'officecli')
  if (fs.existsSync(shimPath)) {
    if (!isWin) {
      try {
        fs.chmodSync(shimPath, 0o755)
      } catch {}
    }
    return shimPath
  }

  return 'officecli'
}

/**
 * Helper to close/release an office document handle so it doesn't get EBUSY on Windows.
 */
async function closeOfficeDoc(bin: string, filePath: string) {
  try {
    await runOfficeCli(bin, ['close', filePath])
  } catch {
    // Ignore close errors
  }
}

export interface QuotationDocData {
  id?: string
  doc_number?: string
  doc_no?: string
  created_at?: string
  customer_name?: string
  customer_phone?: string
  customer_address?: string
  items: Array<{ name: string; price: number; qty: number; unit?: string; total?: number }>
  subtotal: number
  discount_amount?: number
  vat_amount?: number
  total_amount: number
  notes?: string
}

export interface ShopProfileData {
  name?: string
  company_name?: string
  company_tax_id?: string
  company_address?: string
  company_phone?: string
  company_email?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  promptpay_id?: string
}

/**
 * Generates a Word (.docx) Quotation using pure JavaScript (docx library) as reliable fallback.
 */
export async function generateQuotationDocxWithJs(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const companyName = shop.company_name || shop.name || 'บริษัท / ร้านค้า'
  const taxId = shop.company_tax_id || '-'
  const address = shop.company_address || '-'
  const phone = shop.company_phone || '-'
  const email = shop.company_email || '-'

  const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'
  const customerPhone = doc.customer_phone || '-'
  const customerAddress = doc.customer_address || '-'

  const subtotal = Number(doc.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const discount = Number(doc.discount_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const vat = Number(doc.vat_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const total = Number(doc.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'รายการสินค้า / บริการ', bold: true })] })],
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'จำนวน', bold: true })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 17, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'ราคา/หน่วย (บาท)', bold: true })], alignment: AlignmentType.RIGHT })],
        }),
        new TableCell({
          width: { size: 17, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'จำนวนเงิน (บาท)', bold: true })], alignment: AlignmentType.RIGHT })],
        }),
      ],
    }),
  ]

  items.forEach((item, idx) => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    const lineTotal = qty * price
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1) })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: item.name || 'สินค้า' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `${qty} ${item.unit || 'ชิ้น'}` })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })], alignment: AlignmentType.RIGHT })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })], alignment: AlignmentType.RIGHT })],
          }),
        ],
      })
    )
  })

  const wordDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'ใบเสนอราคา (QUOTATION)',
                bold: true,
                size: 32,
                color: '1E3A8A',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: companyName, bold: true, size: 24 }),
              new TextRun({ text: `\nที่อยู่: ${address}`, size: 20 }),
              new TextRun({ text: `\nเลขประจำตัวผู้เสียภาษี: ${taxId} | โทรศัพท์: ${phone} | อีเมล: ${email}`, size: 20 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `เรียน (เสนอราคาถึง): ${customerName}`, bold: true, size: 22 }),
              new TextRun({ text: `\nเบอร์โทรศัพท์: ${customerPhone} | ที่อยู่: ${customerAddress}`, size: 20 }),
              new TextRun({ text: `\nเลขที่เอกสาร: ${doc.doc_number || doc.doc_no || '-'} | วันที่ออกเอกสาร: ${issueDate}`, size: 20 }),
            ],
            spacing: { after: 250 },
          }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `\nยอดรวมก่อนภาษี (Subtotal): ${subtotal} บาท`, bold: true, size: 22 }),
              ...(Number(doc.discount_amount || 0) > 0 ? [new TextRun({ text: `\nส่วนลด (Discount): -${discount} บาท`, size: 20, color: 'DC2626' })] : []),
              ...(Number(doc.vat_amount || 0) > 0 ? [new TextRun({ text: `\nภาษีมูลค่าเพิ่ม VAT 7%: ${vat} บาท`, size: 20 })] : []),
              new TextRun({ text: `\nยอดสุทธิทั้งสิ้น (Grand Total): ${total} บาท\n`, bold: true, size: 26, color: '1E40AF' }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200, after: 200 },
          }),
          ...(shop.bank_account_number || shop.promptpay_id ? [
            new Paragraph({
              children: [
                new TextRun({ text: 'ข้อมูลการชำระเงิน:\n', bold: true, size: 20 }),
                new TextRun({ text: `ธนาคาร: ${shop.bank_name || '-'} เลขที่บัญชี: ${shop.bank_account_number || '-'} ชื่อบัญชี: ${shop.bank_account_name || companyName}\n`, size: 20 }),
                ...(shop.promptpay_id ? [new TextRun({ text: `พร้อมเพย์: ${shop.promptpay_id}\n`, size: 20 })] : []),
              ],
              spacing: { after: 250 },
            }),
          ] : []),
          new Paragraph({
            children: [
              new TextRun({ text: `เงื่อนไขการชำระเงิน: ${doc.notes || 'กำหนดยืนราคา 30 วันนับจากวันที่ออกเอกสาร'}\n\n\n`, size: 18 }),
              new TextRun({ text: 'ลงชื่อ ............................................. ผู้เสนอราคา                   ลงชื่อ ............................................. ผู้สั่งซื้อ/อนุมัติ', size: 20 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
          }),
        ],
      },
    ],
  })

  return await Packer.toBuffer(wordDoc)
}

/**
 * Generates an Excel (.xlsx) Quotation using pure JavaScript (ExcelJS) as reliable fallback.
 */
export async function generateQuotationXlsxWithJs(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  const companyName = shop.company_name || shop.name || 'บริษัท / ร้านค้า'
  const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DealMee AI'
  const sheet = workbook.addWorksheet('ใบเสนอราคา')

  sheet.columns = [
    { header: 'ลำดับ', key: 'idx', width: 8 },
    { header: 'รายการสินค้า / บริการ', key: 'name', width: 38 },
    { header: 'หน่วย', key: 'unit', width: 12 },
    { header: 'จำนวน', key: 'qty', width: 10 },
    { header: 'ราคา/หน่วย (บาท)', key: 'price', width: 18 },
    { header: 'จำนวนเงิน (บาท)', key: 'total', width: 20 },
  ]

  sheet.spliceRows(1, 0,
    [`ใบเสนอราคา (QUOTATION) - ${doc.doc_number || doc.doc_no || ''}`],
    [`ผู้เสนอราคา: ${companyName}`],
    [`ลูกค้า: ${customerName} | เบอร์โทร: ${doc.customer_phone || '-'}`],
    [`วันที่ออกเอกสาร: ${new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH')}`],
    []
  )

  const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
  items.forEach((item, idx) => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    sheet.addRow([
      idx + 1,
      item.name || 'สินค้า',
      item.unit || 'ชิ้น',
      qty,
      price,
      qty * price,
    ])
  })

  sheet.addRow([])
  sheet.addRow(['', '', '', '', 'ยอดรวมก่อนภาษี:', Number(doc.subtotal || 0)])
  if (Number(doc.discount_amount || 0) > 0) {
    sheet.addRow(['', '', '', '', 'ส่วนลด:', -Number(doc.discount_amount || 0)])
  }
  if (Number(doc.vat_amount || 0) > 0) {
    sheet.addRow(['', '', '', '', 'ภาษีมูลค่าเพิ่ม 7%:', Number(doc.vat_amount || 0)])
  }
  sheet.addRow(['', '', '', '', 'ยอดสุทธิทั้งสิ้น:', Number(doc.total_amount || 0)])

  if (shop.bank_account_number) {
    sheet.addRow([])
    sheet.addRow([`การชำระเงิน: ธนาคาร ${shop.bank_name || ''} เลขที่บัญชี ${shop.bank_account_number} (${shop.bank_account_name || companyName})`])
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Generates a Word (.docx) Quotation using pure JS (fast, reliable, zero-crash in serverless)
 */
export async function generateQuotationDocx(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  return generateQuotationDocxWithJs(doc, shop)
}

/**
 * Generates an Excel (.xlsx) Quotation using pure JS (fast, reliable, zero-crash in serverless)
 */
export async function generateQuotationXlsx(
  doc: QuotationDocData,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  return generateQuotationXlsxWithJs(doc, shop)
}

export interface OfficialLetterDocData {
  id?: string
  doc_number?: string
  department?: string
  date_str?: string
  subject?: string
  recipient?: string
  reference_to?: string
  enclosures?: string
  body_facts?: string
  body_considerations?: string
  body_resolution?: string
  signatory_name?: string
  signatory_position?: string
  contact_info?: string
  notes?: string
  customer_name?: string
  created_at?: string
}

/**
 * Generates an Official Thai Government Letter (.docx) using pure JavaScript (docx library) as fallback
 */
export async function generateOfficialLetterDocxWithJs(
  rawDoc: any,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  let letter: OfficialLetterDocData = {}
  if (typeof rawDoc.notes === 'string' && rawDoc.notes.trim().startsWith('{')) {
    try {
      letter = JSON.parse(rawDoc.notes)
    } catch {
      letter = {}
    }
  } else {
    letter = rawDoc
  }

  const docNumber = rawDoc.doc_number || letter.doc_number || 'ที่ กท ......... / .........'
  const department = letter.department || shop.company_name || shop.name || 'หน่วยงาน'
  const dateStr = letter.date_str || new Date(rawDoc.created_at || Date.now()).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const subject = letter.subject || rawDoc.items?.[0]?.name || 'หนังสือราชการ'
  const recipient = letter.recipient || rawDoc.customer_name || 'ผู้รับหนังสือ'
  const referenceTo = letter.reference_to || ''
  const enclosures = letter.enclosures || ''
  const bodyFacts = letter.body_facts || ''
  const bodyConsiderations = letter.body_considerations || ''
  const bodyResolution = letter.body_resolution || ''
  const signatoryName = letter.signatory_name || '( .................................................... )'
  const signatoryPosition = letter.signatory_position || 'ผู้อำนวยการ / หัวหน้าหน่วยงาน'
  const contactInfo = letter.contact_info || `${shop.company_phone || ''} ${shop.company_email || ''}`.trim()

  const wordDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'ตราครุฑ', bold: true, size: 28, color: '991B1B' }),
              new TextRun({ text: '\n(หนังสือราชการภายนอก)', bold: true, size: 24 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `ที่ ${docNumber}`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${department}\n${shop.company_address || ''}`, bold: true }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [new TextRun({ text: dateStr })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `เรื่อง    ${subject}\n`, bold: true }),
              new TextRun({ text: `เรียน    ${recipient}\n`, bold: true }),
              ...(referenceTo ? [new TextRun({ text: `อ้างถึง   ${referenceTo}\n` })] : []),
              ...(enclosures ? [new TextRun({ text: `สิ่งที่ส่งมาด้วย   ${enclosures}\n` })] : []),
            ],
            spacing: { after: 200 },
          }),
          ...(bodyFacts ? [
            new Paragraph({
              children: [new TextRun({ text: `        ${bodyFacts}` })],
              spacing: { after: 150 },
            }),
          ] : []),
          ...(bodyConsiderations ? [
            new Paragraph({
              children: [new TextRun({ text: `        ${bodyConsiderations}` })],
              spacing: { after: 150 },
            }),
          ] : []),
          ...(bodyResolution ? [
            new Paragraph({
              children: [new TextRun({ text: `        ${bodyResolution}` })],
              spacing: { after: 300 },
            }),
          ] : []),
          new Paragraph({
            children: [
              new TextRun({ text: 'ขอแสดงความนับถือ\n\n\n' }),
              new TextRun({ text: `${signatoryName}\n`, bold: true }),
              new TextRun({ text: signatoryPosition }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `------------------------------------------------------------\n${department}\nติดต่อ: ${contactInfo}`, size: 18, color: '64748B' }),
            ],
          }),
        ],
      },
    ],
  })

  return await Packer.toBuffer(wordDoc)
}

/**
 * Generates an Official Thai Government Letter (.docx) using pure JS (fast, reliable, zero-crash in serverless)
 */
export async function generateOfficialLetterDocx(
  rawDoc: any,
  shop: ShopProfileData = {}
): Promise<Buffer> {
  return generateOfficialLetterDocxWithJs(rawDoc, shop)
}
