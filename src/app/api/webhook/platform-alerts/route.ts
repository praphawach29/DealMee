import { NextRequest, NextResponse } from 'next/server'
import { getPlatformLineConfig, savePlatformLineConfig, verifyPlatformLineSignature } from '@/lib/billing/platformLineAlerts'

/**
 * Webhook of the platform's own LINE OA (owner alerts). Its only job is linking the
 * owner: "/admin-link <code>" from /admin/payment-settings makes the sender the
 * account that receives top-up alerts. Everything else is ignored.
 */
export const runtime = 'nodejs'

async function reply(replyToken: string | undefined, token: string, text: string) {
  if (!replyToken) return
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch((err) => console.error('[PlatformAlertsWebhook] Reply failed:', err))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const config = await getPlatformLineConfig().catch(() => null)
  const token = config?.channel_access_token?.trim()
  const secret = config?.channel_secret?.trim()

  // Without a secret the request can't be verified, so nothing is accepted
  if (!token || !secret || !verifyPlatformLineSignature(rawBody, req.headers.get('x-line-signature') || '', secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let events: any[] = []
  try {
    events = JSON.parse(rawBody)?.events || []
  } catch {
    return NextResponse.json({ status: 'ok' })
  }

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue
    const match = String(event.message.text || '').trim().match(/^\/(?:admin-link|link-admin)\s+(\S+)/i)
    if (!match) continue

    const userId = event.source?.userId
    const codeValid =
      config!.link_code &&
      config!.link_code_expires_at &&
      new Date(config!.link_code_expires_at).getTime() > Date.now() &&
      match[1].toUpperCase() === config!.link_code.toUpperCase()

    if (!userId || !codeValid) {
      await reply(event.replyToken, token, 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่ในหน้า "ตั้งค่าบัญชีรับเงิน" ของหลังบ้าน DealMee')
      continue
    }

    let name = 'แอดมิน'
    try {
      const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) name = (await res.json()).displayName || name
    } catch {}

    await savePlatformLineConfig({ admin_line_user_id: userId, admin_line_name: name, link_code: null, link_code_expires_at: null })
    await reply(
      event.replyToken,
      token,
      `✅ ผูกบัญชีสำเร็จ คุณ ${name}\n\nต่อไปนี้ LINE นี้จะได้รับแจ้งเตือนจาก DealMee เมื่อ:\n• ร้านค้าเติมเงินสำเร็จ 💰\n• มีสลิปเติมเงินรอตรวจ ⏳`
    )
  }

  return NextResponse.json({ status: 'ok' })
}
