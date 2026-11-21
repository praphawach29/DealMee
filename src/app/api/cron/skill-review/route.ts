import { after, NextRequest, NextResponse } from 'next/server'
import { cronAuthResult, shouldChain } from '@/lib/ai/nightlyReviewPlan'
import { runNightlySkillReviewBatch } from '@/lib/ai/nightlyReviewStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Nightly skill review. Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
 * One invocation reviews a few shops, then starts the next batch. A second call on the
 * same Bangkok date does not review a shop that already finished.
 */
export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = cronAuthResult(req.headers.get('authorization'), secret)
  if (auth !== 200) {
    return NextResponse.json(
      { error: auth === 503 ? 'CRON_SECRET is not configured' : 'Unauthorized' },
      { status: auth },
    )
  }
  if (process.env.SKILL_REVIEW_ENABLED === '0') {
    return NextResponse.json({ success: true, skipped: true, reason: 'disabled' })
  }

  const chain = Number(req.nextUrl.searchParams.get('chain') || '0')
  const cronSecret = secret!.trim()
  const next = req.nextUrl.clone()
  next.searchParams.set('chain', String(Number.isFinite(chain) ? chain + 1 : 1))

  try {
    const result = await runNightlySkillReviewBatch()
    if (result.ready && shouldChain(result.remaining, chain)) {
      // Shadow replays are queued with after() during the batch, on this request.
      // The next batch is a new invocation so this function does not wait for it.
      after(async () => {
        try {
          const response = await fetch(next, {
            method: 'POST',
            headers: { authorization: `Bearer ${cronSecret}` },
          })
          if (!response.ok) console.error('[SkillReview] next batch returned', response.status)
        } catch (err) {
          console.error('[SkillReview] next batch failed', err instanceof Error ? err.message : err)
        }
      })
    }
    return NextResponse.json({
      success: true,
      chain,
      reviewDate: result.reviewDate,
      ready: result.ready,
      reviewed: result.reviewed,
      remaining: result.remaining,
      shops: result.shops.map((shop) => ({
        shopId: shop.shopId,
        status: shop.status,
        reason: shop.reason,
        proposalsCreated: shop.proposalsCreated,
        modelCalled: shop.modelCalled,
      })),
    })
  } catch (err) {
    console.error('[SkillReview] batch failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'review failed' }, { status: 500 })
  }
}
