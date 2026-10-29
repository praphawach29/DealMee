import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const admin = createAdminClient()

  // Get tool usage stats from the view
  const { data: stats, error } = await admin
    .from('tool_usage_stats')
    .select('*')
    .eq('shop_id', auth.shopId)
    .order('total_calls', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Unable to load tool stats' }, { status: 500 })
  }

  // Get recent tool usage log for timeline
  const { data: recent } = await admin
    .from('tool_usage_log')
    .select('tool_name, success, created_at, duration_ms')
    .eq('shop_id', auth.shopId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Calculate summary
  const totalCalls = (stats || []).reduce((sum: number, s: any) => sum + (s.total_calls || 0), 0)
  const totalSuccess = (stats || []).reduce((sum: number, s: any) => sum + (s.successful_calls || 0), 0)
  const totalFailed = (stats || []).reduce((sum: number, s: any) => sum + (s.failed_calls || 0), 0)
  const successRate = totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 0

  // Top 5 tools
  const topTools = (stats || []).slice(0, 5)

  // Error rate by tool
  const errorRates = (stats || [])
    .filter((s: any) => (s.failed_calls || 0) > 0)
    .map((s: any) => ({
      tool_name: s.tool_name,
      error_rate: s.total_calls > 0 ? Math.round((s.failed_calls / s.total_calls) * 100) : 0,
      failed_calls: s.failed_calls,
      total_calls: s.total_calls,
    }))

  return NextResponse.json({
    summary: { totalCalls, totalSuccess, totalFailed, successRate },
    stats: stats ?? [],
    topTools,
    errorRates,
    recent: recent ?? [],
  })
}
