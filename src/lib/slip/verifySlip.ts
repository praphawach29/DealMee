/**
 * Unified Slip Verification Service
 * Supports: EasySlip, Thunder Solution (thunder.in.th), SlipOK, and Mock/Auto-Approve.
 */

export type SlipProvider = 'easyslip' | 'thunder' | 'slipok' | 'mock'

export interface SlipShopConfig {
  enabled?: boolean
  provider?: SlipProvider | string
  api_key?: string
  branch_id?: string
}

export interface SlipVerifyOptions {
  imageBase64: string
  mimeType?: string
  shopSettings?: SlipShopConfig
  expectedAmount?: number
  expectedReceiverAccount?: string
}

export interface SlipVerifyResult {
  success: boolean
  provider: string
  amount?: number
  /** The bank's transaction reference; undefined when the provider didn't return one */
  transRef?: string
  date?: string
  time?: string
  senderName?: string
  receiverName?: string
  receiverAccount?: string
  isAmountMatched?: boolean
  /** True when no real verification ran (mock provider or no API key); a human must check the slip */
  manualReview?: boolean
  rawMessage?: string
  statusCode?: number
  data?: any
}

/**
 * Resolve provider and API key from shop config with fallback to environment variables
 */
export function resolveSlipProviderAndKey(shopSettings?: SlipShopConfig): {
  provider: SlipProvider
  apiKey: string
  branchId: string
  isShopCustomKey: boolean
} {
  const customProvider = (shopSettings?.provider?.toLowerCase() || '') as SlipProvider
  const customKey = (shopSettings?.api_key || '').trim()
  const customBranchId = (shopSettings?.branch_id || '').trim()

  // Default provider
  let provider: SlipProvider = 'easyslip'
  if (customProvider && ['easyslip', 'thunder', 'slipok', 'mock'].includes(customProvider)) {
    provider = customProvider
  } else if (process.env.SLIP_PROVIDER) {
    provider = process.env.SLIP_PROVIDER.toLowerCase() as SlipProvider
  }

  let apiKey = ''
  let isShopCustomKey = false

  if (customKey) {
    apiKey = customKey
    isShopCustomKey = true
  } else {
    // Fallback to environment variables
    if (provider === 'thunder') {
      apiKey = process.env.THUNDER_API_KEY || ''
    } else if (provider === 'slipok') {
      apiKey = process.env.SLIPOK_API_KEY || ''
    } else {
      apiKey = process.env.EASYSLIP_API_KEY || ''
    }
  }

  const branchId = customBranchId || process.env.SLIPOK_BRANCH_ID || '1'

  return { provider, apiKey, branchId, isShopCustomKey }
}

type RealSlipProvider = Exclude<SlipProvider, 'mock'>

interface ProviderAttempt {
  provider: RealSlipProvider
  apiKey: string
  branchId: string
  /** The shop's own key rather than the platform's */
  isShopCustomKey: boolean
}

const PLATFORM_KEY_ENV: Record<RealSlipProvider, string> = {
  easyslip: 'EASYSLIP_API_KEY',
  thunder: 'THUNDER_API_KEY',
  slipok: 'SLIPOK_API_KEY',
}

/**
 * The configured provider first, then every other provider the platform holds a
 * key for, so one provider being down or out of quota doesn't stop slip checks.
 */
function buildProviderChain(shopSettings?: SlipShopConfig): ProviderAttempt[] {
  const primary = resolveSlipProviderAndKey(shopSettings)
  if (primary.provider === 'mock') return []

  const chain: ProviderAttempt[] = []
  if (primary.apiKey) chain.push({ ...primary, provider: primary.provider })

  for (const provider of Object.keys(PLATFORM_KEY_ENV) as RealSlipProvider[]) {
    if (provider === primary.provider) continue
    const apiKey = (process.env[PLATFORM_KEY_ENV[provider]] || '').trim()
    if (!apiKey) continue
    chain.push({ provider, apiKey, branchId: process.env.SLIPOK_BRANCH_ID || '1', isShopCustomKey: false })
  }
  return chain
}

/**
 * Whether a failed check should be retried with the next provider. Only failures
 * of the provider itself qualify (unreachable, 5xx, and for platform keys a
 * rejected key or exhausted quota); a verdict about the slip (fake, unreadable,
 * not found) stands, since asking another provider would only pay twice for it.
 * A shop's own key that is rejected or out of quota is the shop's to fix, so it
 * doesn't spill over onto the platform's keys.
 */
function shouldTryNextProvider(result: SlipVerifyResult, attempt: ProviderAttempt): boolean {
  const status = result.statusCode ?? 500
  if (status >= 500) return true
  if (attempt.isShopCustomKey) return false
  return status === 401 || status === 402 || status === 403 || status === 429
}

