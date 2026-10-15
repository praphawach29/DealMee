import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeCompetitorIntelligence } from '@/lib/competitors/scraperEngine'
import { saveCompetitor } from '@/lib/competitors/competitorStore'

const supabase = createAdminClient()

/**
 * POST /api/competitors/analyze
 * Body: { shop_id: string, url: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shop_id, url } = body

    if (!shop_id || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: shop_id, url' },
        { status: 400 }
      )
    }

    // 1. Fetch shop products for intelligent price & category comparison
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, stock, category')
      .eq('shop_id', shop_id)
      .limit(10)

    const mappedProducts = (products || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
    }))

    // 2. Run scraping and competitive intelligence engine
    const profile = await scrapeCompetitorIntelligence(url, mappedProducts)

    // 3. Persist competitor profile
    const saveRes = await saveCompetitor(shop_id, profile)

    return NextResponse.json({
      success: true,
      competitorId: saveRes.id,
      data: profile,
    })
  } catch (err: any) {
    console.error('[Competitor Analysis API Error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to analyze competitor profile' },
      { status: 500 }
    )
  }
}
