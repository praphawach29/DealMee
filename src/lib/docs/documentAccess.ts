import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { documentReadable } from '@/lib/security/tenantScope'
import { verifyDocAcceptToken } from './acceptToken'

/**
 * View and download need the same unguessable accept token customers are sent,
 * or a session whose shop owns the document. Knowing the UUID is not enough.
 * Returns a response when access is denied, or null when the caller may read.
 */
export async function denyDocumentRead(
  req: NextRequest,
  doc: { id: string; shop_id?: string | null }
): Promise<NextResponse | null> {
  const token = (req.nextUrl.searchParams.get('accept') || req.nextUrl.searchParams.get('token') || '').trim()
  const tokenCheck = verifyDocAcceptToken(doc.id, token)
  let sessionShopId: string | null = null
  if (!tokenCheck.ok) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const shop = await getOrCreateShopForUser(supabase, user)
      sessionShopId = (shop?.id as string | undefined) || null
    }
  }
  if (tokenCheck.ok || documentReadable({
    documentShopId: doc.shop_id,
    sessionShopId,
    tokenValid: false,
  })) {
    return null
  }
  const message = tokenCheck.reason === 'expired'
    ? 'ลิงก์ยืนยันหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากร้าน'
    : 'ลิงก์เอกสารไม่ถูกต้องหรือไม่มีรหัส กรุณาเปิดจากลิงก์ที่ร้านส่งให้ หรือเข้าสู่ระบบของร้านนี้'
  return new NextResponse(message, { status: 401 })
}