/**
 * Main verify function: runs the provider chain until a provider gives a verdict.
 */
export async function verifySlip(options: SlipVerifyOptions): Promise<SlipVerifyResult> {
  const chain = buildProviderChain(options.shopSettings)

  // Mock mode or no usable API key: nothing was actually verified, so never report the
  // slip as valid. Any image would otherwise mark an order as paid.
  if (chain.length === 0) {
    const { provider } = resolveSlipProviderAndKey(options.shopSettings)
    console.warn(`[SlipVerify] Provider '${provider}' has no usable API key — sending slip to manual review`)
    return {
      success: false,
      manualReview: true,
      provider: provider === 'mock' ? 'mock' : `${provider} (no-key)`,
      rawMessage: 'ระบบตรวจสลิปอัตโนมัติยังไม่ได้ตั้งค่า รอแอดมินตรวจสอบ',
      statusCode: 503,
    }
  }

  let result: SlipVerifyResult | null = null
  for (const [i, attempt] of chain.entries()) {
    result = await verifyWithProvider(attempt, options)
    if (result.success || !shouldTryNextProvider(result, attempt)) return result
    const next = chain[i + 1]
    if (next) {
      console.warn(`[SlipVerify] ${attempt.provider} failed (${result.statusCode}: ${result.rawMessage}) — trying ${next.provider}`)
    }
  }
  return result!
}

async function verifyWithProvider(attempt: ProviderAttempt, options: SlipVerifyOptions): Promise<SlipVerifyResult> {
  const { imageBase64, mimeType = 'image/jpeg', expectedAmount } = options
  const { provider, apiKey, branchId } = attempt

  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  // 2. Thunder Solution (https://api.thunder.in.th/v2/verify/bank)
  if (provider === 'thunder') {
    try {
      const payload: Record<string, any> = {
        image: dataUrl,
        checkDuplicate: true,
      }
      if (expectedAmount && expectedAmount > 0) {
        payload.matchAmount = expectedAmount
      }

      const res = await fetch('https://api.thunder.in.th/v2/verify/bank', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      console.log('[SlipVerify] Thunder response:', JSON.stringify(json))

      if (res.ok && (json.success === true || json.status === 200)) {
        const data = json.data || {}
        const amount = Number(data.amountInSlip ?? data.amount ?? data.totalAmount ?? 0)
        const transRef = data.transRef || data.ref1 || data.transactionId || undefined
        const receiverName = data.matchedAccount?.nameTh || data.receiver?.name || data.receiver?.displayName || ''
        const receiverAccount = data.matchedAccount?.bankNumber || data.receiver?.account?.value || ''
        const isMatched = data.isAmountMatched ?? (expectedAmount ? Math.abs(amount - expectedAmount) <= 1.0 : true)

        return {
          success: true,
          provider: 'thunder',
          amount,
          transRef,
          date: data.date || data.transDate || new Date().toISOString().split('T')[0],
          time: data.time || data.transTime || '',
          senderName: data.sender?.name || data.sender?.displayName || '',
          receiverName,
          receiverAccount,
          isAmountMatched: isMatched,
          rawMessage: json.message || 'ตรวจสอบสลิปสำเร็จ',
          statusCode: 200,
          data,
        }
      }

      const errMsg = json.error?.message || json.message || `Thunder error: ${res.status}`
      return {
        success: false,
        provider: 'thunder',
        rawMessage: errMsg,
        statusCode: res.status,
        data: json,
      }
    } catch (err: any) {
      console.error('[SlipVerify] Thunder request exception:', err)
      return {
        success: false,
        provider: 'thunder',
        rawMessage: err.message || 'ไม่สามารถเชื่อมต่อ Thunder Solution API ได้',
        statusCode: 500,
      }
    }
  }

  // 3. SlipOK (https://api.slipok.com)
  if (provider === 'slipok') {
    try {
      const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
        method: 'POST',
        headers: {
          'x-authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: imageBase64 }),
      })

      const json = await res.json()
      console.log('[SlipVerify] SlipOK response:', JSON.stringify(json))

      if (res.ok && (json.success === true || json.status === 200)) {
        const data = json.data || {}
        const amount = Number(data.amount ?? 0)
        const transRef = data.transRef || undefined
        const isMatched = expectedAmount ? Math.abs(amount - expectedAmount) <= 1.0 : true

        return {
          success: true,
          provider: 'slipok',
          amount,
          transRef,
          date: data.date || '',
          time: data.time || '',
          senderName: data.sender?.displayName || '',
          receiverName: data.receiver?.displayName || '',
          isAmountMatched: isMatched,
          rawMessage: 'ตรวจสอบสลิปสำเร็จ',
          statusCode: 200,
          data,
        }
      }

      const errMsg = json.message || `SlipOK error: ${res.status}`
      return {
        success: false,
        provider: 'slipok',
        rawMessage: errMsg,
        statusCode: res.status,
        data: json,
      }
    } catch (err: any) {
      console.error('[SlipVerify] SlipOK request exception:', err)
      return {
        success: false,
        provider: 'slipok',
        rawMessage: err.message || 'ไม่สามารถเชื่อมต่อ SlipOK API ได้',
        statusCode: 500,
      }
    }
  }

  // 4. EasySlip (default: https://developer.easyslip.com/api/v1/verify)
  try {
    const res = await fetch('https://developer.easyslip.com/api/v1/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: dataUrl }),
    })

    const json = await res.json()
    console.log('[SlipVerify] EasySlip response:', JSON.stringify(json))

    if (res.ok && json.status === 200) {
      const data = json.data || {}
      const amount = Number(data.amount?.amount ?? 0)
      const transRef = data.transRef || data.ref1 || undefined
      const receiverName = data.receiver?.displayName || ''
      const receiverAccount = data.receiver?.account?.value || ''
      const isMatched = expectedAmount ? Math.abs(amount - expectedAmount) <= 1.0 : true

      return {
        success: true,
        provider: 'easyslip',
        amount,
        transRef,
        date: data.date || '',
        time: data.time || '',
        senderName: data.sender?.displayName || '',
        receiverName,
        receiverAccount,
        isAmountMatched: isMatched,
        rawMessage: 'ตรวจสอบสลิปสำเร็จ',
        statusCode: 200,
        data,
      }
    }

    const errMsg = json.message || `EasySlip error: ${json.status || res.status}`
    return {
      success: false,
      provider: 'easyslip',
      rawMessage: errMsg,
      statusCode: json.status || res.status,
      data: json,
    }
  } catch (err: any) {
    console.error('[SlipVerify] EasySlip request exception:', err)
    return {
      success: false,
      provider: 'easyslip',
      rawMessage: err.message || 'ไม่สามารถเชื่อมต่อ EasySlip API ได้',
      statusCode: 500,
    }
  }
}

