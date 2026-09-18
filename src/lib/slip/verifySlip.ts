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
  transRef?: string
  date?: string
  time?: string
  senderName?: string
  receiverName?: string
  receiverAccount?: string
  isAmountMatched?: boolean
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

/**
 * Main verify function
 */
export async function verifySlip(options: SlipVerifyOptions): Promise<SlipVerifyResult> {
  const { imageBase64, mimeType = 'image/jpeg', shopSettings, expectedAmount } = options
  const { provider, apiKey, branchId } = resolveSlipProviderAndKey(shopSettings)

  // 1. Mock mode or missing API key fallback
  if (provider === 'mock' || !apiKey) {
    console.warn(`[SlipVerify] Provider '${provider}' or missing API key — falling back to mock approval`)
    return {
      success: true,
      provider: provider === 'mock' ? 'mock' : `${provider} (mock-auto)`,
      amount: expectedAmount || 0,
      transRef: `MOCK-${Date.now().toString().slice(-8)}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      receiverName: 'ร้านค้า (โหมดจำลอง)',
      isAmountMatched: true,
      rawMessage: 'อนุมัติอัตโนมัติ (โหมดทดสอบ/ไม่มี API Key)',
      statusCode: 200,
    }
  }

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
        const transRef = data.transRef || data.ref1 || data.transactionId || `THD-${Date.now()}`
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
        const transRef = data.transRef || `SOK-${Date.now()}`
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
      const transRef = data.transRef || data.ref1 || `ESL-${Date.now()}`
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
