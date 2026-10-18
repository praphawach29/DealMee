/**
 * The handful of customer-facing strings the system writes itself rather
 * than letting the model compose: quota notices, the multi-step
 * acknowledgement, fallbacks when a provider fails, and the payment and
 * order blocks that are pushed verbatim because a reworded digit misdirects
 * money.
 *
 * Everything else a customer reads comes from the model, which follows the
 * language of the incoming message on its own. These strings can't, so
 * without this a customer writing in English got an English reply followed
 * by a Thai order summary.
 *
 * `resultForAi` strings are deliberately not here — those are instructions
 * to the model, never shown to anyone.
 */

export type CustomerLanguage = 'th' | 'en'

/**
 * Picks the language from the script the customer typed in. Deliberately not
 * a full language detector: Thai script is unambiguous, and for a Thai shop
 * anything else is far more likely to be a foreign customer reaching for
 * English than a Thai customer typing romanised Thai. Remembering a returning
 * customer's preference is a separate, later step.
 */
export function detectCustomerLanguage(text: string): CustomerLanguage {
  return /[฀-๿]/.test(text) ? 'th' : 'en'
}

type Catalog = Record<CustomerLanguage, string>

const QUOTA_EXCEEDED: Catalog = {
  th: 'ขอบคุณที่ทักมานะคะ 🙏 แอดมินได้รับข้อความแล้ว จะรีบตอบกลับโดยเร็วที่สุดค่ะ',
  en: 'Thanks for your message! 🙏 Our team has received it and will get back to you shortly.',
}

const PLANNING_ACK: Catalog = {
  th: 'กำลังตรวจสอบให้สักครู่นะคะ รอแป๊บนึงนะคะ 🙏',
  en: 'Let me check that for you — one moment please 🙏',
}

const SYSTEM_BUSY: Catalog = {
  th: 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ',
  en: 'Sorry, something went wrong on our side. Please try again in a moment.',
}

const REPLY_CUT_OFF: Catalog = {
  th: 'ขออภัยค่ะ ระบบตอบข้อความไม่ครบ รบกวนพิมพ์คำถามอีกครั้งนะคะ 🙏',
  en: "Sorry, my reply got cut off. Could you send that question again? 🙏",
}

const HANDOFF_TOO_COMPLEX: Catalog = {
  th: 'ขออภัยค่ะ เรื่องนี้ซับซ้อนเกินกว่าจะตอบได้ในตอนนี้ รอสักครู่แอดมินจะติดต่อกลับนะคะ',
  en: "This one is beyond what I can work out on my own — a member of staff will follow up with you shortly.",
}

const PAYMENT_AMOUNT_DUE: Catalog = { th: 'ยอดที่ต้องชำระ', en: 'Amount due' }
const PAYMENT_PROMPTPAY: Catalog = { th: 'พร้อมเพย์', en: 'PromptPay' }
const PAYMENT_ACCOUNT_NAME: Catalog = { th: 'ชื่อบัญชี', en: 'Account name' }
const PAYMENT_BANK: Catalog = { th: 'ธนาคาร', en: 'Bank' }
const PAYMENT_ACCOUNT_NO: Catalog = { th: 'เลขบัญชี', en: 'Account number' }
const PAYMENT_COD: Catalog = {
  th: 'เก็บเงินปลายทาง: แจ้งแอดมินเพื่อยืนยันพื้นที่จัดส่ง',
  en: 'Cash on delivery: message the shop to confirm your delivery area',
}
const PAYMENT_NOT_SET_UP: Catalog = {
  th: 'ร้านยังไม่ได้ตั้งค่าช่องทางชำระเงิน กรุณารอแอดมินยืนยันช่องทางชำระเงิน',
  en: "The shop hasn't set up payment details yet — staff will confirm how to pay.",
}
const PAYMENT_SEND_SLIP: Catalog = {
  th: 'โอนแล้วส่งสลิปกลับมาในแชทนี้ได้เลยนะคะ',
  en: 'Once you have paid, send the transfer slip back here.',
}

