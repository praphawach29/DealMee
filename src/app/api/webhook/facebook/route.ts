import { NextRequest, NextResponse, after } from 'next/server'
import { botMayReplyNow } from '@/lib/shop/businessHours'
import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'
import { verifyFacebookSignature } from '@/lib/facebook/messengerHelper'
import { processMessengerEntries } from '@/lib/facebook/processMessengerEntries'

/**
 * Webhook of DealMee's own Meta app, for every page connected with "เชื่อมเพจด้วย Facebook".
 * One URL for all shops: each entry carries the page id, which says whose shop it is.
 * Shops on their own Meta app keep using /api/webhook/facebook/[shop_id].
 */
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const verifyToken = await platformSecret('FACEBOOK_WEBHOOK_VERIFY_TOKEN')
  if (params.get('hub.mode') === 'subscribe' && verifyToken && params.get('hub.verify_token') === verifyToken) {
    return new NextResponse(params.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const appSecret = await platformSecret('FACEBOOK_APP_SECRET')
  // Unlike a shop's own app, the platform app is always configured with its secret: nothing unsigned is accepted
  if (!appSecret || !verifyFacebookSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  const isFacebook = body.object === 'page'
  const isInstagram = body.object === 'instagram'
  if (!isFacebook && !isInstagram) return NextResponse.json({ status: 'ignored_unsupported_object' })

  // Group entries by page, then by the shop that connected it
  const byPage = new Map<string, any[]>()
  for (const entry of body.entry || []) {
    const pageId = String(entry?.id || '')
    if (!pageId) continue
    byPage.set(pageId, [...(byPage.get(pageId) || []), entry])
  }

  after(async () => {
    const supabase = createAdminClient()
    for (const [pageId, entries] of byPage) {
      try {
        const { data: shop } = await supabase
          .from('shops')
          .select('*')
          .eq('facebook_page_id', pageId)
          .eq('facebook_connected_via', 'oauth')
          .maybeSingle()
        if (!shop?.facebook_page_token) {
          console.warn(`[Platform FB Webhook] no shop connected to page ${pageId}`)
          continue
        }
        const features = (shop.features as Record<string, boolean>) || {}
        await processMessengerEntries({
          entries,
          shop,
          shopId: shop.id,
          pageToken: shop.facebook_page_token,
          features,
          isAutoReplyEnabled: features.auto_reply !== false && botMayReplyNow(features),
          isFacebook,
          isInstagram,
          targetPlatform: isInstagram ? 'instagram' : 'facebook',
        })
      } catch (err) {
        console.error(`[Platform FB Webhook] processing page ${pageId} failed:`, err)
      }
    }
  })

  return NextResponse.json({ status: 'EVENT_RECEIVED' })
}
