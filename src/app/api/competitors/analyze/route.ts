import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeCompetitorIntelligence, parseSocialUrl } from '@/lib/competitors/scraperEngine'
import { saveCompetitor } from '@/lib/competitors/competitorStore'

const supabase = createAdminClient()

/**
 * POST /api/competitors/analyze
 * Body: { shop_id: string, url: string, force_refresh?: boolean }
 * Features 24-Hour Smart Cache to save 100% of API Quota on repeat requests
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shop_id, url, force_refresh } = body

    if (!shop_id || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: shop_id, url' },
        { status: 400 }
      )
    }

    const parsed = parseSocialUrl(url)

    // 1. Quota Guard: Check 24-Hour Cache in Supabase
    if (!force_refresh) {
      const { data: cachedComp } = await supabase
        .from('competitors')
        .select('*, competitor_posts(*)')
        .eq('shop_id', shop_id)
        .or(`target_url.eq.${parsed.normalizedUrl},handle.eq.${parsed.handle}`)
        .order('last_scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cachedComp && cachedComp.last_scanned_at) {
        const scanTime = new Date(cachedComp.last_scanned_at).getTime()
        const hoursAgo = (Date.now() - scanTime) / (1000 * 60 * 60)

        // If scanned less than 24 hours ago, serve from cache (0 quota cost!)
        if (hoursAgo < 24) {
          let aiPlaybook = null
          try {
            aiPlaybook = cachedComp.notes ? JSON.parse(cachedComp.notes) : null
          } catch {}

          const cachedProfile = {
            name: cachedComp.name,
            handle: cachedComp.handle,
            platform: cachedComp.platform,
            target_url: cachedComp.target_url,
            avatar_url: cachedComp.avatar_url,
            follower_count: cachedComp.follower_count,
            avg_engagement_rate: cachedComp.avg_engagement_rate,
            price_range_min: cachedComp.price_range_min,
            price_range_max: cachedComp.price_range_max,
            posts: cachedComp.competitor_posts || [],
            priceComparison: [],
            aiPlaybook: aiPlaybook || {
              pricingStrategyVerdict: 'ข้อมูลสรุปจากแคชระบบ 24 ชม.',
              priceAdvantageBullets: ['ประหยัดโควต้า API สำเร็จ'],
              topViralHooks: [],
              winningCaptionTemplate: '',
              recommendedHashtags: [],
            },
            is_live_data: true,
            data_source: 'live_api',
            from_cache: true,
            cache_age_hours: Number(hoursAgo.toFixed(1)),
            last_scanned_at: cachedComp.last_scanned_at,
          }

          return NextResponse.json({
            success: true,
            from_cache: true,
            cache_age_hours: Number(hoursAgo.toFixed(1)),
            competitorId: cachedComp.id,
            data: cachedProfile,
          })
        }
      }
    }

    // 2. Fetch shop products for intelligent price & category comparison
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

    // Check if shop has a saved RapidAPI key in settings
    const { data: keySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `rapidapi_key_${shop_id}`)
      .maybeSingle()

    const rapidApiKey = keySetting?.value || process.env.RAPIDAPI_KEY || ''

    // 3. Run live scraping / competitive intelligence engine
    const profile = await scrapeCompetitorIntelligence(url, mappedProducts, {
      apiKey: rapidApiKey,
      forceRefresh: !!force_refresh,
    })

    // 4. Persist competitor profile to Supabase
    const saveRes = await saveCompetitor(shop_id, profile)

    return NextResponse.json({
      success: true,
      from_cache: false,
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
