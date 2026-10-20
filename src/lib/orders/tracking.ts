/**
 * Parcel tracking, step 1: the shop types the carrier and tracking number on the
 * orders page, the customer gets them in their chat, and the bot can answer
 * "ของถึงไหนแล้ว". No carrier API: carriers' deep-link formats aren't documented,
 * so a site is listed only where it's the carrier's known tracking home, and the
 * shop can paste the exact tracking link the carrier gave them.
 */
export interface Carrier {
  id: string
  name: string
  site?: string
}

export const CARRIERS: Carrier[] = [
  { id: 'thailandpost', name: 'ไปรษณีย์ไทย', site: 'https://track.thailandpost.co.th' },
  { id: 'flash', name: 'Flash Express', site: 'https://www.flashexpress.co.th' },
  { id: 'kex', name: 'KEX Express (Kerry)', site: 'https://th.kex-express.com' },
  { id: 'jt', name: 'J&T Express', site: 'https://www.jtexpress.co.th' },
  { id: 'spx', name: 'Shopee Express (SPX)' },
  { id: 'ninjavan', name: 'Ninja Van' },
  { id: 'best', name: 'BEST Express' },
  { id: 'dhl', name: 'DHL eCommerce' },
  { id: 'lalamove', name: 'Lalamove' },
]

/** Display name; a free-text carrier ("อื่น ๆ") is stored as typed */
export function carrierName(carrier: string | null | undefined): string {
  if (!carrier) return ''
  return CARRIERS.find((c) => c.id === carrier)?.name || carrier
}

/** Where the customer can check: the shop's own link first, then the carrier's site */
export function trackingLink(carrier: string | null | undefined, url: string | null | undefined): string {
  if (url && /^https?:\/\//i.test(url.trim())) return url.trim()
  return CARRIERS.find((c) => c.id === carrier)?.site || ''
}

export function shippedMessage(order: {
  order_no: string
  tracking_no: string
  tracking_carrier?: string | null
  tracking_url?: string | null
}): string {
  const name = carrierName(order.tracking_carrier)
  const link = trackingLink(order.tracking_carrier, order.tracking_url)
  return [
    `📦 ออเดอร์ ${order.order_no} จัดส่งแล้ว`,
    name ? `ขนส่ง: ${name}` : '',
    `เลขพัสดุ: ${order.tracking_no}`,
    link ? `ติดตามพัสดุ: ${link}` : name ? `ตรวจสอบสถานะได้ที่เว็บหรือแอปของ ${name}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
