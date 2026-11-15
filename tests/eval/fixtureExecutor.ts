import type { AgentToolName } from '../../src/lib/ai/salesAgentEngine.ts'
import type { ToolExecutionResult } from '../../src/lib/ai/toolDispatcher.ts'
import { computeShippingFee } from '../../src/lib/ai/catalogPricing.ts'
import { codOrderRefusal } from '../../src/lib/ai/codPolicy.ts'
import { NO_KNOWLEDGE_TOOL_RESULT } from '../../src/lib/knowledge/hybrid.ts'
import type { FixtureProduct, FixtureShop } from './fixtures/shops.ts'

export interface LoggedTool {
  name: string
  args: Record<string, unknown>
  result: string
}

function findProducts(shop: FixtureShop, keyword: string): FixtureProduct[] {
  const text = keyword.trim().toLowerCase()
  if (!text) return shop.products.slice(0, 5)
  return shop.products.filter((product) => {
    const haystack = `${product.name} ${product.sku} ${product.aliases.join(' ')} ${product.category}`.toLowerCase()
    return haystack.includes(text) || product.aliases.some((alias) => text.includes(alias.toLowerCase())) || text.includes(product.name.toLowerCase())
  })
}

function knowledgeResult(shop: FixtureShop, query: string): string {
  const tokens = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2)
  const hits = shop.chunks.filter((chunk) => {
    const content = chunk.content.toLowerCase()
    return tokens.some((token) => content.includes(token))
  })
  if (hits.length === 0) return NO_KNOWLEDGE_TOOL_RESULT(query)
  return `ข้อมูลจากคลังความรู้:\n${hits.map((chunk) => `[chunk_id: ${chunk.id} | section: ${chunk.section}]\n${chunk.content}`).join('\n\n')}`
}

function orderTotal(shop: FixtureShop, product: FixtureProduct, qty: number, address: string): { total: number; shipping: number; subtotal: number } {
  const subtotal = product.price * qty
  const { fee } = computeShippingFee(shop.shop, address, subtotal)
  return { total: subtotal + fee, shipping: fee, subtotal }
}

