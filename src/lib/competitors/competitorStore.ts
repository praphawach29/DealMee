import { createAdminClient } from '@/lib/supabase/admin'
import { ScrapedCompetitorProfile } from './scraperEngine'

export interface CompetitorRecord {
  id: string
  shop_id: string
  name: string
  platform: string
  target_url: string
  handle: string
  avatar_url?: string
  follower_count: number
  avg_engagement_rate: number
  price_range_min: number
  price_range_max: number
  profile_data?: ScrapedCompetitorProfile
  created_at: string
}

const supabase = createAdminClient()

/**
 * Save or update a competitor profile for a shop
 * Features dual-mode persistence (direct SQL table with automatic fallback to settings table)
 */
export async function saveCompetitor(
  shopId: string,
  profile: ScrapedCompetitorProfile
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const compId = `comp-${Date.now()}`

    // 1. Write to public.competitors: a rescan updates the shop's existing row for
    // this account (and replaces its posts) instead of adding a second one
    const row = {
      shop_id: shopId,
      name: profile.name,
      platform: profile.platform,
      target_url: profile.target_url,
      handle: profile.handle,
      avatar_url: profile.avatar_url,
      follower_count: profile.follower_count,
      avg_engagement_rate: profile.avg_engagement_rate,
      price_range_min: profile.price_range_min,
      price_range_max: profile.price_range_max,
      notes: JSON.stringify(profile.aiPlaybook),
      last_scanned_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase
      .from('competitors')
      .select('id')
      .eq('shop_id', shopId)
      .eq('platform', profile.platform)
      .eq('handle', profile.handle)
      .order('last_scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = existing
      ? await supabase.from('competitors').update(row).eq('id', existing.id).select('id').single()
      : await supabase.from('competitors').insert(row).select('id').single()

    if (!error && data?.id && existing) {
      await supabase.from('competitor_posts').delete().eq('competitor_id', data.id)
    }

    if (!error && data?.id) {
      // Also insert posts
      if (profile.posts && profile.posts.length > 0) {
        const postRows = profile.posts.map((p) => ({
          competitor_id: data.id,
          shop_id: shopId,
          platform: profile.platform,
          post_url: p.post_url,
          thumbnail_url: p.thumbnail_url,
          title_or_caption: p.title_or_caption,
          views_count: p.views_count,
          likes_count: p.likes_count,
          comments_count: p.comments_count,
          shares_count: p.shares_count,
          engagement_rate: p.engagement_rate,
          hashtags: p.hashtags,
          published_at: p.published_at,
        }))
        try {
          await supabase.from('competitor_posts').insert(postRows)
        } catch {}
      }
      return { success: true, id: data.id }
    }

    // 2. Graceful Fallback to settings table
    console.log('[CompetitorStore] Using resilient settings store for competitor intelligence...')
    const settingKey = `competitors_${shopId}`
    const { data: currentSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', settingKey)
      .maybeSingle()

    let list: any[] = []
    try {
      if (currentSetting?.value) {
        list = typeof currentSetting.value === 'string' ? JSON.parse(currentSetting.value) : currentSetting.value
      }
    } catch {}

    const newRecord: CompetitorRecord = {
      id: compId,
      shop_id: shopId,
      name: profile.name,
      platform: profile.platform,
      target_url: profile.target_url,
      handle: profile.handle,
      avatar_url: profile.avatar_url,
      follower_count: profile.follower_count,
      avg_engagement_rate: profile.avg_engagement_rate,
      price_range_min: profile.price_range_min,
      price_range_max: profile.price_range_max,
      profile_data: profile,
      created_at: new Date().toISOString(),
    }

    // Upsert or prepend
    const existingIndex = list.findIndex((c) => c.target_url === profile.target_url || c.handle === profile.handle)
    if (existingIndex >= 0) {
      list[existingIndex] = newRecord
    } else {
      list.unshift(newRecord)
    }

    await supabase.from('settings').upsert({
      key: settingKey,
      value: JSON.stringify(list),
    }, { onConflict: 'key' })

    return { success: true, id: compId }
  } catch (err: any) {
    console.error('[saveCompetitor Exception]:', err)
    return { success: false, id: '', error: err.message || String(err) }
  }
}

/**
 * Retrieve all tracked competitors for a shop
 */
export async function getCompetitors(shopId: string): Promise<CompetitorRecord[]> {
  try {
    // 1. Try public.competitors table
    const { data: dbComps, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })

    if (!error && dbComps && dbComps.length > 0) {
      const compIds = dbComps.map((c: any) => c.id)
      const { data: allPosts } = await supabase
        .from('competitor_posts')
        .select('*')
        .in('competitor_id', compIds)
        .order('views_count', { ascending: false })

      return dbComps.map((c: any) => {
        let aiPlaybook = null
        try {
          if (c.notes) {
            aiPlaybook = typeof c.notes === 'string' ? JSON.parse(c.notes) : c.notes
          }
        } catch {}

        const posts = (allPosts || [])
          .filter((p: any) => p.competitor_id === c.id)
          .map((p: any) => ({
            id: p.id,
            post_url: p.post_url,
            thumbnail_url: p.thumbnail_url,
            title_or_caption: p.title_or_caption,
            views_count: Number(p.views_count) || 0,
            likes_count: Number(p.likes_count) || 0,
            comments_count: Number(p.comments_count) || 0,
            shares_count: Number(p.shares_count) || 0,
            engagement_rate: Number(p.engagement_rate) || 0,
            hashtags: p.hashtags || [],
            published_at: p.published_at,
          }))

        const profile_data: ScrapedCompetitorProfile = {
          name: c.name,
          handle: c.handle || `@${c.name.toLowerCase().replace(/\s+/g, '_')}`,
          platform: c.platform,
          target_url: c.target_url,
          avatar_url: c.avatar_url || '',
          follower_count: Number(c.follower_count) || 0,
          avg_engagement_rate: Number(c.avg_engagement_rate) || 0,
          price_range_min: Number(c.price_range_min) || 0,
          price_range_max: Number(c.price_range_max) || 0,
          posts,
          priceComparison: [],
          aiPlaybook,
          is_live_data: true,
          data_source: 'live_api',
          last_scanned_at: c.last_scanned_at || c.created_at,
        }

        return {
          id: c.id,
          shop_id: c.shop_id,
          name: c.name,
          platform: c.platform,
          target_url: c.target_url,
          handle: c.handle,
          avatar_url: c.avatar_url,
          follower_count: Number(c.follower_count) || 0,
          avg_engagement_rate: Number(c.avg_engagement_rate) || 0,
          price_range_min: Number(c.price_range_min) || 0,
          price_range_max: Number(c.price_range_max) || 0,
          profile_data,
          created_at: c.created_at,
        }
      })
    }

    // 2. Fallback to settings table
    const settingKey = `competitors_${shopId}`
    const { data: settingData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', settingKey)
      .maybeSingle()

    if (settingData?.value) {
      const parsed = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value
      if (Array.isArray(parsed)) return parsed
    }

    return []
  } catch (err) {
    console.error('[getCompetitors Exception]:', err)
    return []
  }
}

/**
 * Remove a tracked competitor
 */
export async function deleteCompetitor(shopId: string, competitorId: string): Promise<boolean> {
  try {
    // Try delete from competitors table
    await supabase.from('competitors').delete().eq('id', competitorId).eq('shop_id', shopId)

    // Also remove from settings table fallback
    const settingKey = `competitors_${shopId}`
    const { data: settingData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', settingKey)
      .maybeSingle()

    if (settingData?.value) {
      let list = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value
      if (Array.isArray(list)) {
        list = list.filter((c: any) => c.id !== competitorId)
        await supabase.from('settings').upsert({
          key: settingKey,
          value: JSON.stringify(list),
        }, { onConflict: 'key' })
      }
    }

    return true
  } catch (err) {
    console.error('[deleteCompetitor Exception]:', err)
    return false
  }
}
