/**
 * PromptPay EMVCo Standard Payload & QR Generator Helper
 * Generates official Thai PromptPay QR payloads for Phone Numbers (10 digits) & National/Tax IDs (13 digits)
 */

function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff
    x ^= x >> 4
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function generatePromptPayPayload(target: string, amount?: number): string {
  // Sanitize target string
  const cleanTarget = target.replace(/[^0-9]/g, '')

  let targetSubtag = ''
  if (cleanTarget.length === 10) {
    // Phone number: prefix with 0066 and drop leading 0
    const phoneNo = '0066' + cleanTarget.slice(1)
    targetSubtag = `01${phoneNo.length.toString().padStart(2, '0')}${phoneNo}`
  } else if (cleanTarget.length === 13) {
    // National ID or Tax ID
    targetSubtag = `02${cleanTarget.length.toString().padStart(2, '0')}${cleanTarget}`
  } else {
    // Fallback if formatting is unusual
    targetSubtag = `01${cleanTarget.length.toString().padStart(2, '0')}${cleanTarget}`
  }

  // Merchant Account Information Tag 29
  const aid = '0016A000000677010111'
  const tag29Content = `${aid}${targetSubtag}`
  const tag29 = `29${tag29Content.length.toString().padStart(2, '0')}${tag29Content}`

  // Payload Format Indicator & Initiation Method
  const ffi = '000201'
  const initMethod = amount && amount > 0 ? '010212' : '010211'
  const currency = '5303764' // THB
  const country = '5802TH'

  let amountStr = ''
  if (amount && amount > 0) {
    const formattedAmount = amount.toFixed(2)
    amountStr = `54${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}`
  }

  const rawData = `${ffi}${initMethod}${tag29}${currency}${amountStr}${country}6304`
  const checksum = crc16(rawData)

  return `${rawData}${checksum}`
}

export function getPromptPayQrImageUrl(target: string, amount?: number): string {
  const payload = generatePromptPayPayload(target, amount)
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`
}
