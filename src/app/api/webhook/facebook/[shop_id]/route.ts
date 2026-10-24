import { NextRequest, NextResponse, after } from 'next/server'
import { botMayReplyNow } from '@/lib/shop/businessHours'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyFacebookSignature } from '@/lib/facebook/messengerHelper'
import { processMessengerEntries } from '@/lib/facebook/processMessengerEntries'

const supabase = createAdminClient()

// Meta gets its 200 immediately; this bounds the after() work (AI planning, slip checks)
export const maxDuration = 60

/**
 * Helper to retrieve Facebook Page Access Token, App Secret, and Verify Token
 * Checking both `shops` table and `channel_accounts` table for maximum flexibility.
 */
async function getFacebookCredentials(shopId: string, shop: any) {
  let pageToken = shop.facebook_page_token?.trim() || ''
  let verifyToken = shop.facebook_verify_token?.trim() || ''
  let appSecret = shop.facebook_app_secret?.trim() || ''

  if (!pageToken || !verifyToken) {
    const { data: channelAcc } = await supabase
      .from('channel_accounts')
      .select('credentials, webhook_secret')
      .eq('shop_id', shopId)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .maybeSingle()

    if (channelAcc?.credentials) {
      const creds = channelAcc.credentials as Record<string, string>
      if (!pageToken) pageToken = creds.page_access_token || creds.token || ''
      if (!verifyToken) verifyToken = creds.verify_token || channelAcc.webhook_secret || ''
      if (!appSecret) appSecret = creds.app_secret || ''
    }
  }

  return { pageToken, verifyToken, appSecret }
}

/**
 * GET Handler: Facebook Webhook Verification Handshake
 * Meta sends hub.mode, hub.verify_token, and hub.challenge
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const searchParams = req.nextUrl.searchParams

    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (!mode || !token) {
      return new NextResponse('Missing hub.mode or hub.verify_token', { status: 400 })
    }

    // 1. Fetch Shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('id, facebook_verify_token, facebook_page_token')
      .eq('id', shop_id)
      .single()

    if (!shop) {
      console.error(`[Facebook Webhook Verification] Shop ${shop_id} not found`)
      return new NextResponse('Shop not found', { status: 404 })
    }

    const { verifyToken } = await getFacebookCredentials(shop_id, shop)

    // Check subscribe mode and verify token
    // A shop with no verify token must not accept Meta's handshake: otherwise anyone
    // who knows the URL can subscribe and, with no app secret, post unsigned events.
    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
      console.log(`[Facebook Webhook Verification] Successfully verified webhook for shop ${shop_id}`)
      return new NextResponse(challenge || '', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return new NextResponse('Forbidden', { status: 403 })
  } catch (err: any) {
    console.error('[Facebook Webhook GET Error]:', err)
    return new NextResponse(err?.message || 'Internal Server Error', { status: 500 })
  }
}

/**
 * POST Handler: Ingest Facebook Messenger Webhook Events
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shop_id: string }> }
) {
  try {
    const { shop_id } = await params
    const rawBody = await req.text()

    // 1. Fetch Shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single()

    if (!shop) {
      console.error(`[Facebook Webhook POST] Shop ${shop_id} not found`)
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const { pageToken, appSecret } = await getFacebookCredentials(shop_id, shop)

    // Same rule as LINE: no app secret, or a bad signature, means the event is dropped.
    const signature = req.headers.get('x-hub-signature-256')
    if (!appSecret || !verifyFacebookSignature(rawBody, signature, appSecret)) {
      console.error(`[Facebook Security] Missing or invalid signature for shop ${shop_id}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Facebook / Instagram Webhook structure: object === 'page' | 'instagram'
    const isFacebook = body.object === 'page'
    const isInstagram = body.object === 'instagram'
    if (!isFacebook && !isInstagram) {
      return NextResponse.json({ status: 'ignored_unsupported_object' }, { status: 200 })
    }
    const targetPlatform = isInstagram ? 'instagram' : 'facebook'

    const entries = body.entry || []
    const features = (shop.features as Record<string, boolean>) || {}
    // Off when switched off, or while the shop is open and answers customers itself (business hours)
    const isAutoReplyEnabled = features.auto_reply !== false && botMayReplyNow(features)

    // Meta wants a 200 within seconds and redelivers otherwise, which used to make the
    // bot answer twice; acknowledge now and let the AI work after the response.
    after(async () => {
      try {
        await processMessengerEntries({ entries, shop, shopId: shop_id, pageToken, features, isAutoReplyEnabled, isFacebook, isInstagram, targetPlatform })
      } catch (err) {
        console.error('[Meta Webhook] Background processing failed:', err)
      }
    })

    // Always respond with 200 OK EVENT_RECEIVED to acknowledge Meta webhook
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 })
  } catch (error: any) {
    console.error('[Facebook Webhook Error]:', error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
