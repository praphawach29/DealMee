export interface ProductItem {
  id: string
  name: string
  price: number
  stock?: number | null
  description?: string | null
  image_url?: string | null
}

/**
 * Builds a LINE Flex Carousel Message for displaying products visually with images, prices, and quick order buttons.
 */
export function buildLineFlexProductCarousel(products: ProductItem[]) {
  if (!products || products.length === 0) return null

  const defaultImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'

  const bubbles = products.slice(0, 10).map((p) => {
    const imageUrl = p.image_url && p.image_url.startsWith('http') ? p.image_url : defaultImage
    const priceFormatted = `฿${Number(p.price || 0).toLocaleString('th-TH')}`

    const isOutOfStock = p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0

    // Stock status pill badge
    const stockBadge = isOutOfStock
      ? {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: '#FEE2E2',
          cornerRadius: 'md',
          paddingAll: 'xs',
          paddingStart: 'sm',
          paddingEnd: 'sm',
          contents: [
            {
              type: 'text',
              text: '❌ สินค้าหมดชั่วคราว (Out of Stock)',
              size: 'xs',
              color: '#DC2626',
              weight: 'bold',
            },
          ],
        }
      : {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: '#DCFCE7',
          cornerRadius: 'md',
          paddingAll: 'xs',
          paddingStart: 'sm',
          paddingEnd: 'sm',
          contents: [
            {
              type: 'text',
              text: p.stock ? `✓ สินค้าพร้อมส่ง (คงเหลือ ${p.stock} ชิ้น)` : '✓ สินค้าพร้อมส่ง',
              size: 'xs',
              color: '#16A34A',
              weight: 'bold',
            },
          ],
        }

    const bodyContents: any[] = [
      stockBadge,
      {
        type: 'text',
        text: p.name,
        weight: 'bold',
        size: 'md',
        wrap: true,
        maxLines: 2,
        margin: 'sm',
      },
      {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: priceFormatted,
            weight: 'bold',
            size: 'xl',
            color: isOutOfStock ? '#9CA3AF' : '#06C755',
          },
          ...(isOutOfStock
            ? [
                {
                  type: 'text',
                  text: '(หมด)',
                  size: 'xs',
                  color: '#DC2626',
                  align: 'end',
                },
              ]
            : []),
        ],
      },
    ]

    if (p.description) {
      bodyContents.push({
        type: 'text',
        text: p.description,
        size: 'xs',
        color: '#666666',
        wrap: true,
        maxLines: 2,
        margin: 'md',
      })
    }

    const buttonConfig = isOutOfStock
      ? {
          type: 'button',
          style: 'secondary',
          color: '#F3F4F6',
          height: 'sm',
          action: {
            type: 'message',
            label: 'แจ้งเมื่อมีสินค้าเติม',
            text: `สอบถามสินค้าเติมสต็อก ${p.name}`,
          },
        }
      : {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'sm',
          action: {
            type: 'message',
            label: 'สั่งซื้อสินค้านี้',
            text: `สั่งซื้อ ${p.name}`,
          },
        }

    return {
      type: 'bubble',
      hero: {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [buttonConfig],
      },
    }
  })

  return {
    type: 'flex',
    altText: `🛍️ รายการสินค้าแนะนำ (${products.length} รายการ)`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  }
}

export interface QuotationFlexData {
  shopName: string
  companyName?: string
  logoUrl?: string
  docNumber: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  items: Array<{ name: string; qty: number; price: number; unit?: string }>
  subtotal: number
  discountAmount?: number
  vatAmount?: number
  totalAmount: number
  docUrl: string
  wordUrl?: string
  excelUrl?: string
}

/**
 * Builds a professional LINE Flex Message card for Quotations with detailed items and direct view/print/download buttons.
 */
