/**
 * Fixture shops for the sales-agent eval. They exist only under tests/eval
 * and are never written to the product database.
 */

export interface FixtureProduct {
  id: string
  name: string
  price: number
  stock: number
  category: string
  description: string
  sku: string
  /** Substrings a customer might use for this product. */
  aliases: string[]
}

export interface FixtureChunk {
  id: string
  section: string
  content: string
}

export interface FixtureService {
  name: string
  durationMinutes: number
  start: string
  end: string
  slots: string[]
  deposit: number
}

export interface FixturePromotion {
  name: string
  description: string
  discountType: 'percent' | 'amount' | 'bundle'
  discountValue: number
}

export interface FixtureShop {
  id: 'fashion' | 'beauty' | 'cafe' | 'qa'
  shopId: string
  name: string
  qaOnly: boolean
  codEnabled: boolean
  booking: boolean
  products: FixtureProduct[]
  chunks: FixtureChunk[]
  services: FixtureService[]
  promotions: FixturePromotion[]
  /** What the shop actually accepts. */
  paymentMethods: string[]
  shop: Record<string, unknown>
}

const FASHION_ID = '11111111-1111-4111-8111-111111111111'
const BEAUTY_ID = '22222222-2222-4222-8222-222222222222'
const CAFE_ID = '33333333-3333-4333-8333-333333333333'
const QA_ID = '44444444-4444-4444-8444-444444444444'

function retailShop(input: {
  id: string
  name: string
  cod: boolean
  promptpay: string
  bank: string
  booking: boolean
  qaOnly: boolean
  businessType: string
  shipping: Record<string, unknown>
  extraFeatures?: Record<string, unknown>
}): Record<string, unknown> {
  return {
    id: input.id,
    name: input.name,
    bot_name: 'น้องดีลมี',
    personality: 'สุภาพ เป็นกันเอง ตอบสั้น',
    description: input.name,
    business_type: input.businessType,
    plan_key: 'pro',
    plan: 'pro',
    cod_enabled: input.cod,
    promptpay_id: input.promptpay,
    promptpay_name: input.name,
    bank_name: 'กสิกรไทย',
    bank_account_number: input.bank,
    bank_account_name: input.name,
    features: {
      assistant_qa_only: input.qaOnly,
      booking_system: input.booking,
      product_recommend: !input.qaOnly,
      shop_skills_enabled: input.qaOnly,
      high_value_threshold: 10000,
      ...input.extraFeatures,
    },
    ...input.shipping,
  }
}

