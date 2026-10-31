import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Platform-wide API keys and AI settings that the Super Admin can change from
 * /admin/system-settings without a redeploy.
 *
 * A value is looked up in this order:
 *   1. set on the admin page — public.settings row `platform_secret:<NAME>`
 *      (service-role only since 20261025000000; secrets are AES-256-GCM encrypted
 *      with SETTINGS_ENCRYPTION_KEY, so a leaked row is unreadable without Vercel)
 *   2. the Vercel environment variable, then its older aliases
 *   3. the pre-2026-10 plain rows gemini_key / openai_key / claude_key
 *
 * NEXT_PUBLIC_* names are deliberately not read: Next.js may ship those to the browser.
 *
 * What cannot move here stays in Vercel: SUPABASE_SERVICE_ROLE_KEY (needed to read
 * this table), NEXT_PUBLIC_* (baked in at build), CRON_SECRET (shared with GitHub
 * Actions) and SETTINGS_ENCRYPTION_KEY itself.
 */

export type SecretGroup = 'ai' | 'slip' | 'facebook' | 'other'

export interface SecretDef {
  name: string
  label: string
  group: SecretGroup
  /** true: encrypted, never shown back; false: a plain setting shown in full */
  secret: boolean
  envAliases?: string[]
  legacySettingsKey?: string
  placeholder?: string
  help?: string
  options?: string[]
}

export const SECRET_DEFS: SecretDef[] = [
  { name: 'GEMINI_API_KEY', label: 'Gemini API Key', group: 'ai', secret: true, envAliases: ['GEMINI_KEY'], legacySettingsKey: 'gemini_key', help: 'โมเดลหลักของบอทขาย คลังความรู้ และส่องคู่แข่ง' },
  { name: 'GEMINI_MODEL', label: 'Gemini Model', group: 'ai', secret: false, placeholder: 'gemini-3.8-flash' },
  { name: 'GEMINI_THINKING_LEVEL', label: 'Gemini Thinking Level', group: 'ai', secret: false, options: ['low', 'medium', 'high', 'default'], help: 'low ถูกและเร็วที่สุด, default = ไม่ส่งค่า (ให้ Gemini เลือกเอง)' },
  { name: 'OPENAI_API_KEY', label: 'OpenAI API Key', group: 'ai', secret: true, envAliases: ['OPENAI_KEY'], legacySettingsKey: 'openai_key', help: 'สำรองลำดับแรกเมื่อ Gemini ล่ม' },
  { name: 'OPENAI_MODEL', label: 'OpenAI Model', group: 'ai', secret: false },
  { name: 'CLAUDE_API_KEY', label: 'Claude API Key', group: 'ai', secret: true, envAliases: ['CLAUDE_KEY'], legacySettingsKey: 'claude_key', help: 'สำรองลำดับที่สอง และใช้อ่านเอกสารในคลังความรู้' },
  { name: 'CLAUDE_MODEL', label: 'Claude Model', group: 'ai', secret: false },
  { name: 'TYPESAFE_API_KEY', label: 'TypeSafe API Key', group: 'ai', secret: true, help: 'แจ้งเตือนแอดมินเมื่อลูกค้าดูไม่พอใจ (ร้านต้องเปิดสวิตช์เอง) ~0.001 บาทต่อข้อความ · console.typesafe.ai' },
  { name: 'SLIP_PROVIDER', label: 'ผู้ให้บริการตรวจสลิปหลัก', group: 'slip', secret: false, options: ['easyslip', 'thunder', 'slipok'] },
  { name: 'EASYSLIP_API_KEY', label: 'EasySlip API Key', group: 'slip', secret: true },
  { name: 'THUNDER_API_KEY', label: 'Thunder API Key', group: 'slip', secret: true },
  { name: 'SLIPOK_API_KEY', label: 'SlipOK API Key', group: 'slip', secret: true },
  { name: 'SLIPOK_BRANCH_ID', label: 'SlipOK Branch ID', group: 'slip', secret: false },
  { name: 'FACEBOOK_APP_ID', label: 'Facebook App ID', group: 'facebook', secret: false, help: 'แอป Meta ของ DealMee (แอปเดียวสำหรับทุกร้าน) ใช้กับปุ่ม "เชื่อมเพจด้วย Facebook"' },
  { name: 'FACEBOOK_APP_SECRET', label: 'Facebook App Secret', group: 'facebook', secret: true, help: 'App settings → Basic → App secret ใช้ตรวจลายเซ็น webhook และแลก token' },
  { name: 'FACEBOOK_LOGIN_CONFIG_ID', label: 'Facebook Login for Business Configuration ID', group: 'facebook', secret: false, help: 'ถ้าแอปเป็นประเภท Business ให้สร้าง Configuration ใน Facebook Login for Business แล้วใส่ ID ที่นี่ ถ้าว่าง ระบบขอสิทธิ์แบบ scope ปกติ' },
  { name: 'FACEBOOK_WEBHOOK_VERIFY_TOKEN', label: 'Webhook Verify Token', group: 'facebook', secret: false, help: 'ข้อความสุ่มที่ตั้งเอง แล้วใส่ค่าเดียวกันในหน้า Webhooks ของแอป (Callback URL: https://www.dealmee.app/api/webhook/facebook)' },
  { name: 'RAPIDAPI_KEY', label: 'RapidAPI Key (ส่องคู่แข่ง)', group: 'other', secret: true, help: 'ใช้เมื่อร้านไม่ได้ใส่ key ของตัวเอง' },
  { name: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API Key (เสียง)', group: 'other', secret: true },
  { name: 'ELEVENLABS_VOICE_ID', label: 'ElevenLabs Voice ID', group: 'other', secret: false },
]

export type SecretName = (typeof SECRET_DEFS)[number]['name']

const ROW_PREFIX = 'platform_secret:'
const LOG_KEY = 'platform_secret_log'
const CACHE_MS = 60_000

interface StoredValue {
  v: string
  updated_at: string
  updated_by: string
}

function defOf(name: string): SecretDef {
  const def = SECRET_DEFS.find((d) => d.name === name)
  if (!def) throw new Error(`Unknown platform setting: ${name}`)
  return def
}

// ---- encryption ---------------------------------------------------------------

function encryptionKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY
  return raw ? createHash('sha256').update(raw).digest() : null
}

