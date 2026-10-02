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
  BorderStyle,
  ShadingType,
  ImageRun,
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
  logo_buffer?: Buffer
}

// Helper: Convert total number to Thai Baht text
function formatThaiBahtText(num: number): string {
  if (isNaN(num) || num === 0) return 'ศูนย์บาทถ้วน'
  const fixed = Number(num).toFixed(2)
  const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']
  const [baht, satang] = fixed.split('.')

  function readGroup(str: string): string {
    let result = ''
    const len = str.length
    for (let i = 0; i < len; i++) {
      const digit = Number(str[i])
      if (digit === 0) continue
      const pos = len - 1 - i
      if (pos === 0 && digit === 1 && len > 1 && str[len - 2] !== '0') {
        result += 'เอ็ด'
      } else if (pos === 1 && digit === 1) {
        result += 'สิบ'
      } else if (pos === 1 && digit === 2) {
        result += 'ยี่สิบ'
      } else {
        result += numbers[digit] + units[pos]
      }
    }
    return result
  }

  let text = ''
  if (baht.length > 6) {
    const millions = baht.slice(0, baht.length - 6)
    const rest = baht.slice(baht.length - 6)
    text += readGroup(millions) + 'ล้าน' + readGroup(rest) + 'บาท'
  } else {
    text += readGroup(baht) + 'บาท'
  }

  if (satang === '00') {
    text += 'ถ้วน'
  } else {
    text += readGroup(satang) + 'สตางค์'
  }
  return text
}

