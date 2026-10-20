import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeCompetitorIntelligence, parseSocialUrl, CompetitorScanError } from '@/lib/competitors/scraperEngine'
import { generateCompetitorPlaybook } from '@/lib/competitors/competitorPlaybook'
import { saveCompetitor } from '@/lib/competitors/competitorStore'
import { canScanCompetitor, incrementCompetitorQuota, getCompetitorQuota } from '@/lib/billing/competitorQuota'
import { requireShop } from '@/lib/auth/requireShop'

const supabase = createAdminClient()

/**
 * POST /api/competitors/analyze
 * Body: { url: string, force_refresh?: boolean } (shop comes from the session)
 * A scan of the same account within 24 hours is served from the saved copy at no quota cost
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireShop()
    if (auth.error) return auth.error
    const shop_id = auth.shopId
    const body = await req.json()
    const { url, force_refresh } = body

    if (!url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
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
            aiPlaybook,
            is_live_data: true,
            data_source: 'live_api',
            from_cache: true,
            cache_age_hours: Number(hoursAgo.toFixed(1)),
            last_scanned_at: cachedComp.last_scanned_at,
          }

          const currentQuota = await getCompetitorQuota(shop_id)

          return NextResponse.json({
            success: true,
            from_cache: true,
            cache_age_hours: Number(hoursAgo.toFixed(1)),
            competitorId: cachedComp.id,
            data: cachedProfile,
            quota: currentQuota,
          })
        }
      }
    }

    // 2. Quota Guard: Check if shop has remaining scan quota for fresh scrapes
    const { allowed, quota } = await canScanCompetitor(shop_id)
    if (!allowed) {
      return NextResponse.json(
        {
          error: `โควต้าการส่องคู่แข่งของคุณในเดือนนี้หมดแล้ว (${quota.used}/${quota.total} ครั้ง) กรุณาอัปเกรดแพ็กเกจเพื่อใช้งานต่อ`,
          quota_exceeded: true,
          quota,
        },
        { status: 403 }
      )
    }

    // 3. Fetch shop products for intelligent price & category comparison
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

    // 4. Fetch the real profile; a platform we can't read, a missing key or an
    // account that can't be found costs no quota and saves nothing
    let profile
    try {
      profile = await scrapeCompetitorIntelligence(url, { apiKey: rapidApiKey })
    } catch (err) {
      if (err instanceof CompetitorScanError) {
        return NextResponse.json({ error: err.message, reason: err.reason }, { status: 422 })
      }
      throw err
    }

    // The strategy is written from the posts just fetched and the shop's own products
    profile.aiPlaybook = await generateCompetitorPlaybook({
      competitorName: profile.name,
      platform: profile.platform,
      followerCount: profile.follower_count,
      posts: profile.posts,
      myProducts: mappedProducts,
    })

    // 5. Persist competitor profile to Supabase
    const saveRes = await saveCompetitor(shop_id, profile)

    // 6. Deduct 1 fresh scan from quota
    await incrementCompetitorQuota(shop_id)
    const freshQuota = await getCompetitorQuota(shop_id)

    return NextResponse.json({
      success: true,
      from_cache: false,
      competitorId: saveRes.id,
      data: profile,
      quota: freshQuota,
    })
  } catch (err: any) {
    console.error('[Competitor Analysis API Error]:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to analyze competitor profile' },
      { status: 500 }
    )
  }
}
