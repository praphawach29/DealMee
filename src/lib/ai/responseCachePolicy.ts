import crypto from 'crypto'

/**
 * Price, stock, shipping cost, payment, and order status change per customer
 * and per catalog edit. Those answers must never be reused from the cache.
 * Document numbers and phone numbers are customer-specific too.
 */
const VOLATILE_QUERY = /ราคา|เท่าไหร่|เท่าไร|กี่บาท|สต็อก|สต๊อก|คงเหลือ|เหลือกี่|เหลือไหม|ของหมด|สินค้าหมด|มีของไหม|มีสินค้าไหม|ออเดอร์|คำสั่งซื้อ|เลขพัสดุ|พัสดุ|ของถึงไหน|เช็คของ|ค่าส่ง|ค่าจัดส่ง|ส่งฟรี|สลิป|พร้อมเพย์|เก็บปลายทาง|\bcod\b|\bprice\b|\bstock\b|\border\b|\bshipping\b/i

export function hashQuery(text: string): string {
  return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex').slice(0, 32)
}

/** Cache identity is the shop plus the query hash. The hash alone is not a key. */
export function responseCacheIdentity(shopId: string, query: string): { shopId: string; queryHash: string } {
  return { shopId, queryHash: hashQuery(query) }
}

export function isCacheableCustomerQuery(query: string): boolean {
  const text = query.trim()
  if (!text || text.length > 240) return false
  if (/\b(ORD|BK|QT)-\d+/i.test(text)) return false
  if (/\b0\d{8,9}\b/.test(text)) return false
  if (VOLATILE_QUERY.test(text)) return false
  return true
}

/**
 * A cached reply is only safe for a first turn that does not depend on this
 * customer's history. `priorMessageCount` includes the message just saved, so
 * more than one row means the conversation already has context.
 */
export function mayStoreResponseCache(input: {
  features?: Record<string, unknown> | null
  query: string
  hasExplicitHistory: boolean
  isPlayground?: boolean
  priorMessageCount: number
}): boolean {
  if (input.features?.shop_skills_enabled === true || input.features?.assistant_qa_only === true) return false
  if (input.isPlayground) return false
  if (input.hasExplicitHistory) return false
  if (input.priorMessageCount > 1) return false
  return isCacheableCustomerQuery(input.query)
}
