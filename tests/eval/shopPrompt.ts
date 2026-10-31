import { QA_ONLY_PROMPT } from '../../src/lib/ai/assistantPolicy.ts'
import { codPaymentRule } from '../../src/lib/ai/codPolicy.ts'
import { GROUNDING_RULES } from '../../src/lib/ai/grounding.ts'
import type { FixtureChunk, FixtureShop } from './fixtures/shops.ts'

export function formatChunk(chunk: FixtureChunk): string {
  return `[chunk_id: ${chunk.id} | section: ${chunk.section}]\n${chunk.content}`
}

export function catalogText(shop: FixtureShop): string {
  if (shop.products.length === 0) return ''
  const lines = shop.products.map((product) => {
    const stock = product.stock > 0 ? `${product.stock} ชิ้น` : 'หมดสต๊อก'
    return `- ${product.name} (${product.description}) [หมวดหมู่: ${product.category}] รหัสสินค้า ${product.sku}: ${product.price} บาท (คงเหลือ: ${stock})`
  })
  return `[แคตตาล็อกสินค้าของร้าน]\n${lines.join('\n')}`
}

export function paymentText(shop: FixtureShop): string {
  const row = shop.shop
  const promptpay = String(row.promptpay_id || '')
  const bank = String(row.bank_account_number || '')
  if (!promptpay && !bank && shop.paymentMethods.length === 0) return ''
  const lines = [
    promptpay ? `- พร้อมเพย์: ${promptpay} (${shop.name})` : '',
    bank ? `- ธนาคาร: ${row.bank_name} เลขบัญชี: ${bank} ชื่อ: ${row.bank_account_name}` : '',
    `- วิธีชำระที่ร้านเปิด: ${shop.paymentMethods.join(', ') || 'ไม่มีช่องทางชำระในแชท'}`,
    shop.codEnabled ? '- เปิดเก็บเงินปลายทาง' : '- ไม่เปิดเก็บเงินปลายทาง',
  ].filter(Boolean)
  return `[ช่องทางชำระเงิน]\n${lines.join('\n')}`
}

export function knowledgeText(shop: FixtureShop): string {
  if (shop.chunks.length === 0) return ''
  return `[คลังข้อมูลความรู้ของร้าน]\n${shop.chunks.map(formatChunk).join('\n\n')}`
}

export function serviceText(shop: FixtureShop): string {
  if (shop.services.length === 0) return ''
  const lines = shop.services.map((service) =>
    `- ${service.name}: รอบ ${service.slots.join(', ')} มัดจำ ${service.deposit} บาท`,
  )
  return `[แม่แบบการจองของร้าน]\n${lines.join('\n')}`
}

export function promotionText(shop: FixtureShop): string {
  if (shop.promotions.length === 0) return 'ยังไม่มีโปรโมชั่นที่ใช้งานอยู่'
  return `โปรโมชั่นที่ใช้ได้: ${shop.promotions.map((promo) => `${promo.name} ${promo.description}`).join('; ')}`
}

export function historyText(turns: { role: 'user' | 'assistant'; text: string }[]): string {
  if (turns.length <= 1) return ''
  const prior = turns.slice(0, -1)
  const lines = prior.map((turn) => `${turn.role === 'user' ? 'ลูกค้า' : 'AI'}: ${turn.text}`)
  return `[ประวัติบทสนทนาล่าสุด]\n${lines.join('\n')}`
}

/** Prompt and evidence the live model and the grounding check both see. */
export function buildShopContext(shop: FixtureShop, turns: { role: 'user' | 'assistant'; text: string }[]) {
  const blocks = [
    shop.qaOnly
      ? `${QA_ONLY_PROMPT}\nชื่อผู้ช่วย: น้องดีลมี\nหน่วยงาน: ${shop.name}\n\n${GROUNDING_RULES}`
      : `คุณคือพนักงานขายของร้าน "${shop.name}" ตอบจากข้อมูลร้านเท่านั้น\n${GROUNDING_RULES}\n${codPaymentRule(shop.codEnabled)}`,
    catalogText(shop),
    paymentText(shop),
    serviceText(shop),
    knowledgeText(shop),
    `[โปรโมชั่น]\n${promotionText(shop)}`,
    historyText(turns),
  ].filter((part) => part.trim())
  const prompt = blocks.join('\n\n')
  const groundingTexts = [catalogText(shop), paymentText(shop), serviceText(shop), knowledgeText(shop), promotionText(shop)].filter((part) => part.trim())
  return { prompt, groundingTexts }
}