/**
 * Generates a Word (.docx) Quotation using pure JavaScript (docx library) with rich brand design matching web/PDF.
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

  const docNo = doc.doc_number || doc.doc_no || 'QT'
  const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const customerName = doc.customer_name || 'ลูกค้าผู้มีอุปการคุณ'
  const customerPhone = doc.customer_phone || '-'

  const subtotal = Number(doc.subtotal || 0)
  const discount = Number(doc.discount_amount || 0)
  const vat = Number(doc.vat_amount || 0)
  const total = Number(doc.total_amount || 0)

  let logoRun: ImageRun | undefined
  if (shop.logo_buffer && shop.logo_buffer.length > 0) {
    const isPng = shop.logo_buffer[0] === 0x89 && shop.logo_buffer[1] === 0x50
    logoRun = new ImageRun({
      data: shop.logo_buffer,
      transformation: { width: 55, height: 55 },
      type: isPng ? 'png' : 'jpg',
    })
  }

  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }

  const lightCardBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
    left: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' },
  }

  // 1. Header Section: Logo + Company Info (Left) & Quotation Title + Meta (Right)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          // Left: Logo + Shop Details
          new TableCell({
            width: { size: 58, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: borderNone,
                rows: [
                  new TableRow({
                    children: [
                      ...(logoRun ? [
                        new TableCell({
                          width: { size: 22, type: WidthType.PERCENTAGE },
                          borders: borderNone,
                          children: [new Paragraph({ children: [logoRun] })],
                        })
                      ] : []),
                      new TableCell({
                        width: { size: logoRun ? 78 : 100, type: WidthType.PERCENTAGE },
                        borders: borderNone,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: companyName, bold: true, size: 26, color: '0F172A', font: 'Sarabun' }),
                              new TextRun({ text: '  ผู้ให้บริการ', size: 18, color: '2563EB', bold: true, font: 'Sarabun' }),
                            ],
                            spacing: { after: 60 },
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({ text: address, size: 18, color: '475569', font: 'Sarabun' }),
                              new TextRun({ text: `โทร: ${phone}`, size: 18, color: '2563EB', bold: true, break: 1, font: 'Sarabun' }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Right: Title & Document Metadata
          new TableCell({
            width: { size: 42, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ใบเสนอราคา', bold: true, size: 38, color: '2563EB', font: 'Sarabun' }),
                  new TextRun({ text: 'QUOTATION', bold: true, size: 18, color: '64748B', break: 1, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: borderNone,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: 'เลขที่เอกสาร:', size: 18, color: '64748B', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: docNo, bold: true, size: 18, color: '1E40AF', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: 'วันที่ออกเอกสาร:', size: 18, color: '64748B', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: issueDate, size: 18, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: 'กำหนดยืนราคา:', size: 18, color: '64748B', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                      new TableCell({
                        borders: borderNone,
                        children: [new Paragraph({ children: [new TextRun({ text: '30 วัน', bold: true, size: 18, color: '059669', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // 2. Customer Card Table
  const customerCard = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: lightCardBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
            borders: lightCardBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ลูกค้าผู้รับการเสนอราคา / CUSTOMER', bold: true, size: 17, color: '2563EB', font: 'Sarabun' }),
                  new TextRun({ text: customerName, bold: true, size: 24, color: '0F172A', break: 1, font: 'Sarabun' }),
                  new TextRun({ text: `เบอร์โทรศัพท์: ${customerPhone}`, size: 18, color: '475569', break: 1, font: 'Sarabun' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
            borders: lightCardBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: '● รออนุมัติการสั่งซื้อ (Pending)', bold: true, size: 18, color: 'D97706', font: 'Sarabun' }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // 3. Products Table with Brand Slate Header & Single-line column titles
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
  }

  const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
  const itemTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'รายการสินค้า', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })] })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'จำนวน', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'หน่วย', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'ราคา/หน่วย', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          borders: tableBorder,
          children: [new Paragraph({ children: [new TextRun({ text: 'จำนวนเงิน (บาท)', bold: true, color: 'FFFFFF', size: 19, font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
        }),
      ],
    }),
  ]

  items.forEach((item, idx) => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    const lineTotal = qty * price
    const isEven = idx % 2 === 1
    const rowFill = isEven ? 'F8FAFC' : 'FFFFFF'

    itemTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 19, color: '475569', font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: item.name || 'สินค้า', size: 19, bold: true, color: '0F172A', font: 'Sarabun' })] })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: String(qty), size: 19, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: item.unit || 'ชิ้น', size: 19, color: '475569', font: 'Sarabun' })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), size: 19, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
          }),
          new TableCell({
            borders: tableBorder,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            children: [new Paragraph({ children: [new TextRun({ text: lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bold: true, size: 19, color: '0F172A', font: 'Sarabun' })], alignment: AlignmentType.RIGHT })],
          }),
        ],
      })
    )
  })

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorder,
    rows: itemTableRows,
  })

  // 4. Bottom 2-Column Section: Payment Card (Left) & Totals / Blue Grand Total Box (Right)
  const bottomSectionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          // Left: Payment Box
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              ...(shop.bank_account_number || shop.promptpay_id ? [
                new Table({
                  width: { size: 96, type: WidthType.PERCENTAGE },
                  borders: lightCardBorder,
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          borders: lightCardBorder,
                          shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({ text: '💳 ช่องทางการชำระเงิน (Payment Details)', bold: true, size: 19, color: '1E40AF', font: 'Sarabun' }),
                                new TextRun({ text: `ธนาคาร: ${shop.bank_name || '-'}`, size: 18, color: '0F172A', break: 1, font: 'Sarabun' }),
                                new TextRun({ text: `เลขที่บัญชี: ${shop.bank_account_number || '-'}`, bold: true, size: 20, color: '1E40AF', break: 1, font: 'Sarabun' }),
                                new TextRun({ text: `ชื่อบัญชี: ${shop.bank_account_name || companyName}`, size: 18, color: '475569', break: 1, font: 'Sarabun' }),
                                ...(shop.promptpay_id ? [new TextRun({ text: `PromptPay: ${shop.promptpay_id}`, bold: true, size: 19, color: '0F172A', break: 1, font: 'Sarabun' })] : []),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ] : []),
            ],
          }),
          // Right: Summary & Blue Grand Total Box
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `ยอดรวมก่อนภาษี (Subtotal):  ${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: 19, color: '475569', font: 'Sarabun' }),
                  ...(discount > 0 ? [new TextRun({ text: `ส่วนลด (Discount):  -${discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: 19, color: 'DC2626', break: 1, font: 'Sarabun' })] : []),
                  ...(vat > 0 ? [new TextRun({ text: `ภาษีมูลค่าเพิ่ม VAT 7%:  ${vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: 19, color: '475569', break: 1, font: 'Sarabun' })] : []),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: lightCardBorder,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: lightCardBorder,
                        shading: { type: ShadingType.CLEAR, fill: '2563EB' },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: 'ยอดสุทธิทั้งสิ้น (Grand Total):  ', bold: true, size: 20, color: 'FFFFFF', font: 'Sarabun' }),
                              new TextRun({ text: `฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, bold: true, size: 28, color: 'FFFFFF', font: 'Sarabun' }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `( ${formatThaiBahtText(total)} )`, size: 17, color: '64748B', italics: true, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 80 },
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // 5. Signatures Section
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ลงชื่อ ................................................................', size: 18, color: '64748B', font: 'Sarabun' }),
                  new TextRun({ text: `( ${companyName} )`, bold: true, size: 18, color: '0F172A', break: 1, font: 'Sarabun' }),
                  new TextRun({ text: 'ผู้เสนอราคา', size: 17, color: '64748B', break: 1, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'ลงชื่อ ................................................................', size: 18, color: '64748B', font: 'Sarabun' }),
                  new TextRun({ text: `( ${customerName} )`, bold: true, size: 18, color: '0F172A', break: 1, font: 'Sarabun' }),
                  new TextRun({ text: 'ผู้สั่งซื้อ / ผู้อนุมัติ', size: 17, color: '64748B', break: 1, font: 'Sarabun' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,    // 0.5 inch
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 150 } }),
          customerCard,
          new Paragraph({ spacing: { after: 150 } }),
          itemsTable,
          new Paragraph({ spacing: { after: 150 } }),
          bottomSectionTable,
          new Paragraph({ spacing: { after: 350 } }),
          signatureTable,
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
  const docNo = doc.doc_number || doc.doc_no || '-'
  const issueDate = new Date(doc.created_at || Date.now()).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DealMee AI'
  const sheet = workbook.addWorksheet('ใบเสนอราคา', {
    views: [{ showGridLines: true }]
  })

  sheet.columns = [
    { key: 'col1', width: 8 },
    { key: 'col2', width: 40 },
    { key: 'col3', width: 14 },
    { key: 'col4', width: 12 },
    { key: 'col5', width: 18 },
    { key: 'col6', width: 22 },
  ]

  // Header Title
  const titleRow = sheet.addRow([`ใบเสนอราคา (QUOTATION) - ${docNo}`])
  titleRow.height = 30
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '1E3A8A' } }
  sheet.getCell('A1').alignment = { vertical: 'middle' }
  sheet.mergeCells('A1:F1')

  // Business & Customer Details
  sheet.addRow([`ผู้เสนอราคา: ${companyName}`, '', '', `เลขที่เอกสาร: ${docNo}`])
  sheet.addRow([`ที่อยู่: ${shop.company_address || '-'}`, '', '', `วันที่ออกเอกสาร: ${issueDate}`])
  sheet.addRow([`ลูกค้า: ${customerName} | โทร: ${doc.customer_phone || '-'}`, '', '', `กำหนดยืนราคา: 30 วัน`])
  sheet.addRow([])

  // Items Table Header
  const headerRow = sheet.addRow(['#', 'รายการสินค้า / บริการ', 'หน่วย', 'จำนวน', 'ราคา/หน่วย (บาท)', 'จำนวนเงิน (บาท)'])
  headerRow.height = 24
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    }
  })

  const items = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : []
  items.forEach((item, idx) => {
    const qty = Number(item.qty || 1)
    const price = Number(item.price || 0)
    const lineTotal = qty * price
    const row = sheet.addRow([
      idx + 1,
      item.name || 'สินค้า',
      item.unit || 'ชิ้น',
      qty,
      price,
      lineTotal,
    ])
    row.height = 22
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }

    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0.00'
    row.getCell(6).numFmt = '#,##0.00'

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } },
      }
    })
  })

  // Summary Rows
  sheet.addRow([])
  const addSummaryRow = (label: string, val: number, isGrandTotal = false) => {
    const sRow = sheet.addRow(['', '', '', '', label, val])
    sRow.height = isGrandTotal ? 24 : 20
    sRow.getCell(5).font = { bold: isGrandTotal, size: isGrandTotal ? 12 : 10, color: { argb: isGrandTotal ? '1E3A8A' : '0F172A' } }
    sRow.getCell(6).font = { bold: isGrandTotal, size: isGrandTotal ? 12 : 10, color: { argb: isGrandTotal ? '1E3A8A' : '0F172A' } }
    sRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' }
    sRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' }
    sRow.getCell(6).numFmt = '#,##0.00'
    if (isGrandTotal) {
      sRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } }
      sRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } }
    }
  }

  addSummaryRow('ยอดรวมก่อนภาษี:', Number(doc.subtotal || 0))
  if (Number(doc.discount_amount || 0) > 0) {
    addSummaryRow('ส่วนลด:', -Number(doc.discount_amount || 0))
  }
  if (Number(doc.vat_amount || 0) > 0) {
    addSummaryRow('ภาษีมูลค่าเพิ่ม 7%:', Number(doc.vat_amount || 0))
  }
  addSummaryRow('ยอดสุทธิทั้งสิ้น (บาท):', Number(doc.total_amount || 0), true)

  if (shop.bank_account_number || shop.promptpay_id) {
    sheet.addRow([])
    const bankText = `การชำระเงิน: ธนาคาร ${shop.bank_name || '-'} เลขที่บัญชี ${shop.bank_account_number || '-'} ชื่อบัญชี ${shop.bank_account_name || companyName}`
    const bRow = sheet.addRow([bankText])
    bRow.getCell(1).font = { size: 10, italic: true, color: { argb: '475569' } }
    if (shop.promptpay_id) {
      const pRow = sheet.addRow([`พร้อมเพย์: ${shop.promptpay_id}`])
      pRow.getCell(1).font = { size: 10, italic: true, color: { argb: '475569' } }
    }
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
              new TextRun({ text: '(หนังสือราชการภายนอก)', bold: true, size: 24, break: 1 }),
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
              new TextRun({ text: department, bold: true }),
              ...(shop.company_address ? [new TextRun({ text: shop.company_address, bold: true, break: 1 })] : []),
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
              new TextRun({ text: `เรื่อง    ${subject}`, bold: true }),
              new TextRun({ text: `เรียน    ${recipient}`, bold: true, break: 1 }),
              ...(referenceTo ? [new TextRun({ text: `อ้างถึง   ${referenceTo}`, break: 1 })] : []),
              ...(enclosures ? [new TextRun({ text: `สิ่งที่ส่งมาด้วย   ${enclosures}`, break: 1 })] : []),
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
              new TextRun({ text: 'ขอแสดงความนับถือ' }),
              new TextRun({ text: signatoryName, bold: true, break: 2 }),
              new TextRun({ text: signatoryPosition, break: 1 }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '------------------------------------------------------------', size: 18, color: '64748B' }),
              new TextRun({ text: department, size: 18, color: '64748B', break: 1 }),
              new TextRun({ text: `ติดต่อ: ${contactInfo}`, size: 18, color: '64748B', break: 1 }),
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
