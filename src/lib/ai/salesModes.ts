/**
 * Two cases where the bot answers questions but a person closes the sale:
 *
 * - Info-only shop: the catalog is empty (a service page, an organisation's page,
 *   a shop that only uploaded knowledge files). The bot used to keep its order /
 *   quotation / QR tools and promise "ยินดีออกใบเสนอราคาให้ทันที", then fail.
 * - High-value products: priced at or above the shop's threshold (default 10,000
 *   baht, shops.features.high_value_threshold, 0 = off). A buyer of a 50,000-baht
 *   item usually wants a person to explain and close.
 *
 * In both, the bot collects a name and phone number and calls request_human_agent,
 * which alerts the shop's admin on LINE straight away with those details.
 */

export const DEFAULT_HIGH_VALUE_THRESHOLD = 10_000
/** Choices on /dashboard/modules; 0 = the bot sells everything itself */
export const HIGH_VALUE_THRESHOLD_OPTIONS = [0, 3_000, 5_000, 10_000, 20_000, 50_000, 100_000]

/** Products at or above this price are sold by the admin; 0 turns the rule off. */
export function highValueThreshold(features: Record<string, unknown> | null | undefined): number {
  const raw = features?.high_value_threshold
  if (raw === undefined || raw === null || raw === '') return DEFAULT_HIGH_VALUE_THRESHOLD
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_HIGH_VALUE_THRESHOLD
}

export function isHighValue(price: unknown, threshold: number): boolean {
  return threshold > 0 && Number(price || 0) >= threshold
}

/** Tag shown next to a high-value product in the catalog the model reads */
export const HIGH_VALUE_TAG = '[ราคาสูง: ให้แอดมินปิดการขาย]'

const HANDOFF_STEPS = `ขอชื่อและเบอร์โทร (หรือช่องทางติดต่อที่สะดวก) ของลูกค้าถ้ายังไม่มี แล้วเรียก request_human_agent โดยใส่ customer_name, phone และ interest (สิ่งที่ลูกค้าสนใจ จำนวน หรือความต้องการ) ให้ครบ จากนั้นบอกลูกค้าว่าได้ส่งเรื่องให้แอดมินแล้ว แอดมินจะติดต่อกลับโดยเร็ว`

export const INFO_ONLY_PROMPT = `

[ร้านนี้ไม่มีรายการสินค้าในระบบ: โหมดให้ข้อมูล]
ตอบคำถามจากคลังความรู้ของร้านเท่านั้น ห้ามสัญญาว่าจะออกใบเสนอราคา สร้างออเดอร์ ส่ง QR ชำระเงิน หรือให้ส่วนลดเอง
เมื่อลูกค้าสนใจซื้อหรือใช้บริการ ขอใบเสนอราคา ขอนัด หรืออยากคุยรายละเอียดเพิ่ม: ${HANDOFF_STEPS}`

export function highValuePrompt(threshold: number): string {
  return `

[สินค้าราคาสูง: แอดมินเป็นคนปิดการขาย]
สินค้าที่ราคาตั้งแต่ ${threshold.toLocaleString()} บาทขึ้นไป (มีป้าย ${HIGH_VALUE_TAG} ในแคตตาล็อก) ให้ตอบข้อมูลและคุณสมบัติได้ตามปกติ แต่ห้ามสร้างออเดอร์ ออกใบเสนอราคา หรือส่ง QR เอง
เมื่อลูกค้าสนใจซื้อ ขอใบเสนอราคา ต่อรองราคา หรืออยากให้อธิบายเพิ่ม: ${HANDOFF_STEPS}`
}

/** Returned to the model when it still tries to order or quote a high-value product */
export function highValueRefusal(productNames: string[]): string {
  return `${productNames.join(', ')} เป็นสินค้าราคาสูงที่ร้านให้แอดมินปิดการขายเอง ห้ามสร้างออเดอร์หรือใบเสนอราคา ให้${HANDOFF_STEPS}`
}
