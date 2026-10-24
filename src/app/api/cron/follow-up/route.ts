import { NextRequest, NextResponse } from 'next/server'
import { processDueFollowUpTasks } from '@/lib/ai/proactiveFollowUp'
import { expirePendingOrders } from '@/lib/orders/expirePendingOrders'
import { sendTrialReminders } from '@/lib/billing/ownerAlerts'
import { processWalletRenewals } from '@/lib/billing/walletRenewal'
import { expirePausedConversations } from '@/lib/inbox/adminPause'
import { createAdminClient } from '@/lib/supabase/admin'

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
    // The proxy lets /api/cron through without a login, so the shared secret is the only
    // gate: refuse to run at all when it isn't configured.
    // Trimmed on both sides: a secret pasted into the Vercel dashboard or a secret store
    // easily carries a trailing newline, and the scheduler then gets 401 forever with a
    // value that looks identical to the eye (24 Oct 2026).
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
    }
    if (req.headers.get('authorization')?.trim() !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processDueFollowUpTasks(30)
    const orders = await expirePendingOrders()
    const trialReminders = await sendTrialReminders()
    const walletRenewals = await processWalletRenewals()
    // Hands chats back to the bot when the admin's hour is up, without waiting for the
    // customer to write again
    const adminPauses = await expirePausedConversations()
    // Landing-page demo: clear what visitors left in the sample shops, put stock back
    const { data: demoCleanup, error: demoError } = await createAdminClient().rpc('cleanup_demo_shops', { p_hours: 6 })
    if (demoError) console.error('[FollowUpCron] Demo cleanup failed:', demoError.message)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
      orders,
      trialReminders,
      walletRenewals,
      adminPauses,
      demoCleanup: demoError ? null : demoCleanup,
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
