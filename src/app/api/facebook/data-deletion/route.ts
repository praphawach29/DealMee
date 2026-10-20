import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'
import { parseSignedRequest } from '@/lib/facebook/connect'

/**
 * Meta's Data Deletion Request callback, and (with ?deauthorize=1) the Deauthorize
 * callback: a Facebook user removed DealMee or asked for their data to be deleted.
 * DealMee keeps only the connection itself (page id, name, token, the connecting user's
 * id), so this disconnects every page that user connected. Chats stay with the shop,
 * which is their data controller (see /privacy).
 */
export async function POST(req: NextRequest) {
  const appSecret = await platformSecret('FACEBOOK_APP_SECRET')
  const form = await req.formData().catch(() => null)
  const payload = appSecret ? parseSignedRequest(String(form?.get('signed_request') || ''), appSecret) : null
  if (!payload?.user_id) return NextResponse.json({ error: 'invalid signed_request' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('shops')
    .update({
      facebook_page_id: null,
      facebook_page_name: null,
      facebook_page_token: null,
      facebook_connected_via: null,
      facebook_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('facebook_user_id', payload.user_id)
  if (error) console.error('[Facebook data deletion] failed:', error.message)

  if (req.nextUrl.searchParams.get('deauthorize')) return NextResponse.json({ success: true })

  const code = randomBytes(8).toString('hex')
  return NextResponse.json({
    url: `${req.nextUrl.origin}/facebook/data-deletion?code=${code}`,
    confirmation_code: code,
  })
}