/** In-memory tools for the eval. Talks to fixture rows only, never the product database. */
export function createFixtureExecutor(shop: FixtureShop, log: LoggedTool[]) {
  return async (name: AgentToolName, args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    let result = ''
    if (!shop.booking && (name === 'check_available_slots' || name === 'book_appointment' || name === 'reschedule_booking' || name === 'cancel_booking' || name === 'check_booking')) {
      result = 'ร้านนี้ไม่ได้เปิดระบบจองคิวผ่านแชท แจ้งลูกค้าอย่างสุภาพว่าแอดมินจะติดต่อกลับเพื่อนัดหมายให้'
    } else if (name === 'search_products') {
      const found = findProducts(shop, String(args.keyword || ''))
      result = found.length === 0
        ? `ไม่พบสินค้าที่ตรงกับ "${String(args.keyword || '')}"`
        : `สินค้าที่พบ: ${found.map((product) => `${product.name} ราคา ${product.price} บาท ${product.stock > 0 ? `เหลือ ${product.stock} ชิ้น` : 'หมดสต๊อก'}`).join('; ')}`
    } else if (name === 'check_stock') {
      const found = findProducts(shop, String(args.product_name || ''))
      result = found.length === 0
        ? `ไม่พบสินค้า "${String(args.product_name || '')}"`
        : found.map((product) => `${product.name} (รหัส SKU: ${product.sku}): ${product.stock > 0 ? `มีสินค้าพร้อมส่ง ${product.stock} ชิ้น` : 'สินค้าหมดสต๊อกชั่วคราว'}, ราคา ${product.price} บาท`).join('; ')
    } else if (name === 'search_knowledge_base') {
      result = knowledgeResult(shop, String(args.query || args.keyword || ''))
    } else if (name === 'get_active_promotions') {
      result = shop.promotions.length === 0
        ? 'ยังไม่มีโปรโมชั่นที่ใช้งานอยู่ ให้แจ้งลูกค้าตามนี้'
        : `โปรโมชั่นที่ใช้ได้: ${shop.promotions.map((promo) => promo.name).join('; ')}`
    } else if (name === 'calculate_shipping') {
      const address = String(args.province || args.address || '')
      const { fee, zoneName, freeThreshold } = computeShippingFee(shop.shop, address, 0)
      const freeNote = freeThreshold > 0 ? ` (ส่งฟรีเมื่อซื้อครบ ${freeThreshold} บาท)` : ''
      result = `ผลการคำนวณค่าจัดส่งปลายทาง (${address || 'ไม่ระบุพื้นที่'}): พื้นที่ "${zoneName}" อัตราค่าจัดส่งคือ ${fee} บาท${freeNote}`
    } else if (name === 'take_order') {
      const refusal = codOrderRefusal(shop.shop, args.payment_method)
      if (refusal) {
        result = refusal
      } else {
        const requested = Array.isArray(args.items) ? args.items[0] as { product?: string; qty?: number } : null
        const product = findProducts(shop, String(requested?.product || ''))[0]
        if (!product) {
          result = `ยังสร้างออเดอร์ไม่ได้: ไม่พบสินค้า "${String(requested?.product || '')}" ในระบบของร้าน`
        } else if (product.stock <= 0) {
          result = `${product.name} หมดสต๊อก ให้แจ้งลูกค้าและเสนอสินค้าอื่น`
        } else {
          const qty = Number(requested?.qty || 1)
          const priced = orderTotal(shop, product, qty, String(args.address || ''))
          result = `สร้างออเดอร์สำเร็จแล้วจริง เลขที่ออเดอร์: EVAL-100001 ยอดรวมตามระบบ ${priced.total} บาท (สินค้า ${priced.subtotal} + ค่าส่ง ${priced.shipping})`
        }
      }
    } else if (name === 'request_human_agent') {
      result = 'เรียกแอดมินให้เข้ามาดูแลแล้ว ให้บอกลูกค้าว่าส่งเรื่องให้แอดมินแล้ว'
    } else if (name === 'send_payment_qr') {
      result = shop.shop.promptpay_id
        ? 'ยังไม่มีออเดอร์ที่รอชำระของลูกค้ารายนี้ จึงยังส่ง QR ไม่ได้'
        : 'ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ ยังส่ง QR ไม่ได้'
    } else if (name === 'check_order_status') {
      result = 'ไม่พบออเดอร์ของลูกค้าคนนี้ในแชทนี้ ให้ขอเลขที่ออเดอร์ หรือถ้าลูกค้ายืนยันว่าสั่งไว้ ให้เรียก request_human_agent ให้แอดมินตรวจสอบ'
    } else if (name === 'check_available_slots') {
      const service = shop.services[0]
      result = service
        ? `รอบที่เปิดของ ${service.name}: ${service.slots.join(', ')} ถ้าเวลาที่ลูกค้าขอไม่อยู่ในรายการ ห้ามยืนยันรอบนั้น`
        : 'ไม่พบแม่แบบจอง'
    } else if (name === 'book_appointment') {
      const service = shop.services[0]
      const time = String(args.time || '')
      result = service && service.slots.includes(time)
        ? `จองสำเร็จ เลขที่จอง BK-100001 ${service.name} เวลา ${time}`
        : `ยังจองไม่ได้: เวลา ${time || '-'} ไม่อยู่ในรอบที่เปิด`
    } else if (name === 'create_quotation') {
      result = 'สร้างใบเสนอราคาทดสอบ EVAL-QT-1001 จากราคาในแคตตาล็อกแล้ว'
    } else {
      result = `เครื่องมือ ${name} ทำงานกับข้อมูลทดสอบแล้ว`
    }
    log.push({ name, args, result })
    return { resultForAi: result, immediateMessages: [] }
  }
}

export function argsForTool(name: string, shop: FixtureShop, userText: string): Record<string, unknown> {
  const product = shop.products.find((item) => item.aliases.some((alias) => alias.length >= 4 && userText.includes(alias)) || userText.includes(item.name)) || shop.products[0]
  const province = /เชียงใหม่|ภูเก็ต|กรุงเทพ|กทม|ยะลา|หาดใหญ่/.exec(userText)?.[0] || 'เชียงใหม่'
  if (name === 'search_products') return { keyword: product?.name || '' }
  if (name === 'check_stock') return { product_name: product?.name || 'สินค้า' }
  if (name === 'search_knowledge_base') return { query: userText }
  if (name === 'calculate_shipping') return { province }
  if (name === 'get_active_promotions') return {}
  if (name === 'take_order') {
    return {
      name: 'มิน',
      phone: '0811112222',
      items: [{ product: product?.name || 'สินค้า', qty: 1 }],
      address: province,
      payment_method: /ปลายทาง|\bcod\b/i.test(userText) ? 'เก็บเงินปลายทาง' : 'โอนเงิน',
      total_price: product?.price || 0,
    }
  }
  if (name === 'request_human_agent') return { reason: userText.slice(0, 180) }
  if (name === 'check_available_slots') return { date: '2026-11-20', service: shop.services[0]?.name || '', time: '13:00' }
  if (name === 'book_appointment') return { service: shop.services[0]?.name || '', date: '20/11/2026', time: '13:00', name: 'มิน', phone: '0811112222' }
  if (name === 'check_booking') return { query: 'มิน' }
  if (name === 'create_quotation') return { customer_name: 'คุณเอ', items: [{ name: product?.name || 'สินค้า', qty: 1, price: product?.price || 0 }] }
  if (name === 'schedule_followup') return { delay_minutes: 30, reason: 'general' }
  return {}
}
