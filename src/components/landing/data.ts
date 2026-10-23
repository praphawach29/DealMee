import { Scenario, PackageTier, AddonPack, FeatureRow } from './types'

export const scenarios: Scenario[] = [
  {
    key: 'search',
    label: '🔍 ค้นหาสินค้า',
    subtitle: 'บอทเรียก search_products แล้วส่งการ์ดสินค้าจากแคตตาล็อกของร้าน',
    botName: 'บอทของร้าน',
    botEmoji: '🤖',
    messages: [
      {
        type: 'user',
        text: 'มีเสื้อตัวนี้ไหมครับ',
        time: '14:20',
      },
      {
        type: 'bot',
        tool: 'search_products',
        text: 'ค้นในแคตตาล็อกของร้านแล้ว พบรายการที่ตรงกับที่ถาม ส่งการ์ดสินค้าให้ดูต่อได้เลยครับ',
        time: '14:20',
        options: ['ดูการ์ดสินค้า', 'ถามอย่างอื่น'],
      },
      {
        type: 'user',
        text: 'ดูการ์ดสินค้า',
        time: '14:21',
      },
      {
        type: 'bot',
        tool: 'check_stock',
        text: 'รายการนี้อยู่ในแคตตาล็อก ราคาและจำนวนคงเหลือเป็นค่าที่ร้านใส่ไว้ในหน้ารายการสินค้า',
        time: '14:21',
        flexType: 'product_carousel',
        flexData: {
          title: 'สินค้าในร้าน (ตัวอย่าง)',
          price: 'ราคาตามที่ร้านตั้ง',
          stock: 'สต็อกในระบบ',
          desc: 'การ์ดนี้คือรูปแบบ LINE Flex ที่บอทส่งเมื่อค้นสินค้า รูป ราคา และสต็อกมาจากแคตตาล็อกของร้าน',
          tag: 'ตัวอย่าง',
        },
        options: ['สั่งซื้อเลย', 'ถามค่าจัดส่ง', 'ขอใบเสนอราคา'],
      },
    ],
  },
  {
    key: 'order',
    label: '🛒 สั่งซื้อและคิดค่าส่ง',
    subtitle: 'บอทดูโปรที่ร้านเปิดไว้ คิดค่าส่งตามโซน แล้วบันทึกออเดอร์พร้อม QR พร้อมเพย์',
    botName: 'บอทของร้าน',
    botEmoji: '🛍️',
    messages: [
      {
        type: 'user',
        text: 'สั่งสินค้านี้ 1 ชิ้น ส่งต่างจังหวัดครับ',
        time: '14:23',
      },
      {
        type: 'bot',
        tool: 'get_active_promotions',
        text: 'ถ้าในร้านมีโปรที่เปิดอยู่ บอทจะดึงมาเสนอตรงนี้ ต้องการรับตามโปรที่ร้านตั้งไว้ไหมครับ',
        time: '14:23',
        options: ['รับตามโปรของร้าน', 'รับเฉพาะสินค้า'],
      },
      {
        type: 'user',
        text: 'รับเฉพาะสินค้า',
        time: '14:24',
      },
      {
        type: 'bot',
        tool: 'calculate_shipping',
        text: 'ปลายทางอยู่ในโซนต่างจังหวัด ค่าส่งใช้เรตที่ร้านตั้งไว้ในหน้าตั้งค่า สะดวกชำระแบบไหนครับ',
        time: '14:24',
        options: ['โอนเงิน / PromptPay', 'เก็บเงินปลายทาง (COD)'],
      },
      {
        type: 'user',
        text: 'โอนเงิน / PromptPay',
        time: '14:25',
      },
      {
        type: 'bot',
        tool: 'take_order',
        text: 'สร้างออเดอร์ในระบบแล้ว เลขที่ขึ้นต้นด้วย ORD-\nยอดรวมคือราคาสินค้าบวกค่าส่งตามโซน\nส่ง QR PromptPay ของร้านให้ในแชท\nเมื่อโอนแล้ว ส่งรูปสลิปกลับมาได้เลยครับ',
        time: '14:25',
      },
    ],
  },
  {
    key: 'slip',
    label: '🧾 ตรวจสลิป',
    subtitle: 'ลูกค้าส่งรูปสลิปในแชท ระบบตรวจกับผู้ให้บริการตรวจสลิป แล้วยืนยันหรือส่งให้แอดมิน',
    botName: 'บอทของร้าน',
    botEmoji: '💳',
    messages: [
      {
        type: 'user',
        text: '[ส่งรูปสลิปในแชท]',
        time: '14:28',
      },
      {
        type: 'bot',
        text: 'ได้รับรูปแล้วครับ กำลังตรวจกับผู้ให้บริการตรวจสลิป',
        time: '14:28',
      },
      {
        type: 'bot',
        text: 'ถ้าตรวจผ่าน ระบบเช็คสามอย่าง\n• ยอดตรงกับออเดอร์\n• ผู้รับตรงกับบัญชีร้าน\n• สลิปนี้ยังไม่เคยใช้กับออเดอร์อื่น\nแล้วเปลี่ยนสถานะเป็นชำระแล้ว\nถ้าตรวจไม่ผ่านหรือตรวจไม่ได้ จะไม่ยืนยันเอง แต่ส่งให้แอดมินดูต่อ',
        time: '14:29',
        options: ['เช็คสถานะออเดอร์'],
      },
    ],
  },
  {
    key: 'quotation',
    label: '📄 ใบเสนอราคา',
    subtitle: 'บอทสร้างใบเสนอราคา คิด VAT 7% แล้วส่งเป็นการ์ดในแชทพร้อมลิงก์เอกสาร',
    botName: 'บอทของร้าน',
    botEmoji: '🏢',
    messages: [
      {
        type: 'user',
        text: 'ขอใบเสนอราคาสินค้านี้ครับ',
        time: '10:15',
      },
      {
        type: 'bot',
        text: 'รับเรื่องครับ บอทใช้รายการในแคตตาล็อกกับข้อมูลผู้รับที่คุยกันในแชท',
        time: '10:15',
        options: ['ออกใบเสนอราคา'],
      },
      {
        type: 'user',
        text: 'ออกใบเสนอราคา',
        time: '10:16',
      },
      {
        type: 'bot',
        tool: 'create_quotation',
        text: 'ออกใบเสนอราคาแล้ว ส่งเป็นการ์ดในแชท มีปุ่มเปิดเอกสารและดาวน์โหลด PDF',
        time: '10:16',
        flexType: 'quotation',
        flexData: {
          docNo: 'เลขที่เอกสาร',
          company: 'ชื่อลูกค้าในแชท',
          items: 'รายการจากแคตตาล็อก',
          subtotal: 'ยอดสินค้า',
          vat: 'VAT 7%',
          total: 'ยอดในเอกสาร',
          validDays: 'ตามที่ออกในเอกสาร',
        },
        options: ['เปิดดูเอกสาร'],
      },
    ],
  },
  {
    key: 'memory',
    label: '🧠 จำลูกค้าคนเดิม',
    subtitle: 'บอทเห็นประวัติออเดอร์ของแชทนี้ และบันทึกโน้ตไว้ใช้ตอนตอบครั้งถัดไป',
    botName: 'บอทของร้าน',
    botEmoji: '✨',
    messages: [
      {
        type: 'user',
        text: 'ขอสั่งสินค้าเดิมที่เคยซื้อ',
        time: '19:40',
      },
      {
        type: 'bot',
        tool: 'get_customer_history',
        text: 'แชทนี้มีออเดอร์ก่อนหน้าในระบบ ต้องการสั่งรายการเดิมไหมครับ',
        time: '19:40',
        options: ['สั่งรายการเดิม', 'ขอดูสินค้าอื่น'],
      },
      {
        type: 'user',
        text: 'จดไว้ด้วยว่าต้องการแบบไม่มีน้ำหอม',
        time: '19:41',
      },
      {
        type: 'bot',
        tool: 'update_customer_note',
        text: 'บันทึกไว้ในโปรไฟล์ลูกค้าของแชทนี้แล้ว ครั้งถัดไปบอทจะเห็นบันทึกนี้ตอนตอบ',
        time: '19:41',
      },
    ],
  },
  {
    key: 'handoff',
    label: '🆘 ส่งต่อแอดมิน',
    subtitle: 'เมื่อลูกค้าขอคุยกับคน บอทแจ้งแอดมินทาง LINE แล้วหยุดตอบในแชทนั้นชั่วคราว',
    botName: 'บอทของร้าน',
    botEmoji: '🛎️',
    messages: [
      {
        type: 'user',
        text: 'สินค้ามีปัญหา ขอคุยกับคนครับ',
        time: '16:05',
      },
      {
        type: 'bot',
        text: 'รับเรื่องครับ เดี๋ยวส่งให้แอดมินดูแลต่อในแชทนี้',
        time: '16:05',
      },
      {
        type: 'bot',
        tool: 'request_human_agent',
        text: 'แจ้งแอดมินทาง LINE แล้ว\nบอทหยุดตอบในแชทนี้ชั่วคราว\nแอดมินตอบต่อได้จากกล่องข้อความ',
        time: '16:06',
      },
    ],
  },
]