export function buildLineFlexQuotationMessage(data: QuotationFlexData) {
  const items = data.items || []
  const formattedTotal = Number(data.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formattedSubtotal = Number(data.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const wordUrl = data.wordUrl || `${data.docUrl.replace('/doc/quotation/', '/api/doc/')}/download?format=docx`

  const itemRows: any[] = items.slice(0, 5).map((it) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `${it.name || 'สินค้า'} x${it.qty || 1}`,
        size: 'xs',
        color: '#334155',
        flex: 4,
        wrap: true,
      },
      {
        type: 'text',
        text: `฿${Number((it.price || 0) * (it.qty || 1)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        size: 'xs',
        color: '#0F172A',
        weight: 'bold',
        align: 'end',
        flex: 3,
      },
    ],
  }))

  const bodyContents: any[] = [
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        {
          type: 'text',
          text: 'เรียน (เสนอราคาถึง):',
          size: 'xxs',
          color: '#94A3B8',
          weight: 'bold',
        },
        {
          type: 'text',
          text: data.customerName || 'ลูกค้าผู้มีอุปการคุณ',
          size: 'sm',
          weight: 'bold',
          color: '#1E293B',
        },
        ...(data.customerPhone
          ? [
              {
                type: 'text',
                text: `เบอร์ติดต่อ: ${data.customerPhone}`,
                size: 'xs',
                color: '#64748B',
              },
            ]
          : []),
      ],
    },
    { type: 'separator', color: '#F1F5F9', margin: 'md' },
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: 'รายการสินค้าและบริการ',
          size: 'xxs',
          color: '#94A3B8',
          weight: 'bold',
        },
        ...itemRows,
        ...(items.length > 5
          ? [
              {
                type: 'text',
                text: `...และรายการอื่นๆ อีก ${items.length - 5} รายการ`,
                size: 'xxs',
                color: '#64748B',
                style: 'italic',
              },
            ]
          : []),
      ],
    },
    { type: 'separator', color: '#F1F5F9', margin: 'md' },
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: 'md',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'ยอดรวมก่อนภาษี', size: 'xs', color: '#64748B' },
            { type: 'text', text: `฿${formattedSubtotal}`, size: 'xs', color: '#334155', align: 'end' },
          ],
        },
        ...(data.discountAmount && data.discountAmount > 0
          ? [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ส่วนลด (Discount)', size: 'xs', color: '#EF4444' },
                  {
                    type: 'text',
                    text: `-฿${Number(data.discountAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                    size: 'xs',
                    color: '#EF4444',
                    align: 'end',
                  },
                ],
              },
            ]
          : []),
        ...(data.vatAmount && data.vatAmount > 0
          ? [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ภาษีมูลค่าเพิ่ม (VAT 7%)', size: 'xs', color: '#64748B' },
                  {
                    type: 'text',
                    text: `฿${Number(data.vatAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                    size: 'xs',
                    color: '#334155',
                    align: 'end',
                  },
                ],
              },
            ]
          : []),
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'ยอดสุทธิทั้งสิ้น', size: 'sm', weight: 'bold', color: '#1E293B' },
            { type: 'text', text: `฿${formattedTotal}`, size: 'lg', weight: 'bold', color: '#2E5BFF', align: 'end' },
          ],
        },
      ],
    },
  ]

  return {
    type: 'flex',
    altText: `📄 ใบเสนอราคา ${data.docNumber} ยอดรวม ฿${formattedTotal} บาท`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#2E5BFF',
        paddingAll: 'xl',
        paddingBottom: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '📄 ใบเสนอราคา (QUOTATION)',
                color: '#FFFFFF',
                weight: 'bold',
                size: 'xs',
              },
            ],
          },
          {
            type: 'text',
            text: data.docNumber,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'md',
            margin: 'xs',
          },
          {
            type: 'text',
            text: data.companyName || data.shopName,
            color: '#E0E7FF',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'xl',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#2E5BFF',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📄 ดูใบเสนอราคา / บันทึก PDF',
              uri: data.docUrl,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            color: '#F1F5F9',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📥 ดาวน์โหลด Word (.docx)',
              uri: wordUrl,
            },
          },
          {
            type: 'text',
            text: 'สร้างโดย OfficeCLI เอกสาร A4 ถูกต้องตามมาตรฐาน',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            margin: 'xs',
          },
        ],
      },
    },
  }
}

export interface OfficialLetterFlexData {
  shopName: string
  companyName?: string
  docNumber: string
  subject: string
  recipient: string
  department: string
  dateStr: string
  docUrl: string
  wordUrl?: string
}

/**
 * Builds a professional LINE Flex Message card for Official Thai Government Letters.
 */
export function buildLineFlexOfficialLetterMessage(data: OfficialLetterFlexData) {
  const wordUrl = data.wordUrl || `${data.docUrl.replace('/doc/official/', '/api/doc/')}/download?format=docx`

  return {
    type: 'flex',
    altText: `📜 หนังสือราชการ: ${data.subject} (${data.docNumber})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#8B0000',
        paddingAll: 'xl',
        paddingBottom: 'lg',
        contents: [
          {
            type: 'text',
            text: 'ตราครุฑ • หนังสือราชการภายนอก',
            color: '#FEF08A',
            weight: 'bold',
            size: 'xs',
          },
          {
            type: 'text',
            text: data.docNumber,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'md',
            margin: 'xs',
          },
          {
            type: 'text',
            text: data.department || data.companyName || data.shopName,
            color: '#FEE2E2',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'xl',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'เรื่อง:', size: 'xxs', color: '#94A3B8', weight: 'bold' },
              { type: 'text', text: data.subject, size: 'sm', weight: 'bold', color: '#1E293B', wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: 'เรียน:', size: 'xxs', color: '#94A3B8', weight: 'bold' },
              { type: 'text', text: data.recipient, size: 'sm', color: '#334155', wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วันที่ออกหนังสือ', size: 'xs', color: '#64748B' },
              { type: 'text', text: data.dateStr, size: 'xs', color: '#1E293B', align: 'end', weight: 'bold' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#8B0000',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📄 เปิดดูหนังสือราชการ (A4)',
              uri: data.docUrl,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            color: '#F1F5F9',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📥 ดาวน์โหลด Word (.docx)',
              uri: wordUrl,
            },
          },
          {
            type: 'text',
            text: 'จัดฟอร์แมตตามระเบียบสารบรรณ 100% ด้วย OfficeCLI',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            margin: 'xs',
          },
        ],
      },
    },
  }
}

