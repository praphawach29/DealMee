import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { runMerchantCopilotChat } from '@/lib/ai/merchantCopilot'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await getOrCreateShopForUser(supabase, user)
    if (!shop?.id) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const body = await req.json()
    const { message, history } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const result = await runMerchantCopilotChat({
      shopId: shop.id,
      userMessage: message.trim(),
      history: Array.isArray(history) ? history : [],
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Copilot API Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
