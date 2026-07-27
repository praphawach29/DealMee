import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { createCheckoutSession } from '@/lib/billing/stripe'
import { createPromptPayCharge } from '@/lib/billing/omise'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }, { status: 401 })
  }

  const shop = await getOrCreateShopForUser(supabase, user)
  if (!shop) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลร้านค้า' }, { status: 404 })
  }

  let body: { planKey?: string; provider?: 'stripe' | 'omise' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 })
  }

  const { planKey, provider } = body
  if (!planKey || !provider) {
    return NextResponse.json({ error: 'กรุณาระบุแพ็กเกจและช่องทางชำระเงิน' }, { status: 400 })
  }

  if (provider === 'stripe') {
    const result = await createCheckoutSession(shop, planKey, user.email)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  }

  if (provider === 'omise') {
    const result = await createPromptPayCharge(shop, planKey)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'ช่องทางชำระเงินไม่ถูกต้อง' }, { status: 400 })
}
