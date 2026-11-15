export interface PlanItem {
  id?: string
  key: string
  name: string
  price: number
  messages: number
  tokens: number
  slips: number
  description: string
  badge_color?: string
  features: string[]
  stripe_price_id?: string | null
}

export const DEFAULT_ADMIN_PLANS: PlanItem[] = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    messages: 100,
    tokens: 1000000,
    slips: 0,
    description: 'บอทตอบคำถามลูกค้าได้ ออเดอร์และสลิปส่งให้แอดมินดูแลเอง',
    badge_color: 'bg-surface-container-high text-on-surface',
    features: ['ข้อความ AI 100 ข้อความ/เดือน', 'ตอบแชท LINE OA และ Messenger', 'ระบบแชทสด (Inbox)'],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 590,
    messages: 1000,
    tokens: 5000000,
    slips: 100,
    description: 'สำหรับร้านเล็กที่เริ่มให้บอทปิดการขาย',
    badge_color: 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20',
    features: ['ข้อความ AI 1,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 100 ครั้ง/เดือน', 'บันทึกสลิปผ่าน LINE เข้าแดชบอร์ดร้าน', 'Response caching สำหรับคำถามซ้ำ', 'รับออเดอร์ ส่ง QR และติดตามการชำระเงิน', 'ใบเสนอราคาและส่วนลด'],
  },
  {
    key: 'byok',
    name: 'BYOK',
    price: 790,
    messages: -1,
    tokens: -1,
    slips: 300,
    description: 'ใช้ Gemini API Key ของร้านเอง ค่า AI จ่ายตรงกับ Google',
    badge_color: 'bg-success-green/10 text-success-green border border-success-green/20',
    features: ['ข้อความ AI ไม่จำกัด (ใช้ API Key ของร้าน)', 'ตรวจสลิปอัตโนมัติ 300 ครั้ง/เดือน', 'ฟีเจอร์ Pro ทั้งหมด', 'บันทึกสลิปผ่าน LINE เข้าแดชบอร์ดร้าน', 'แจ้งลูกค้าเมื่อสินค้ากลับมา (back-in-stock)', 'Response caching สำหรับคำถามซ้ำ'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 1690,
    messages: 3000,
    tokens: 15000000,
    slips: 300,
    description: 'สำหรับร้านที่มีแชทหนาแน่นและระบบจองคิว',
    badge_color: 'bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold',
    features: ['ข้อความ AI 3,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 300 ครั้ง/เดือน', 'ฟีเจอร์ Starter ทั้งหมด', 'ระบบจองคิวและแจ้งเตือนลูกค้า', 'บันทึกสลิปผ่าน LINE เข้าแดชบอร์ดร้าน', 'แจ้งลูกค้าเมื่อสินค้ากลับมา (back-in-stock)', 'Response caching สำหรับคำถามซ้ำ'],
  },
  {
    key: 'agency',
    name: 'Business',
    price: 4490,
    messages: 8000,
    tokens: 50000000,
    slips: 1000,
    description: 'สำหรับแบรนด์หรือร้านหลายช่องทางที่มียอดแชทสูง',
    badge_color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold',
    features: ['ข้อความ AI 8,000 ข้อความ/เดือน', 'ตรวจสลิปอัตโนมัติ 1,000 ครั้ง/เดือน', 'ฟีเจอร์ Pro ทั้งหมด', 'ซัพพอร์ตแบบเร่งด่วน', 'บันทึกสลิปผ่าน LINE เข้าแดชบอร์ดร้าน', 'แจ้งลูกค้าเมื่อสินค้ากลับมา (back-in-stock)', 'Response caching สำหรับคำถามซ้ำ'],
  },
]

export function mapPlanRowToItem(item: any): PlanItem {
  return {
    id: item.id,
    key: item.key,
    name: item.name,
    price: Number(item.price || 0),
    messages: Number(item.messages || 0),
    tokens: Number(item.tokens || 0),
    slips: Number(item.slips ?? 0),
    description: item.description || '',
    badge_color: item.badge_color || 'bg-surface-container-high text-on-surface',
    features: Array.isArray(item.features) ? item.features : [],
    stripe_price_id: item.stripe_price_id || '',
  }
}

