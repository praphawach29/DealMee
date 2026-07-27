import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { createPortalSession } from '@/lib/billing/stripe'

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

  if (shop.subscription_provider !== 'stripe') {
    return NextResponse.json(
      { error: 'บัญชีนี้ชำระผ่าน Omise ซึ่งยังไม่มีระบบจัดการบัญชีด้วยตนเอง กรุณาติดต่อทีมงานหากต้องการเปลี่ยนแปลงแพ็กเกจ' },
      { status: 400 }
    )
  }

  const result = await createPortalSession(shop)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