export function canEncrypt(): boolean {
  return encryptionKey() !== null
}

function encrypt(plain: string): string {
  const key = encryptionKey()
  if (!key) throw new Error('ยังไม่ได้ตั้ง SETTINGS_ENCRYPTION_KEY ใน Vercel จึงบันทึก key ไม่ได้')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`
}

function decrypt(stored: string): string {
  if (!stored.startsWith('enc:v1:')) return stored
  const key = encryptionKey()
  if (!key) return ''
  try {
    const [, , iv, tag, data] = stored.split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    console.error('[platformSecrets] could not decrypt a stored value; was SETTINGS_ENCRYPTION_KEY changed?')
    return ''
  }
}

/** Same AES-256-GCM scheme for other server-only secrets, such as a shop's own AI key */
export { encrypt as encryptSecretValue, decrypt as decryptSecretValue }

// ---- reading --------------------------------------------------------------------

interface Snapshot {
  at: number
  dashboard: Record<string, StoredValue>
  legacy: Record<string, string>
}

let snapshot: Snapshot | null = null

async function load(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.at < CACHE_MS) return snapshot
  const legacyKeys = SECRET_DEFS.map((d) => d.legacySettingsKey).filter(Boolean) as string[]
  const admin = createAdminClient()
  const [own, old] = await Promise.all([
    admin.from('settings').select('key, value').like('key', `${ROW_PREFIX}%`),
    admin.from('settings').select('key, value').in('key', legacyKeys),
  ])
  const error = own.error || old.error
  const data = [...(own.data || []), ...(old.data || [])]
  if (error) {
    console.error('[platformSecrets] read failed, using environment only:', error.message)
    return { at: Date.now(), dashboard: {}, legacy: {} }
  }
  const dashboard: Record<string, StoredValue> = {}
  const legacy: Record<string, string> = {}
  for (const row of data) {
    if (row.key.startsWith(ROW_PREFIX)) {
      try {
        dashboard[row.key.slice(ROW_PREFIX.length)] = JSON.parse(row.value)
      } catch {}
    } else if (row.value) {
      legacy[row.key] = row.value
    }
  }
  snapshot = { at: Date.now(), dashboard, legacy }
  return snapshot
}

type Source = 'dashboard' | 'env' | 'legacy' | 'none'

function resolve(def: SecretDef, snap: Snapshot): { value: string; source: Source; stored?: StoredValue } {
  const stored = snap.dashboard[def.name]
  if (stored?.v) {
    const value = def.secret ? decrypt(stored.v) : stored.v
    if (value) return { value, source: 'dashboard', stored }
  }
  for (const env of [def.name, ...(def.envAliases || [])]) {
    const value = process.env[env]
    if (value) return { value, source: 'env', stored }
  }
  if (def.legacySettingsKey && snap.legacy[def.legacySettingsKey]) {
    return { value: snap.legacy[def.legacySettingsKey], source: 'legacy', stored }
  }
  return { value: '', source: 'none', stored }
}

/** The current value of a platform setting, or '' when none is set anywhere. */
export async function platformSecret(name: SecretName): Promise<string> {
  return resolve(defOf(name), await load()).value
}

// ---- admin page -------------------------------------------------------------------

export interface SecretStatus {
  name: string
  label: string
  group: SecretGroup
  secret: boolean
  help?: string
  placeholder?: string
  options?: string[]
  source: Source
  /** last 4 characters for secrets, the full value for plain settings */
  display: string
  updatedAt?: string
  updatedBy?: string
}

export async function listSecretStatus(): Promise<SecretStatus[]> {
  snapshot = null
  const snap = await load()
  return SECRET_DEFS.map((def) => {
    const { value, source, stored } = resolve(def, snap)
    return {
      name: def.name,
      label: def.label,
      group: def.group,
      secret: def.secret,
      help: def.help,
      placeholder: def.placeholder,
      options: def.options,
      source,
      display: !value ? '' : def.secret ? `••••${value.slice(-4)}` : value,
      updatedAt: source === 'dashboard' ? stored?.updated_at : undefined,
      updatedBy: source === 'dashboard' ? stored?.updated_by : undefined,
    }
  })
}

export interface SecretLogEntry {
  name: string
  action: 'set' | 'clear'
  by: string
  at: string
  hint: string
}

export async function readSecretLog(): Promise<SecretLogEntry[]> {
  const { data } = await createAdminClient().from('settings').select('value').eq('key', LOG_KEY).maybeSingle()
  try {
    return data?.value ? JSON.parse(data.value) : []
  } catch {
    return []
  }
}

async function appendLog(entry: SecretLogEntry) {
  const log = await readSecretLog()
  await createAdminClient()
    .from('settings')
    .upsert({ key: LOG_KEY, value: JSON.stringify([entry, ...log].slice(0, 100)) }, { onConflict: 'key' })
}

export async function setPlatformSecret(name: SecretName, value: string, actorEmail: string) {
  const def = defOf(name)
  const trimmed = value.trim()
  if (!trimmed) throw new Error('กรุณากรอกค่า')
  const stored: StoredValue = {
    v: def.secret ? encrypt(trimmed) : trimmed,
    updated_at: new Date().toISOString(),
    updated_by: actorEmail,
  }
  const { error } = await createAdminClient()
    .from('settings')
    .upsert({ key: ROW_PREFIX + name, value: JSON.stringify(stored) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  snapshot = null
  await appendLog({ name, action: 'set', by: actorEmail, at: stored.updated_at, hint: def.secret ? `••••${trimmed.slice(-4)}` : trimmed })
}

export async function clearPlatformSecret(name: SecretName, actorEmail: string) {
  defOf(name)
  const { error } = await createAdminClient().from('settings').delete().eq('key', ROW_PREFIX + name)
  if (error) throw new Error(error.message)
  snapshot = null
  await appendLog({ name, action: 'clear', by: actorEmail, at: new Date().toISOString(), hint: '' })
}

/** Calls the provider with a candidate key. null = no test available for this setting. */
export async function testPlatformSecret(name: SecretName, value: string): Promise<{ ok: boolean; message: string } | null> {
  const key = value.trim()
  const timeout = AbortSignal.timeout(10_000)
  let res: Response
  try {
    switch (name) {
      case 'GEMINI_API_KEY':
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { signal: timeout })
        break
      case 'OPENAI_API_KEY':
        res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: timeout })
        break
      case 'CLAUDE_API_KEY':
        res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          signal: timeout,
        })
        break
      case 'RAPIDAPI_KEY':
        res = await fetch('https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=tiktok', {
          headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com' },
          signal: timeout,
        })
        break
      case 'ELEVENLABS_API_KEY':
        res = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key }, signal: timeout })
        break
      default:
        return null
    }
  } catch (err: any) {
    return { ok: false, message: `เชื่อมต่อผู้ให้บริการไม่ได้: ${err?.message || err}` }
  }
  if (res.ok) return { ok: true, message: 'key ใช้งานได้' }
  if (res.status === 401 || res.status === 403) return { ok: false, message: `ผู้ให้บริการปฏิเสธ key นี้ (HTTP ${res.status})` }
  if (res.status === 429) return { ok: true, message: 'key ถูกต้อง แต่ตอนนี้ติดโควตา/ใช้เกินจำนวน (HTTP 429)' }
  return { ok: false, message: `ผู้ให้บริการตอบ HTTP ${res.status}` }
}
