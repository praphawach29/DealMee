export type SocialPlatform = 'tiktok' | 'instagram' | 'facebook' | 'shopee' | 'lazada'

export interface ParsedSocialUrl {
  platform: SocialPlatform
  handle: string
  normalizedUrl: string
  isValid: boolean
}

export interface CompetitorPost {
  id: string
  post_url: string
  thumbnail_url: string
  title_or_caption: string
  views_count: number
  likes_count: number
  comments_count: number
  shares_count: number
  engagement_rate: number
  hashtags: string[]
  published_at: string
}

export interface PriceComparisonItem {
  myProduct: {
    id: string
    name: string
    price: number
    stock: number
  }
  competitorEquivalent: {
    name: string
    estimatedPrice: number
    priceDifference: number // positive = we are cheaper, negative = we are more expensive
    advantageLabel: string
  }
}

export interface AiCompetitorPlaybook {
  pricingStrategyVerdict: string
  priceAdvantageBullets: string[]
  topViralHooks: {
    hookText: string
    whyItWorks: string
    recommendedFormat: string
  }[]
  winningCaptionTemplate: string
  recommendedHashtags: string[]
}

export interface ScrapedCompetitorProfile {
  name: string
  handle: string
  platform: SocialPlatform
  target_url: string
  avatar_url: string
  follower_count: number
  avg_engagement_rate: number
  price_range_min: number
  price_range_max: number
  posts: CompetitorPost[]
  priceComparison: PriceComparisonItem[]
  /** null when the analysis could not be written (no Gemini key, model error, no posts) */
  aiPlaybook: AiCompetitorPlaybook | null
  is_live_data?: boolean
  data_source?: 'live_api'
  last_scanned_at?: string
}

/**
 * Platform URL Parser & Validator
 * Supports TikTok (@username or video URL), Instagram (profile, post, or reel), and Facebook
 */
export function parseSocialUrl(inputUrl: string): ParsedSocialUrl {
  const clean = (inputUrl || '').trim()

  // 1. TikTok
  if (/tiktok\.com/i.test(clean)) {
    const handleMatch = clean.match(/@([a-zA-Z0-9_.-]+)/)
    const handle = handleMatch ? `@${handleMatch[1]}` : '@tiktok_shop'
    return {
      platform: 'tiktok',
      handle,
      normalizedUrl: clean.startsWith('http') ? clean : `https://${clean}`,
      isValid: true,
    }
  }

  // 2. Instagram
  if (/instagram\.com/i.test(clean)) {
    const handleMatch = clean.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/)
    const rawHandle = handleMatch && !['p', 'reel', 'stories', 'explore'].includes(handleMatch[1]) ? handleMatch[1] : 'ig_competitor'
    return {
      platform: 'instagram',
      handle: `@${rawHandle.replace(/\/$/, '')}`,
      normalizedUrl: clean.startsWith('http') ? clean : `https://${clean}`,
      isValid: true,
    }
  }

  // 3. Facebook
  if (/facebook\.com|fb\.watch/i.test(clean)) {
    const handleMatch = clean.match(/facebook\.com\/([a-zA-Z0-9_.-]+)/)
    const rawHandle = handleMatch ? handleMatch[1] : 'fb_shop'
    return {
      platform: 'facebook',
      handle: rawHandle,
      normalizedUrl: clean.startsWith('http') ? clean : `https://${clean}`,
      isValid: true,
    }
  }

  // 4. Shopee / Lazada
  if (/shopee\.co\.th|shopee\.com/i.test(clean)) {
    return {
      platform: 'shopee',
      handle: 'Shopee Seller',
      normalizedUrl: clean.startsWith('http') ? clean : `https://${clean}`,
      isValid: true,
    }
  }

  // Fallback if user just entered a handle like @brandname
  if (clean.startsWith('@')) {
    return {
      platform: 'tiktok',
      handle: clean,
      normalizedUrl: `https://www.tiktok.com/${clean}`,
      isValid: true,
    }
  }

  return {
    platform: 'tiktok',
    handle: `@${clean.replace(/[^a-zA-Z0-9_]/g, '') || 'competitor'}`,
    normalizedUrl: clean.startsWith('http') ? clean : `https://${clean}`,
    isValid: clean.length > 2,
  }
}

/**
 * Fetch Live Social Profile using RapidAPI Gateway (if key available)
 * Curated from https://github.com/cporter202/social-media-scraping-apis
 */
