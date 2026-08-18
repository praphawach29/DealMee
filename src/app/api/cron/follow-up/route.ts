import { NextRequest, NextResponse } from 'next/server'
import { processDueFollowUpTasks } from '@/lib/ai/proactiveFollowUp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60s for batch processing

export async function GET(req: NextRequest) {
  return handleFollowUpCron(req)
}

export async function POST(req: NextRequest) {
  return handleFollowUpCron(req)
}

async function handleFollowUpCron(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = req.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const result = await processDueFollowUpTasks(30)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (err: any) {
    console.error('[FollowUpCron] Exception during cron job:', err)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Internal error in follow-up cron',
      },
      { status: 500 }
    )
  }
}