/** DealMee's own LINE OA (also the platform alert OA). Premium ID @dealmee (basic ID @238qsjdw still works). */
export const DEALMEE_LINE_OA = { id: '@dealmee', url: 'https://line.me/R/ti/p/@dealmee' }

// Keep in sync with the `plans` and `addon_packs` tables (wallet billing migration)
export const freePlan = { price: 0, msgLimit: 100 }

export const packagesData: PackageTier[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: 590,
    msgLimit: 1000,
    slipLimit: 100,
    description: 'สำหรับร้านเล็กที่เริ่มให้บอทปิดการขาย',
    badge: 'สำหรับร้านเริ่มต้น',
    features: {
      order_taking: true,
      quotation_b2b: true,
      booking_system: false,
      own_api_key: false,
      priority_support: false,
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 1690,
    msgLimit: 3000,
    slipLimit: 300,
    description: 'สำหรับร้านที่มีแชทหนาแน่นและระบบจองคิว',
    featured: true,
    badge: '⭐ แนะนำ',
    features: {
      order_taking: true,
      quotation_b2b: true,
      booking_system: true,
      own_api_key: false,
      priority_support: false,
    },
  },
  {
    key: 'agency',
    name: 'Business',
    price: 4490,
    msgLimit: 8000,
    slipLimit: 1000,
    description: 'สำหรับแบรนด์หรือร้านหลายช่องทางที่มียอดแชทสูง',
    badge: 'สำหรับธุรกิจที่เติบโต',
    features: {
      order_taking: true,
      quotation_b2b: true,
      booking_system: true,
      own_api_key: false,
      priority_support: true,
    },
  },
  {
    key: 'byok',
    name: 'BYOK',
    price: 790,
    msgLimit: -1,
    slipLimit: 300,
    description: 'ใช้ Gemini API Key ของร้านเอง ค่า AI จ่ายตรงกับ Google',
    badge: 'ใช้ API Key ของร้าน',
    features: {
      order_taking: true,
      quotation_b2b: true,
      booking_system: true,
      own_api_key: true,
      priority_support: false,
    },
  },
]

