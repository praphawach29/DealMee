import { Scenario, PackageTier, AddonPack, FeatureRow } from './types'

export const scenarios: Scenario[] = [
  {
    key: 'search',
    label: '🔍 ค้นหาสินค้า',
    subtitle: 'การ์ดสินค้าไปกับข้อความที่บอทค้นเจอในแคตตาล็อก บน LINE เป็น Flex บน Facebook และ Instagram เป็นการ์ด Messenger',
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
        text: 'เจอในแคตตาล็อกของร้านค่ะ ส่งการ์ดสินค้าให้ดูราคาและจำนวนที่ร้านใส่ไว้',
        time: '14:20',
        flexType: 'product_carousel',
        flexData: {
          title: 'สินค้าในร้าน (ตัวอย่าง)',
          price: 'ราคาตามที่ร้านตั้ง',
          stock: 'สต็อกในระบบ',
          desc: 'รูป ราคา และจำนวนมาจากรายการสินค้าของร้าน ปุ่มบนการ์ดจริงส่งข้อความสั่งซื้อชื่อสินค้านั้น',
        },
      },
    ],
  },
  {
    key: 'order',
    label: '🛒 สั่งซื้อและคิดค่าส่ง',
    subtitle: 'บอทถามชื่อ เบอร์ และที่อยู่ให้ครบก่อนบันทึก แล้วส่งสรุปเป็นข้อความ ตามด้วยรูป QR ถ้าในร้านมีพร้อมเพย์',
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
        text: 'ได้ค่ะ ถ้าในร้านมีโปรที่เปิดอยู่ จะบอกโปรนั้นในข้อความนี้\nขอชื่อ เบอร์โทร และที่อยู่จัดส่งให้ครบก่อนบันทึกออเดอร์นะคะ\nสะดวกชำระแบบโอน หรือเก็บเงินปลายทางคะ',
        time: '14:23',
      },
      {
        type: 'user',
        text: 'ชื่อและเบอร์ตามที่แจ้งในแชท ที่อยู่ต่างจังหวัด โอนเงินครับ',
        time: '14:24',
      },
      {
        type: 'bot',
        text: 'สร้างออเดอร์แล้วค่ะ เลขที่ขึ้นต้นด้วย ORD-\nสรุปในข้อความนี้คือรายการ ยอดรวม ชื่อผู้รับ เบอร์ ที่อยู่ และวิธีชำระ\nพร้อมเลขพร้อมเพย์หรือบัญชีธนาคารที่ร้านตั้งไว้\nค่าส่งใช้เรตโซนต่างจังหวัดของร้าน',
        time: '14:24',
      },
      {
        type: 'bot',
        text: 'ถ้าในร้านตั้งพร้อมเพย์ไว้ ระบบส่งรูป QR อีกข้อความหนึ่ง ยอดในรูปคือยอดออเดอร์ที่บันทึกไว้\nถ้ายังไม่ได้ตั้งพร้อมเพย์ จะไม่มีรูปนี้',
        time: '14:24',
        flexType: 'payment_qr',
      },
    ],
  },
  {
    key: 'slip',
    label: '🧾 ตรวจสลิป',
    subtitle: 'ใช้เมื่อแพ็กเกจเปิดตรวจสลิปอัตโนมัติ และแชทนี้มีออเดอร์ที่รอชำระอยู่',
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
        text: 'ได้รับรูปแล้วค่ะ กำลังตรวจกับผู้ให้บริการตรวจสลิป',
        time: '14:28',
      },
      {
        type: 'bot',
        text: 'ถ้ายอดตรงออเดอร์ที่รอชำระ ผู้รับตรงบัญชีร้าน และสลิปนี้ยังไม่เคยใช้ ระบบเปลี่ยนสถานะเป็นชำระแล้ว\nถ้าอ่านสลิปไม่ได้ จะให้ส่งรูปใหม่ ยังไม่ยืนยันเอง\nแพ็กเกจฟรีส่งให้แอดมินตรวจแทน ไม่ได้ตรวจอัตโนมัติ',
        time: '14:29',
      },
    ],
  },
  {
    key: 'quotation',
    label: '📄 ใบเสนอราคา',
    subtitle: 'ราคาดึงจากแคตตาล็อก VAT 7% ถูกบวกเฉพาะร้านที่เปิดไว้ การ์ดมีปุ่มเปิดเอกสาร ดาวน์โหลด Word และลิงก์ Excel',
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
        text: 'ออกจากรายการในแคตตาล็อกให้แล้วค่ะ ส่งเป็นการ์ดในแชท\nถ้าในร้านเปิด VAT ยอดจะบวก 7% ถ้าไม่ได้เปิด จะไม่บวก VAT',
        time: '10:15',
        flexType: 'quotation',
        flexData: {
          docNo: 'QT- เลขที่เอกสาร',
          customer: 'ชื่อที่คุยในแชท',
          items: 'รายการจากแคตตาล็อก',
          total: 'ยอดในเอกสาร',
          vatNote: 'บวก VAT 7% เฉพาะร้านที่เปิดไว้',
        },
      },
    ],
  },
  {
    key: 'booking',
    label: '📅 จองคิว',
    subtitle: 'เมื่อร้านเปิดระบบจอง บอทเช็ครอบที่ร้านตั้งไว้ก่อน แล้วบันทึกเมื่อมีวัน เวลา ชื่อ และเบอร์',
    botName: 'บอทของร้าน',
    botEmoji: '🗓️',
    messages: [
      {
        type: 'user',
        text: 'พรุ่งนี้ช่วงบ่าย มีคิวว่างไหมครับ',
        time: '11:02',
      },
      {
        type: 'bot',
        text: 'ขอเช็ครอบที่ร้านเปิดไว้ก่อนนะคะ ต้องการกี่คนคะ',
        time: '11:02',
      },
      {
        type: 'user',
        text: '1 คนครับ',
        time: '11:03',
      },
      {
        type: 'bot',
        text: 'รอบบ่ายที่ตรงกับเวลาที่ร้านตั้งไว้ยังว่างอยู่ ขอชื่อและเบอร์โทรเพื่อบันทึกการจองค่ะ',
        time: '11:03',
      },
      {
        type: 'user',
        text: 'ใช้ชื่อกับเบอร์ที่แจ้งในแชทนี้ครับ',
        time: '11:04',
      },
      {
        type: 'bot',
        text: 'บันทึกการจองแล้วค่ะ เลขที่ขึ้นต้นด้วย BK-\nวัน เวลา และจำนวนคนเป็นตามรอบที่ร้านเปิดไว้',
        time: '11:04',
      },
    ],
  },
  {
    key: 'memory',
    label: '🧠 จำลูกค้าคนเดิม',
    subtitle: 'บอทเห็นออเดอร์ของแชทนี้ และบันทึกโน้ตไว้ใช้ตอนตอบครั้งถัดไป',
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
        text: 'แชทนี้มีออเดอร์ก่อนหน้าในระบบ ต้องการสั่งรายการเดิมไหมคะ',
        time: '19:40',
      },
      {
        type: 'user',
        text: 'จดไว้ด้วยว่าต้องการแบบไม่มีน้ำหอม',
        time: '19:41',
      },
      {
        type: 'bot',
        text: 'บันทึกไว้ในโปรไฟล์ลูกค้าของแชทนี้แล้ว ครั้งถัดไปบอทจะเห็นบันทึกนี้ตอนตอบค่ะ',
        time: '19:41',
      },
    ],
  },
  {
    key: 'handoff',
    label: '🆘 ส่งต่อแอดมิน',
    subtitle: 'พิมพ์ว่า ขอคุยกับแอดมิน แล้วบอทหยุดตอบในแชทนี้ 1 ชั่วโมง แอดมินตอบต่อจากกล่องข้อความ',
    botName: 'บอทของร้าน',
    botEmoji: '🛎️',
    messages: [
      {
        type: 'user',
        text: 'ขอคุยกับแอดมิน',
        time: '16:05',
      },
      {
        type: 'bot',
        text: 'รับเรื่องเรียบร้อยแล้วค่ะ บอทหยุดตอบในแชทนี้ 1 ชั่วโมง\nแอดมินดูแลต่อจากกล่องข้อความได้เลย',
        time: '16:05',
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
