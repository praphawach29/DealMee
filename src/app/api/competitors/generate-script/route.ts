import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateViralScriptFromCompetitor } from '@/lib/ai/competitorVideoScript'
import { requireShop } from '@/lib/auth/requireShop'

const supabase = createAdminClient()

/**
 * POST /api/competitors/generate-script
 * Generates an actionable 5-part short-form video production script
 * tailored to convert viewers away from competitor viral hooks to the merchant's product.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    const shop_id = auth.shopId
    const body = await req.json()
    const { competitor_name, video_title, product_id } = body

    if (!video_title) {
      return NextResponse.json(
        { error: 'Missing required parameter: video_title' },
        { status: 400 }
      )
    }

    // 1. Fetch shop info
    const { data: shop } = await supabase
      .from('shops')
      .select('name')
      .eq('id', shop_id)
      .maybeSingle()

    // 2. Fetch product info (selected product or shop's first available product)
    let productInfo: { name: string; price: number; features?: string } | undefined

    if (product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('name, price, description')
        .eq('id', product_id)
        .eq('shop_id', shop_id)
        .maybeSingle()

      if (prod) {
        productInfo = {
          name: prod.name,
          price: Number(prod.price) || 0,
          features: prod.description || undefined,
        }
      }
    } else {
      const { data: defaultProd } = await supabase
        .from('products')
        .select('name, price, description')
        .eq('shop_id', shop_id)
        .order('price', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (defaultProd) {
        productInfo = {
          name: defaultProd.name,
          price: Number(defaultProd.price) || 0,
          features: defaultProd.description || undefined,
        }
      }
    }

    // 3. Generate 5-part production script
    const script = await generateViralScriptFromCompetitor({
      competitorVideoTitle: video_title,
      competitorName: competitor_name || 'ร้านคู่แข่ง',
      myProduct: productInfo,
      shopName: shop?.name || 'DealMee Store',
    })

    return NextResponse.json({
      success: true,
      script,
      matched_product: productInfo || null,
    })
  } catch (err: any) {
    console.error('[Generate Script API Error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to generate viral video script' },
      { status: 500 }
    )
  }
}