async function fetchLiveRapidApiData(
  parsed: ParsedSocialUrl,
  apiKey: string
): Promise<{
  name?: string
  avatar_url?: string
  follower_count?: number
  posts?: CompetitorPost[]
} | null> {
  const cleanHandle = parsed.handle.replace(/^@/, '')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 7500) // 7.5s quota/latency guard

  try {
    if (parsed.platform === 'tiktok') {
      // RapidAPI TikTok Scraper: Fetch profile info and top 5 recent posts in parallel
      const [infoRes, postsRes] = await Promise.allSettled([
        fetch(`https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=${encodeURIComponent(cleanHandle)}`, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
          },
          signal: controller.signal,
        }),
        fetch(`https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(cleanHandle)}&count=5`, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
          },
          signal: controller.signal,
        }),
      ])

      let name: string | undefined
      let avatar_url: string | undefined
      let follower_count: number | undefined
      let posts: CompetitorPost[] | undefined

      if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
        const json = await infoRes.value.json().catch(() => null)
        const user = json?.data?.user
        const stats = json?.data?.stats
        if (user) {
          name = user.nickname || cleanHandle
          avatar_url = user.avatarLarger || user.avatarMedium || user.avatarThumb
          follower_count = Number(stats?.followerCount || stats?.follower_count || 0)
        }
      }

      if (postsRes.status === 'fulfilled' && postsRes.value.ok) {
        const json = await postsRes.value.json().catch(() => null)
        const videos = json?.data?.videos || json?.data?.aweme_list || json?.data?.posts
        if (Array.isArray(videos) && videos.length > 0) {
          posts = videos.slice(0, 5).map((v: any, idx: number) => {
            const views = Number(v.play_count || 0)
            const likes = Number(v.digg_count || 0)
            const comments = Number(v.comment_count || 0)
            const shares = Number(v.share_count || 0)
            const eng = views > 0 ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0
            const hashtags = (v.title?.match(/#[^\s#]+/g) || [])

            return {
              id: String(v.video_id || v.aweme_id || `tt-${idx}`),
              post_url: `https://www.tiktok.com/@${cleanHandle}/video/${v.video_id || v.aweme_id}`,
              thumbnail_url: v.cover || v.origin_cover || v.ai_dynamic_cover || '',
              title_or_caption: v.title || v.content_desc || `TikTok Video by @${cleanHandle}`,
              views_count: views,
              likes_count: likes,
              comments_count: comments,
              shares_count: shares,
              engagement_rate: eng,
              hashtags,
              published_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : new Date().toISOString(),
            }
          })
        }
      }

      if (name || (posts && posts.length > 0)) {
        clearTimeout(timeoutId)
        return {
          name,
          avatar_url,
          follower_count,
          posts,
        }
      }
    } else if (parsed.platform === 'instagram') {
      // RapidAPI Instagram Scraper endpoint
      const res = await fetch(`https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=${encodeURIComponent(cleanHandle)}`, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com',
        },
        signal: controller.signal,
      })

      if (res.ok) {
        const json = await res.json()
        const data = json?.data
        if (data) {
          clearTimeout(timeoutId)
          return {
            name: data.full_name || cleanHandle,
            avatar_url: data.profile_pic_url,
            follower_count: Number(data.follower_count || 0),
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Live Scraper API Warning]: ${err?.message || 'Gateway unreachable, using fallback'}`)
  } finally {
    clearTimeout(timeoutId)
  }

  return null
}

/** Why a scan produced no profile; the analyze route turns it into a message and charges no quota. */
export class CompetitorScanError extends Error {
  constructor(
    public readonly reason: 'unsupported_platform' | 'no_api_key' | 'not_found',
    message: string
  ) {
    super(message)
  }
}

/** Platforms whose profile and posts fetchLiveRapidApiData can actually read */
export const LIVE_PLATFORMS: SocialPlatform[] = ['tiktok', 'instagram']

/**
 * Fetches a competitor's real profile and recent posts. Everything on the result
 * comes from the platform: there is no source for a competitor's prices, so the
 * price range stays 0 (unknown) and priceComparison stays empty, and the strategy
 * section (aiPlaybook) is written afterwards from these posts by
 * generateCompetitorPlaybook. Until Oct 2026 this filled every gap with made-up
 * numbers (follower counts from a hash, a fixed ฿290–990 range, our price × 1.15
 * as "their" price) and labelled cached results as live.
 */
export async function scrapeCompetitorIntelligence(
  targetUrl: string,
  options?: { apiKey?: string }
): Promise<ScrapedCompetitorProfile> {
  const parsed = parseSocialUrl(targetUrl)
  if (!LIVE_PLATFORMS.includes(parsed.platform)) {
    throw new CompetitorScanError(
      'unsupported_platform',
      'ตอนนี้ดึงข้อมูลจริงได้เฉพาะ TikTok และ Instagram กรุณาวางลิงก์โปรไฟล์ของสองแพลตฟอร์มนี้'
    )
  }

  const rapidApiKey = options?.apiKey || ''
  if (!rapidApiKey) {
    throw new CompetitorScanError('no_api_key', 'ยังไม่ได้ตั้ง RapidAPI Key จึงดึงข้อมูลคู่แข่งไม่ได้')
  }

  const live = await fetchLiveRapidApiData(parsed, rapidApiKey)
  if (!live) {
    throw new CompetitorScanError(
      'not_found',
      'ดึงข้อมูลบัญชีนี้ไม่สำเร็จ ตรวจว่าลิงก์ถูกต้องและบัญชีเป็นสาธารณะ แล้วลองใหม่'
    )
  }

  const posts = live.posts || []
  const avgEngagementRate = posts.length > 0
    ? Number((posts.reduce((acc, p) => acc + p.engagement_rate, 0) / posts.length).toFixed(2))
    : 0

  return {
    name: live.name || parsed.handle.replace(/^@/, ''),
    handle: parsed.handle,
    platform: parsed.platform,
    target_url: parsed.normalizedUrl,
    avatar_url: live.avatar_url || '',
    follower_count: live.follower_count || 0,
    avg_engagement_rate: avgEngagementRate,
    price_range_min: 0,
    price_range_max: 0,
    posts,
    priceComparison: [],
    aiPlaybook: null,
    is_live_data: true,
    data_source: 'live_api',
    last_scanned_at: new Date().toISOString(),
  }
}
