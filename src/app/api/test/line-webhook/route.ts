import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startSalesAgentPlanning, continueSalesAgentPlanning, planningAckMessage } from '@/lib/ai/salesAgentEngine'

/**
 * Developer Simulation API Route — lets developers test AI agent planning,
 * tool execution, and memory updates without needing a live LINE webhook connection.
 *
 * POST /api/test/line-webhook
 * Body: { shop_id: string, user_id: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shop_id, user_id, message } = body

    if (!shop_id || !user_id || !message) {
      return NextResponse.json(
        { error: 'Missing required parameters: shop_id, user_id, message' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 1. Fetch shop record
    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .maybeSingle()

    if (shopError || !shop) {
      return NextResponse.json(
        { error: `Shop not found with ID "${shop_id}"` },
        { status: 404 }
      )
    }

    // 2. Find or create conversation
    let { data: conv } = await admin
      .from('conversations')
      .select('*')
      .eq('shop_id', shop_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (!conv) {
      const { data: newConv, error: createError } = await admin
        .from('conversations')
        .insert({
          shop_id: shop_id,
          user_id: user_id,
          customer_name: `Test-User-${user_id.slice(-4)}`,
          platform: 'SIMULATOR',
          status: 'ai',
          sales_stage: 'greeting',
          last_message: message,
        })
        .select('*')
        .single()

      if (createError || !newConv) {
        return NextResponse.json(
          { error: `Failed to create conversation: ${createError?.message}` },
          { status: 500 }
        )
      }
      conv = newConv
    }

    // 3. Start Sales Agent Planning
    const planStart = await startSalesAgentPlanning({
      shop,
      userQuery: message,
      userId: user_id,
      conversationId: conv.id,
    })

    if (planStart.done) {
      return NextResponse.json({
        status: 'completed_single_step',
        ackSent: false,
        reply: planStart.result.text,
        toolsExecuted: planStart.result.toolCallsExecuted,
      })
    }

    // 4. Multi-step execution path
    const ackText = planningAckMessage(planStart.state)
    const finalResult = await continueSalesAgentPlanning(planStart.state)

    return NextResponse.json({
      status: 'completed_multi_step',
      ackSent: true,
      ackMessage: ackText,
      reply: finalResult.text,
      toolsExecuted: finalResult.toolCallsExecuted,
    })
  } catch (err: unknown) {
    console.error('[LINE Webhook Simulator Exception]:', err)
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
