/** Customer-facing copy when a back-in-stock follow-up gives up. Uses the asked-for product, not a hardcoded item. */
export function backInStockStillWaitingMessage(productName: unknown): string {
  const label = String(productName || 'สินค้า').replace(/\s+/g, ' ').trim().slice(0, 80) || 'สินค้า'
  return `👋 สวัสดีค่ะ ${label} ที่ถามไว้ ยังไม่มาถึงร้านค่ะ ถ้าของมาจะรีบแจ้งให้ทราบอีกครั้งนะ 😊`
}

/** PostgREST ilike pattern. Strips wildcards and commas so a product name cannot change the filter. */
export function restockIlikePattern(productName: string): string {
  const cleaned = productName.replace(/[%_\\,]/g, ' ').replace(/\s+/g, ' ').trim()
  return `%${cleaned}%`
}
