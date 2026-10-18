/**
 * Free-trial rules (decided 2026-10-18):
 * - 14 days with every Pro feature (auto orders, QR, slip checks, quotations,
 *   discounts) and up to 300 AI messages.
 * - When it ends the shop falls back to the Free plan: data is kept and the bot
 *   still answers questions, but sales automation is locked until the shop
 *   upgrades. Customers are never shown "trial expired"; orders are handed to
 *   the shop's admin instead.
 */

export const TRIAL_DAYS = 14
export const TRIAL_MESSAGE_LIMIT = 300

type ShopPlanFields = {
  plan?: string | null
  plan_key?: string | null
  trial_expires_at?: string | null
}

function isTrialShop(shop: ShopPlanFields | null | undefined): boolean {
  if (!shop) return false
  return (shop.plan || '').toLowerCase() === 'trial' || (shop.plan_key || '').toLowerCase() === 'trial'
}

export function trialStatus(shop: ShopPlanFields | null | undefined, now = new Date()) {
  if (!isTrialShop(shop)) return { isTrial: false, expired: false, daysLeft: 0, endsAt: null as Date | null }
  const endsAt = shop?.trial_expires_at ? new Date(shop.trial_expires_at) : null
  const expired = endsAt ? now >= endsAt : false
  const daysLeft = endsAt && !expired ? Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000)) : 0
  return { isTrial: true, expired, daysLeft, endsAt }
}

/** Plan key the shop is entitled to right now ('trial' while it runs, 'free' once it has ended). */
export function effectivePlanKey(shop: ShopPlanFields | null | undefined): string {
  const trial = trialStatus(shop)
  if (trial.isTrial) return trial.expired ? 'free' : 'trial'
  return (shop?.plan_key || shop?.plan || 'free').toLowerCase()
}

/** Auto orders, QR, slip verification, quotations and discounts are paid / trial features. */
export function salesAutomationEnabled(shop: ShopPlanFields | null | undefined): boolean {
  return effectivePlanKey(shop) !== 'free'
}

/** Tools hidden from the model when sales automation is locked. */
export const SALES_AUTOMATION_TOOLS = new Set<string>([
  'take_order', 'send_payment_qr', 'accept_quotation', 'apply_custom_discount',
  'create_quotation', 'create_official_letter',
])

export const SALES_LOCKED_PROMPT = `

[ระบบขายอัตโนมัติของร้านยังไม่เปิดใช้งาน]
ตอนนี้คุณยังสร้างออเดอร์ ส่ง QR ออกใบเสนอราคา หรือให้ส่วนลดเองไม่ได้ เมื่อลูกค้าต้องการสั่งซื้อหรือชำระเงิน ให้สรุปสินค้า จำนวน ชื่อ เบอร์โทร และที่อยู่ที่ลูกค้าแจ้ง แล้วเรียก request_human_agent เพื่อให้แอดมินดูแลการสั่งซื้อต่อ โดยบอกลูกค้าอย่างสุภาพว่าแอดมินจะติดต่อกลับเพื่อยืนยันออเดอร์ ห้ามพูดถึงแพ็กเกจหรือการหมดอายุกับลูกค้า`
