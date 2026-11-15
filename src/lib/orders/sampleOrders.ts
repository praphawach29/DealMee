/**
 * Orders inserted by the retired "เติมข้อมูลทดสอบ" action.
 * Real bot orders are `ORD-` plus the last 6 digits of a timestamp, so they
 * do not match. The 4-digit form was the earlier dashboard filter.
 */
export const SAMPLE_ORDER_EXCLUSION_PATTERN = '^(ORD-[0-9]{4}$|ORD-20260803-)'

const sampleOrderNo = new RegExp(SAMPLE_ORDER_EXCLUSION_PATTERN)

export function isSampleOrderNo(orderNo: string | null | undefined): boolean {
  return sampleOrderNo.test(String(orderNo || ''))
}
