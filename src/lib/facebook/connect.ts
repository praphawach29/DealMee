import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { decryptSecretValue, encryptSecretValue, platformSecret } from '@/lib/platformSecrets'

/**
 * "เชื่อมเพจด้วย Facebook" through DealMee's own Meta app (one app, reviewed once),
 * instead of every shop creating an app that stays in Development Mode and answers only
 * its own admins. Flow: /api/facebook/connect → Facebook Login → /api/facebook/callback
 * (pages kept in a short-lived encrypted cookie) → the shop picks a page on the channel
 * settings page → the app is subscribed to that page's messages, which then arrive at
 * /api/webhook/facebook.
 *
 * Graph URLs carry no version, so calls use the version set in the app's dashboard and
 * nothing here goes stale when Meta retires one.
 */
const GRAPH = 'https://graph.facebook.com'
export const FB_OAUTH_COOKIE = 'dm_fb_oauth'
export const FB_PAGES_COOKIE = 'dm_fb_pages'
const SCOPES = ['pages_show_list', 'pages_messaging', 'pages_manage_metadata', 'pages_read_engagement', 'business_management']

export interface FacebookAppConfig {
  appId: string
  appSecret: string
  configId: string
}

export async function facebookAppConfig(): Promise<FacebookAppConfig | null> {
  const [appId, appSecret, configId] = await Promise.all([
    platformSecret('FACEBOOK_APP_ID'),
    platformSecret('FACEBOOK_APP_SECRET'),
    platformSecret('FACEBOOK_LOGIN_CONFIG_ID'),
  ])
  return appId && appSecret ? { appId, appSecret, configId } : null
}

export function newState(): string {
  return randomBytes(16).toString('hex')
}

export function loginDialogUrl(config: FacebookAppConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({ client_id: config.appId, redirect_uri: redirectUri, state, response_type: 'code' })
  // Business-type apps use Facebook Login for Business: permissions come from the configuration
  if (config.configId) params.set('config_id', config.configId)
  else params.set('scope', SCOPES.join(','))
  return `https://www.facebook.com/dialog/oauth?${params}`
}

async function graphGet(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data?.error?.message || `Facebook ตอบกลับ ${res.status}`)
  return data
}

/** code → long-lived user token (page tokens taken from it don't expire) */
export async function userTokenFromCode(config: FacebookAppConfig, code: string, redirectUri: string): Promise<string> {
  const short = await graphGet('/oauth/access_token', {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
    code,
  })
  const long = await graphGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: short.access_token,
  })
  return long.access_token || short.access_token
}

export interface FacebookPageChoice {
  id: string
  name: string
  token: string
}

export async function facebookUserId(userToken: string): Promise<string> {
  const me = await graphGet('/me', { fields: 'id', access_token: userToken })
  return String(me.id || '')
}

export async function listPages(userToken: string): Promise<FacebookPageChoice[]> {
  const data = await graphGet('/me/accounts', { fields: 'id,name,access_token', limit: '50', access_token: userToken })
  return (data.data || [])
    .filter((p: any) => p.id && p.access_token)
    .map((p: any) => ({ id: String(p.id), name: String(p.name || p.id), token: String(p.access_token) }))
}

/** Asks Meta to send this page's messages to the app's webhook */
export async function subscribePage(pageId: string, pageToken: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ subscribed_fields: 'messages,messaging_postbacks', access_token: pageToken }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error || data.success === false) {
    throw new Error(data?.error?.message || 'Facebook ไม่ยอมให้สมัครรับข้อความของเพจนี้')
  }
}

export async function unsubscribePage(pageId: string, pageToken: string): Promise<void> {
  await fetch(`${GRAPH}/${pageId}/subscribed_apps?${new URLSearchParams({ access_token: pageToken })}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
}

// ---- short-lived encrypted cookies ----------------------------------------------------

export function sealCookie(value: unknown, ttlMs: number): string {
  return encryptSecretValue(JSON.stringify({ value, exp: Date.now() + ttlMs }))
}

export function openCookie<T>(sealed: string | undefined): T | null {
  if (!sealed) return null
  try {
    const { value, exp } = JSON.parse(decryptSecretValue(sealed))
    return exp > Date.now() ? (value as T) : null
  } catch {
    return null
  }
}

// ---- Meta's signed_request (data deletion / deauthorize callbacks) ---------------------

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** The payload when the signature matches the app secret, else null */
export function parseSignedRequest(signedRequest: string, appSecret: string): { user_id?: string } | null {
  const [sig, payload] = String(signedRequest || '').split('.', 2)
  if (!sig || !payload) return null
  const expected = createHmac('sha256', appSecret).update(payload).digest()
  const given = base64UrlDecode(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    return JSON.parse(base64UrlDecode(payload).toString('utf8'))
  } catch {
    return null
  }
}