const ORDER_SUMMARY_TITLE: Catalog = { th: 'สรุปออเดอร์เรียบร้อยค่ะ', en: 'Here is your order summary' }
const ORDER_NO: Catalog = { th: 'เลขที่ออเดอร์', en: 'Order number' }
const ORDER_ITEM: Catalog = { th: 'สินค้า', en: 'Item' }
const ORDER_TOTAL: Catalog = { th: 'ยอดสุทธิ', en: 'Total' }
const ORDER_DELIVERY_HEADING: Catalog = { th: 'ข้อมูลจัดส่ง', en: 'Delivery details' }
const ORDER_RECIPIENT: Catalog = { th: 'ชื่อผู้รับ', en: 'Recipient' }
const ORDER_PHONE: Catalog = { th: 'เบอร์โทร', en: 'Phone' }
const ORDER_ADDRESS: Catalog = { th: 'ที่อยู่', en: 'Address' }
const ORDER_PAYMENT_METHOD: Catalog = { th: 'วิธีชำระเงิน', en: 'Payment method' }
const ORDER_PAYMENT_HEADING: Catalog = { th: 'ช่องทางชำระเงิน', en: 'How to pay' }
const ORDER_TRANSFER_DEFAULT: Catalog = { th: 'โอนเงิน', en: 'Bank transfer' }
const CURRENCY_BAHT: Catalog = { th: 'บาท', en: 'THB' }

const QR_AMOUNT: Catalog = { th: 'ยอดชำระ', en: 'Amount to pay' }
const QR_SCAN_HINT: Catalog = {
  th: 'บันทึกรูป QR แล้วเปิดแอปธนาคารสแกนได้เลยค่ะ',
  en: 'Save the QR image, then scan it from your banking app.',
}
const QR_SLIP_HINT: Catalog = {
  th: 'โอนเสร็จกรุณาส่งสลิปกลับมาในแชทนะคะ',
  en: 'Send the transfer slip back here once it is done.',
}

export const MESSAGES = {
  quotaExceeded: QUOTA_EXCEEDED,
  planningAck: PLANNING_ACK,
  systemBusy: SYSTEM_BUSY,
  replyCutOff: REPLY_CUT_OFF,
  handoffTooComplex: HANDOFF_TOO_COMPLEX,
  paymentAmountDue: PAYMENT_AMOUNT_DUE,
  paymentPromptPay: PAYMENT_PROMPTPAY,
  paymentAccountName: PAYMENT_ACCOUNT_NAME,
  paymentBank: PAYMENT_BANK,
  paymentAccountNo: PAYMENT_ACCOUNT_NO,
  paymentCod: PAYMENT_COD,
  paymentNotSetUp: PAYMENT_NOT_SET_UP,
  paymentSendSlip: PAYMENT_SEND_SLIP,
  orderSummaryTitle: ORDER_SUMMARY_TITLE,
  orderNo: ORDER_NO,
  orderItem: ORDER_ITEM,
  orderTotal: ORDER_TOTAL,
  orderDeliveryHeading: ORDER_DELIVERY_HEADING,
  orderRecipient: ORDER_RECIPIENT,
  orderPhone: ORDER_PHONE,
  orderAddress: ORDER_ADDRESS,
  orderPaymentMethod: ORDER_PAYMENT_METHOD,
  orderPaymentHeading: ORDER_PAYMENT_HEADING,
  orderTransferDefault: ORDER_TRANSFER_DEFAULT,
  currencyBaht: CURRENCY_BAHT,
  qrAmount: QR_AMOUNT,
  qrScanHint: QR_SCAN_HINT,
  qrSlipHint: QR_SLIP_HINT,
} satisfies Record<string, Catalog>

export function t(key: keyof typeof MESSAGES, lang: CustomerLanguage = 'th'): string {
  return MESSAGES[key][lang]
}