export const SHOPS: FixtureShop[] = [
  {
    id: 'fashion',
    shopId: FASHION_ID,
    name: 'บ้านผ้าลาย',
    qaOnly: false,
    codEnabled: true,
    booking: false,
    paymentMethods: ['พร้อมเพย์', 'โอนธนาคาร', 'เก็บเงินปลายทาง'],
    products: [
      {
        id: 'p-shirt',
        name: 'เสื้อยืดโอเวอร์ไซส์',
        price: 290,
        stock: 12,
        category: 'เสื้อผ้า',
        description: 'ผ้าคอตตอน สีขาว ดำ กรม',
        sku: 'FASH-101',
        aliases: ['เสื้อยืด', 'โอเวอร์ไซส์'],
      },
      {
        id: 'p-shorts',
        name: 'กางเกงขาสั้นลินิน',
        price: 450,
        stock: 0,
        category: 'เสื้อผ้า',
        description: 'ลินิน สีเบจ',
        sku: 'FASH-220',
        aliases: ['กางเกงขาสั้น', 'ลินิน'],
      },
      {
        id: 'p-scarf',
        name: 'ผ้าพันคอไหม',
        price: 890,
        stock: 3,
        category: 'เครื่องประดับ',
        description: 'ไหมทอมือ',
        sku: 'FASH-330',
        aliases: ['ผ้าพันคอ', 'ไหม'],
      },
    ],
    chunks: [
      {
        id: 'a1111111-1111-4111-8111-111111111111',
        section: 'shipping-policy',
        content: 'ส่งฟรีเมื่อซื้อครบ 1000 บาท ต่ำกว่านั้นคิดตามเขต ค่าส่งกรุงเทพ 40 บาท ต่างจังหวัด 60 บาท พื้นที่ห่างไกล 120 บาท',
      },
      {
        id: 'a1111111-1111-4111-8111-111111111112',
        section: 'returns',
        content: 'เปลี่ยนไซส์ได้ภายใน 7 วัน หากยังไม่ผ่านการใช้งานและมีป้ายครบ ไม่รับคืนเป็นเงินสด',
      },
      {
        id: 'a1111111-1111-4111-8111-111111111113',
        section: 'hours',
        content: 'เปิดทุกวัน 10:00-19:00 ไม่มีหน้าร้าน จัดส่งอย่างเดียว',
      },
    ],
    services: [],
    promotions: [
      {
        name: 'ผ้าพันคอซื้อ 2 แถม 1',
        description: 'ซื้อผ้าพันคอไหม 2 ผืน แถม 1 ผืน สินค้าเดียวกัน',
        discountType: 'bundle',
        discountValue: 0,
      },
    ],
    shop: retailShop({
      id: FASHION_ID,
      name: 'บ้านผ้าลาย',
      cod: true,
      promptpay: '0812345678',
      bank: '1234567890',
      booking: false,
      qaOnly: false,
      businessType: 'retail',
      shipping: {
        shipping_fee_type: 'zone',
        shipping_zone_bkk: 40,
        shipping_zone_upcountry: 60,
        shipping_zone_remote: 120,
        free_shipping_threshold: 1000,
      },
    }),
  },
  {
    id: 'beauty',
    shopId: BEAUTY_ID,
    name: 'สกินแคร์มีนา',
    qaOnly: false,
    codEnabled: false,
    booking: false,
    paymentMethods: ['พร้อมเพย์', 'โอนธนาคาร'],
    products: [
      {
        id: 'p-serum',
        name: 'เซรั่มวิตามินซี',
        price: 590,
        stock: 8,
        category: 'สกินแคร์',
        description: 'ขวด 30 มล.',
        sku: 'BEA-010',
        aliases: ['เซรั่ม', 'วิตามินซี'],
      },
      {
        id: 'p-sunscreen',
        name: 'ครีมกันแดด SPF50',
        price: 320,
        stock: 20,
        category: 'สกินแคร์',
        description: 'หลอด 40 มล. ไม่กันน้ำ',
        sku: 'BEA-050',
        aliases: ['กันแดด', 'ครีมกันแดด'],
      },
    ],
    chunks: [
      {
        id: 'b2222222-2222-4222-8222-222222222221',
        section: 'payment',
        content: 'ไม่รับเก็บเงินปลายทาง รับเฉพาะโอนธนาคารและพร้อมเพย์',
      },
      {
        id: 'b2222222-2222-4222-8222-222222222222',
        section: 'shipping',
        content: 'จัดส่ง Kerry ใช้เวลา 2-4 วัน ค่าส่ง 50 บาททุกเขต ไม่มีส่งฟรี',
      },
      {
        id: 'b2222222-2222-4222-8222-222222222223',
        section: 'claims',
        content: 'ไม่การันตีผลลัพธ์ภายใน 7 วัน หากแพ้ให้หยุดใช้และทักแชทนี้',
      },
    ],
    services: [],
    promotions: [],
    shop: retailShop({
      id: BEAUTY_ID,
      name: 'สกินแคร์มีนา',
      cod: false,
      promptpay: '0899990000',
      bank: '9988776655',
      booking: false,
      qaOnly: false,
      businessType: 'retail',
      shipping: {
        shipping_fee_type: 'flat',
        shipping_fee_amount: 50,
        free_shipping_threshold: 0,
      },
    }),
  },
  {
    id: 'cafe',
    shopId: CAFE_ID,
    name: 'คาเฟ่ริมน้ำ',
    qaOnly: false,
    codEnabled: false,
    booking: true,
    paymentMethods: ['พร้อมเพย์', 'โอนธนาคาร', 'จ่ายที่ร้าน'],
    products: [
      {
        id: 'p-drip',
        name: 'กาแฟดริปบ้าน',
        price: 90,
        stock: 40,
        category: 'เครื่องดื่ม',
        description: 'ถุง 250 กรัม',
        sku: 'CAF-001',
        aliases: ['กาแฟดริป', 'ดริป'],
      },
    ],
    chunks: [
      {
        id: 'c3333333-3333-4333-8333-333333333331',
        section: 'booking-policy',
        content: 'จองโต๊ะริมน้ำได้ รอบ 11:00 13:00 15:00 และ 17:00 มัดจำ 200 บาท ยกเลิกฟรีถ้าแจ้งก่อนอย่างน้อย 3 ชั่วโมง',
      },
      {
        id: 'c3333333-3333-4333-8333-333333333332',
        section: 'hours',
        content: 'เปิดทุกวัน 11:00-20:00 รับนั่งที่ร้าน ไม่มีเก็บเงินปลายทางสำหรับสินค้าจัดส่ง',
      },
    ],
    services: [
      {
        name: 'จองโต๊ะริมน้ำ',
        durationMinutes: 120,
        start: '11:00',
        end: '20:00',
        slots: ['11:00', '13:00', '15:00', '17:00'],
        deposit: 200,
      },
    ],
    promotions: [],
    shop: retailShop({
      id: CAFE_ID,
      name: 'คาเฟ่ริมน้ำ',
      cod: false,
      promptpay: '0861112233',
      bank: '4455667788',
      booking: true,
      qaOnly: false,
      businessType: 'service',
      shipping: {
        shipping_fee_type: 'flat',
        shipping_fee_amount: 40,
        free_shipping_threshold: 0,
      },
    }),
  },
  {
    id: 'qa',
    shopId: QA_ID,
    name: 'สำนักข้อมูลชุมชน',
    qaOnly: true,
    codEnabled: false,
    booking: false,
    paymentMethods: [],
    products: [],
    chunks: [
      {
        id: 'd4444444-4444-4444-8444-444444444441',
        section: 'hours',
        content: 'เปิดทำการจันทร์ถึงศุกร์ 08:30-16:30 หยุดเสาร์อาทิตย์และวันนักขัตฤกษ์',
      },
      {
        id: 'd4444444-4444-4444-8444-444444444442',
        section: 'certificate',
        content: 'ขอใบรับรองถิ่นที่อยู่ได้ที่เคาน์เตอร์ชั้น 1 ไม่มีค่าธรรมเนียม ใช้บัตรประชาชนตัวจริง',
      },
      {
        id: 'd4444444-4444-4444-8444-444444444443',
        section: 'complaints',
        content: 'ไม่รับเรื่องร้องเรียนทางแชท ให้ยื่นแบบฟอร์มที่สำนักในเวลาทำการ',
      },
    ],
    services: [],
    promotions: [],
    shop: retailShop({
      id: QA_ID,
      name: 'สำนักข้อมูลชุมชน',
      cod: false,
      promptpay: '',
      bank: '',
      booking: false,
      qaOnly: true,
      businessType: 'service',
      shipping: { shipping_fee_type: 'flat', shipping_fee_amount: 0, free_shipping_threshold: 0 },
    }),
  },
]

export function shopById(id: FixtureShop['id']): FixtureShop {
  const shop = SHOPS.find((item) => item.id === id)
  if (!shop) throw new Error(`Unknown fixture shop ${id}`)
  return shop
}