// ─── Receiver check ──────────────────────────────────────────────────────────

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out))
}

/** Slip account numbers arrive masked, e.g. "xxx-x-x5678-x" or "xxx-xxx-5678". */
function maskedMatches(masked: string, full: string): boolean {
  const m = masked.replace(/[^0-9xX*]/g, '').toLowerCase().replace(/\*/g, 'x')
  const visible = m.replace(/x/g, '')
  if (visible.length < 3) return false
  if (m.length === full.length) {
    for (let i = 0; i < m.length; i++) {
      if (m[i] !== 'x' && m[i] !== full[i]) return false
    }
    return true
  }
  // Different layouts (e.g. +66 vs 0 prefix): fall back to the longest visible digit run
  const runs = m.split('x').filter((r) => r.length >= 4)
  return runs.length > 0 && runs.some((r) => full.includes(r))
}

function normalizeAccountIds(ids: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const id of ids) {
    const digits = String(id || '').replace(/\D/g, '')
    if (digits.length < 6) continue
    out.add(digits)
    if (digits.startsWith('66') && digits.length === 11) out.add(`0${digits.slice(2)}`)
  }
  return [...out]
}

/**
 * Checks the slip's receiver against the shop's own PromptPay / bank accounts.
 * 'unknown' means it could not be decided (no receiver data, or the shop has no
 * accounts configured) and the slip should go to a human instead of auto-approval.
 */
export function checkSlipReceiver(
  result: SlipVerifyResult,
  shopAccountIds: Array<string | null | undefined>
): 'match' | 'mismatch' | 'unknown' {
  const data = result.data || {}
  // Thunder only returns matchedAccount when the slip went to an account registered with it
  if (result.provider === 'thunder' && data.matchedAccount) return 'match'

  const shopIds = normalizeAccountIds(shopAccountIds)
  if (shopIds.length === 0) return 'unknown'

  const candidates: string[] = []
  collectStrings(data.receiver, candidates)
  if (result.receiverAccount) candidates.push(result.receiverAccount)
  // Keep only account-number-shaped strings (masked or not); skips names and short bank codes like "004"
  const accountLike = candidates.filter((c) => {
    const cleaned = c.replace(/[^0-9xX*]/g, '')
    return cleaned.length >= 6 && cleaned.replace(/[xX*]/g, '').length >= 3
  })
  if (accountLike.length === 0) return 'unknown'

  const matched = accountLike.some((c) => shopIds.some((id) => maskedMatches(c, id)))
  return matched ? 'match' : 'mismatch'
}
