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
    const stockText = p.stock !== null && p.stock !== undefined ? `คงเหลือ ${p.stock} ชิ้น` : 'พร้อมส่ง'

    const bodyContents: any[] = [
      {
        type: 'text',
        text: p.name,
        weight: 'bold',
        size: 'md',
        wrap: true,
        maxLines: 2,
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
            color: '#06C755',
          },
          {
            type: 'text',
            text: stockText,
            size: 'xs',
            color: '#888888',
            align: 'end',
          },
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
        spacing: 'sm',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            height: 'sm',
            action: {
              type: 'message',
              label: 'สั่งซื้อสินค้านี้',
              text: `สั่งซื้อ ${p.name}`,
            },
          },
        ],
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
