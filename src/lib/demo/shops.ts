/**
 * The landing page's live demo: three sample shops seeded by
 * supabase/migrations/20261101000000_live_demo.sql. Ids must match that file.
 * Safe to import from client components (no server imports).
 */
export type DemoPersona = 'shop' | 'spa' | 'cleaning'

export interface DemoShop {
  persona: DemoPersona
  shopId: string
  label: string
  emoji: string
  shopName: string
  botName: string
  greeting: string
  /** What this sample shows, one line for the tab */
  shows: string
  /** Starter questions the visitor can tap */
  starters: string[]
}

export const DEMO_SHOPS: DemoShop[] = [
  {
    persona: 'shop',
    shopId: 'd3300000-0000-4000-8000-000000000001',
    label: 'ร้านค้าออนไลน์',
    emoji: '👕',
    shopName: 'Sunday Clothing',
    botName: 'น้องซันเดย์',
    greeting: 'สวัสดีค่ะ ร้าน Sunday Clothing ยินดีต้อนรับค่ะ สนใจเสื้อผ้าแบบไหนบอกได้เลยนะคะ',
    shows: 'ค้นสินค้า · การ์ดสินค้า · สั่งซื้อ · QR ชำระเงิน',
    starters: ['มีเสื้อเชิ้ตลินินไหม', 'ไซซ์ M รอบอกเท่าไหร่', 'ค่าส่งเท่าไหร่ ส่งกี่วัน', 'เอาเสื้อยืดสีดำ ไซซ์ L 2 ตัว'],
  },
  {
    persona: 'spa',
    shopId: 'd3300000-0000-4000-8000-000000000002',
    label: 'สปา / จองคิว',
    emoji: '💆',
    shopName: 'Moonlight Spa',
    botName: 'น้องมูน',
    greeting: 'สวัสดีค่ะ Moonlight Spa ยินดีให้บริการค่ะ อยากดูคิวว่างหรือสอบถามบริการไหนบอกได้เลยนะคะ',
    shows: 'บริการและราคา · เช็คคิวว่าง · จอง · เลื่อน/ยกเลิก',
    starters: ['มีบริการอะไรบ้าง', 'พรุ่งนี้บ่ายสองว่างไหม นวดไทย', 'ยกเลิกล่วงหน้ากี่ชั่วโมง', 'ท้องอยู่นวดได้ไหม'],
  },
  {
    persona: 'cleaning',
    shopId: 'd3300000-0000-4000-8000-000000000003',
    label: 'ธุรกิจบริการ',
    emoji: '🧹',
    shopName: 'CleanMate',
    botName: 'น้องคลีน',
    greeting: 'สวัสดีครับ CleanMate บริการทำความสะอาดบ้านและคอนโด สอบถามราคาหรือพื้นที่ให้บริการได้เลยครับ',
    shows: 'ตอบจากคลังความรู้ · ส่งต่อแอดมินพร้อมเบอร์',
    starters: ['คอนโด 2 ห้องนอนราคาเท่าไหร่', 'รวมล้างแอร์ไหม', 'ไปนนทบุรีได้ไหม', 'อยากให้ทีมงานโทรกลับ'],
  },
]

export const DEMO_SHOP_IDS = DEMO_SHOPS.map((s) => s.shopId)

export function demoShopFor(persona: unknown): DemoShop | null {
  return DEMO_SHOPS.find((s) => s.persona === persona) || null
}

/** Caps. Kept here so the API and the page say the same number. */
export const DEMO_MESSAGES_PER_VISITOR = 12
export const DEMO_MESSAGES_PER_NETWORK = 40
export const DEMO_MESSAGES_PER_DAY = 600
export const DEMO_MESSAGE_MAX_CHARS = 300