// Add-on packs last 90 days and are used after the plan's monthly allowance runs out
export const addonPacks: AddonPack[] = [
  { kind: 'messages', quantity: 500, price: 390 },
  { kind: 'messages', quantity: 1500, price: 990 },
  { kind: 'messages', quantity: 5000, price: 2990 },
  { kind: 'slips', quantity: 100, price: 89 },
  { kind: 'slips', quantity: 300, price: 219 },
  { kind: 'slips', quantity: 1000, price: 590 },
]

export const comparisonRows: FeatureRow[] = [
  // พื้นฐานและการแชท
  {
    category: 'ความสามารถพื้นฐาน & AI',
    label: 'ข้อความ AI ต่อเดือน',
    description: 'จำนวนข้อความที่ AI วิเคราะห์และตอบกลับลูกค้าบน LINE OA',
    starter: '1,000 ข้อความ',
    pro: '3,000 ข้อความ',
    agency: '8,000 ข้อความ',
    byok: 'ไม่จำกัด*',
  },
  {
    category: 'ความสามารถพื้นฐาน & AI',
    label: 'Gemini API Key ของร้านเอง',
    description: '*BYOK ใช้ Key ของร้าน ค่า AI จ่ายตรงกับ Google ตามการใช้งานจริง',
    starter: false,
    pro: false,
    agency: false,
    byok: true,
  },
  {
    category: 'ความสามารถพื้นฐาน & AI',
    label: 'LINE Flex Message & Carousel',
    description: 'ส่งการ์ดสินค้าพร้อมรูปภาพ ราคา และปุ่มกดบน LINE',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },

  // งานขายและการชำระเงิน
  {
    category: 'ระบบการขาย & การเงิน',
    label: 'ปิดการขาย & รับออเดอร์อัตโนมัติ',
    description: 'ถามชื่อ ที่อยู่ เบอร์โทร คำนวณค่าส่ง และสร้างเลขออเดอร์',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
  {
    category: 'ระบบการขาย & การเงิน',
    label: 'PromptPay QR ระบุยอดเงินอัตโนมัติ',
    description: 'สร้างรูปภาพ QR พร้อมเพย์ตรงยอด ให้ลูกค้าสแกนได้ทันที',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
  {
    category: 'ระบบการขาย & การเงิน',
    label: 'ตรวจสลิปโอนเงินอัตโนมัติ ต่อเดือน',
    description: 'ตรวจสอบสลิปกับระบบธนาคาร ป้องกันสลิปปลอม/สลิปซ้ำ เกินโควตาส่งให้แอดมินตรวจเอง',
    starter: '100 ครั้ง',
    pro: '300 ครั้ง',
    agency: '1,000 ครั้ง',
    byok: '300 ครั้ง',
  },
  {
    category: 'ระบบการขาย & การเงิน',
    label: 'ออกใบเสนอราคา B2B (PDF Link)',
    description: 'สร้างใบเสนอราคาพร้อมลิงก์ PDF และคำนวณ VAT 7%',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },

  // ความฉลาดและความสัมพันธ์ลูกค้า
  {
    category: 'ระบบฐานข้อมูล & ลูกค้าสัมพันธ์',
    label: 'โปรไฟล์ลูกค้า',
    description: 'จำชื่อ บันทึก แท็ก จำนวนออเดอร์ และยอดซื้อสะสมของแชทนั้น แล้วนำมาใช้ตอนตอบครั้งถัดไป',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
  {
    category: 'ระบบฐานข้อมูล & ลูกค้าสัมพันธ์',
    label: 'ระบบจองคิว & แจ้งเตือนลูกค้า',
    description: 'เช็คเวลาว่าง จอง เลื่อน ยกเลิก และแจ้งเตือนก่อนเวลานัด',
    starter: false,
    pro: true,
    agency: true,
    byok: true,
  },

  // แพ็กเสริมและการซัพพอร์ต
  {
    category: 'แพ็กเสริม & การซัพพอร์ต',
    label: 'ซื้อแพ็กเสริมข้อความ / ตรวจสลิป',
    description: 'ใช้ได้ 90 วัน ตัดใช้เมื่อโควตาประจำเดือนหมด',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
  {
    category: 'แพ็กเสริม & การซัพพอร์ต',
    label: 'ช่องทางการดูแล & ซัพพอร์ต',
    description: 'ระดับการบริการและการช่วยเหลือในการติดตั้ง',
    starter: 'LINE Support',
    pro: 'LINE Support',
    agency: 'ซัพพอร์ตเร่งด่วน',
    byok: 'LINE Support',
  },
]

export const faqs = [
  {
    q: 'ต้องมีความรู้ด้านไอทีหรือเขียนโปรแกรมไหมในการติดตั้ง?',
    a: 'ไม่ต้องเลยครับ! คุณเพียงแค่มี LINE Official Account ของร้านค้า และนำ Token มากรอกในระบบ DealMee AI ระบบจะพร้อมทำงานและตอบลูกค้าได้ภายใน 5 นาที ในหน้าตั้งค่ามีขั้นตอนแนะนำทีละข้อ และทักทีมงานทาง LINE ให้ช่วยได้',
  },
  {
    q: 'บอทเชื่อมต่อกับ LINE Official Account เดิมที่มีลูกค้าอยู่แล้วได้ไหม?',
    a: 'สามารถเชื่อมต่อได้ทันทีครับ โดยประวัติแชทและเพื่อนเดิมใน LINE OA จะยังคงอยู่ครบถ้วน บอทจะเข้ามาช่วยตอบข้อความใหม่ที่ลูกค้าทักเข้ามาโดยไม่รบกวนข้อมูลเดิม',
  },
  {
    q: 'ระบบตรวจสลิปโอนเงินทำงานอย่างไร มีโอกาสผิดพลาดไหม?',
    a: 'ระบบอ่าน QR Code บนสลิปแล้วตรวจกับผู้ให้บริการตรวจสลิปที่เชื่อมกับข้อมูลธนาคาร เช็คว่ายอดตรงกับออเดอร์ โอนเข้าบัญชีของร้านจริง และสลิปนี้ไม่เคยใช้กับออเดอร์อื่น ถ้าตรวจไม่ผ่านหรือตรวจไม่ได้ ระบบจะไม่ยืนยันเอง แต่ส่งให้แอดมินตรวจต่อ',
  },
  {
    q: 'ถ้าลูกค้าถามคำถามยากๆ หรือขอคุยกับคน บอทจะทำอย่างไร?',
    a: 'บอทมีฟังก์ชัน Smart Human Handover เมื่อลูกค้าต้องการคุยกับเจ้าหน้าที่ หรือถามเรื่องร้องเรียน บอทจะแจ้งเตือนทีมงาน และจะหยุดตอบอัตโนมัติ (Auto-pause) ในแชทนั้นทันที เพื่อให้แอดมินคนจริงเข้ามาคุยต่อได้อย่างไร้รอยต่อ',
  },
  {
    q: 'สามารถเปลี่ยนหรือยกเลิกแพ็กเกจภายหลังได้หรือไม่?',
    a: 'เปลี่ยนแพ็กเกจได้ตลอดเวลา ไม่มีสัญญาผูกมัด ค่าแพ็กเกจตัดจากกระเป๋าเงิน (Wallet) ที่เติมผ่าน PromptPay และเมื่อเปลี่ยนแพ็กเกจ ระบบคืนเครดิตตามวันที่เหลือเข้ากระเป๋าเงินให้อัตโนมัติ จัดการได้เองผ่านหน้าแดชบอร์ดของร้านค้า',
  },
]
