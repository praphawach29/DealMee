import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The platform's own LINE OA (table platform_line_alerts, service role only) that
 * sends owner alerts such as wallet top-ups. The owner links their personal LINE by
 * sending "/admin-link <code>" to the OA, like a shop admin does with a shop's OA.
 */
export interface PlatformLineConfig {
  channel_access_token: string | null
  channel_secret: string | null
  bot_basic_id: string | null
  admin_line_user_id: string | null
  admin_line_name: string | null
  link_code: string | null
  link_code_expires_at: string | null
}

const LINK_CODE_TTL_MS = 60 * 60 * 1000

export async function getPlatformLineConfig(): Promise<PlatformLineConfig | null> {
  const { data, error } = await createAdminClient().from('platform_line_alerts').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PlatformLineConfig) || null
}

export async function savePlatformLineConfig(patch: Partial<PlatformLineConfig>) {
  const { error } = await createAdminClient()
    .from('platform_line_alerts')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

/** A fresh one-hour code, unless a valid one already exists */
export async function ensureLinkCode(config: PlatformLineConfig | null): Promise<string> {
  const valid = config?.link_code && config.link_code_expires_at && new Date(config.link_code_expires_at).getTime() > Date.now()
  if (valid) return config!.link_code!
  const code = 'DM-' + randomBytes(4).toString('hex').toUpperCase()
  await savePlatformLineConfig({ link_code: code, link_code_expires_at: new Date(Date.now() + LINK_CODE_TTL_MS).toISOString() })
  return code
}

export function verifyPlatformLineSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  const hash = Buffer.from(createHmac('SHA256', secret.trim()).update(rawBody).digest('base64'))
  const given = Buffer.from(signature.trim())
  return hash.length === given.length && timingSafeEqual(hash, given)
}

/** Checks a channel access token with LINE; returns the OA's basic ID (without @) */
export async function fetchBotBasicId(token: string): Promise<string | null> {
  const res = await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const info = await res.json()
  return String(info.basicId || '').replace(/^@/, '') || null
}

/** Push to the linked owner; false when the OA or the owner isn't set up, or LINE refuses */
export async function pushPlatformLineAlert(text: string): Promise<boolean> {
  const config = await getPlatformLineConfig()
  const token = config?.channel_access_token?.trim()
  const to = config?.admin_line_user_id
  if (!token || !to) return false
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  })
  if (!res.ok) console.error('[PlatformLineAlerts] Push failed:', await res.text())
  return res.ok
}
