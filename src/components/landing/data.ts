import { Scenario, PackageTier, AddonPack, FeatureRow } from './types'

export const scenarios: Scenario[] = [
  {
    key: 'search',
    label: '🔍 ค้นหาสินค้า & สต็อก',
    subtitle: 'AI ตรวจสอบแคตตาล็อกและสต็อกสินค้าจากฐานข้อมูลแบบ Real-time พร้อมส่ง LINE Flex Carousel',
    botName: 'น้อง DealMee — TechShop',
    botEmoji: '🤖',
    messages: [
      {
        type: 'user',
        text: 'มีปริ้นเตอร์ EPSON รุ่นไหนบ้างครับ งบไม่เกิน 20,000 บาท',
        time: '14:20',
      },
      {
        type: 'bot',
        tool: 'search_products',
        text: `เช็คให้แล้วครับ พบ 3 รุ่นที่ตรงกับงบของคุณ 👇\n\n1️⃣ EPSON LQ-310 — ฿7,990\n2️⃣ EPSON LQ-590II — ฿18,500\n3️⃣ EPSON L3250 — ฿4,990\n\nสนใจดูรายละเอียดรุ่นไหนเป็นพิเศษครับ?`,
        time: '14:20',
        options: ['EPSON LQ-590II', 'EPSON LQ-310', 'EPSON L3250'],
      },
      {
        type: 'user',
        text: 'EPSON LQ-590II',
        time: '14:21',
      },
      {
        type: 'bot',
        tool: 'check_stock',
        text: `✅ EPSON LQ-590II (ดอทเมทริกซ์ 24 เข็ม)\n• คงเหลือ: 4 เครื่อง พร้อมส่งทันที\n• รับประกันศูนย์ EPSON ประเทศไทย 2 ปี\n• ราคาพิเศษ: ฿18,500`,
        time: '14:21',
        flexType: 'product_carousel',
        flexData: {
          title: 'EPSON LQ-590II Dot Matrix',
          price: '฿18,500',
          stock: 'มีสต็อก 4 เครื่อง',
          desc: 'ดอทเมทริกซ์ 24 เข็ม พิมพ์เร็ว ทนทาน รองรับงานพิมพ์ภาษี/ใบเสร็จหน้าร้าน',
          tag: 'รับประกัน 2 ปี',
        },
        options: ['สั่งซื้อเลย', 'สอบถามค่าจัดส่ง', 'ขอใบเสนอราคา'],
      },
    ],
  },
  {
    key: 'order',
    label: '🛒 สั่งซื้อ & คิดค่าส่ง',
    subtitle: 'AI ดึงโปรโมชั่น คำนวณค่าส่งตามพื้นที่จริง (กทม./ตจว.) และออกเลขออเดอร์พร้อมช่องทางชำระ',
    botName: 'น้อง DealMee — TechShop',
    botEmoji: '🛍️',
    messages: [
      {
        type: 'user',
        text: 'สั่งซื้อ LQ-590II 1 เครื่องครับ จัดส่งที่ จ.เชียงใหม่',
        time: '14:23',
      },
      {
        type: 'bot',
        tool: 'get_active_promotions',
        text: `🎉 พบโปรโมชั่นเซ็ตพิเศษ!\n• ซื้อเครื่องพร้อมตลับหมึกสำรอง ลด 5% ทั้งเซ็ต\n\nต้องการรับตลับหมึกสำรองเพิ่มเลยไหมครับ?`,
        time: '14:23',
        options: ['เพิ่มหมึกสำรอง (+฿450)', 'รับเฉพาะเครื่องปริ้นเตอร์'],
      },
      {
        type: 'user',
        text: 'เพิ่มหมึกสำรอง (+฿450)',
        time: '14:24',
      },
      {
        type: 'bot',
        tool: 'calculate_shipping',
        text: `📍 ปลายทาง: เชียงใหม่ (ต่างจังหวัด)\n🚚 ค่าจัดส่งด่วน Kerry Express: ฿120\n(ซื้อครบ 15,000 รับส่วนลดค่าส่งพิเศษ 50% เหลือ ฿60)\n\nสะดวกชำระเงินแบบใดดีครับ?`,
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
        text: `✅ สร้างออเดอร์สำเร็จเรียบร้อยครับ!\n────────────────\n🆔 เลขที่: ORD-2026-0941\n🛍️ EPSON LQ-590II + หมึกแท้ × 1\n📍 ปลายทาง: เชียงใหม่\n💰 ยอดสุทธิ: ฿18,062 (รวมส่วนลด 5%)\n────────────────\n📲 สแกน QR PromptPay หรือโอนเข้า บัญชีกสิกรไทย 095-585-1136\nเมื่อโอนเสร็จแล้ว ส่งรูปสลิปเข้ามาได้ทันทีครับ 🙏`,
        time: '14:25',
      },
    ],
  },
  {
    key: 'slip',
    label: '🧾 ตรวจสลิปอัตโนมัติ 100%',
    subtitle: 'ลูกค้าส่งรูปสลิปผ่าน LINE → ระบบยิงตรวจสอบความถูกต้องกับธนาคารอัตโนมัติ 100%',
    botName: 'น้อง DealMee — TechShop',
    botEmoji: '💳',
    messages: [
      {
        type: 'user',
        text: '📷 [ส่งรูปภาพสลิปโอนเงิน K-Plus ยอด ฿18,062]',
        time: '14:28',
      },
      {
        type: 'bot',
        text: `ได้รับรูปสลิปเรียบร้อยแล้วครับ 📄 กำลังตรวจสอบความถูกต้องกับระบบธนาคารสักครู่...`,
        time: '14:28',
      },
      {
        type: 'bot',
        tool: 'get_payment_slip_status',
        text: `✅ ตรวจสอบสลิปถูกต้องเรียบร้อยแล้ว!\n────────────────\n🆔 อ้างอิง: ORD-2026-0941\n💰 ยอดเงิน: ฿18,062.00 (ตรงตามยอด ✓)\n🏦 ธนาคาร: กสิกรไทย → ธนาคารผู้รับ ✓\n🕐 วันเวลา: วันนี้ เวลา 14:27 น. ✓\n────────────────\n📦 อัปเดตสถานะเป็น "ชำระเงินแล้ว" และแจ้งฝ่ายคลังเตรียมแพ็คสินค้าเรียบร้อยครับ ขอบคุณมากครับ!`,
        time: '14:29',
        options: ['เช็คสถานะพัสดุ', 'ขอใบกำกับภาษี'],
      },
    ],
  },
  {
    key: 'quotation',
    label: '📄 ออกใบเสนอราคา B2B',
    subtitle: 'รองรับลูกค้าธุรกิจ ออกเอกสาร PDF คำนวณ VAT 7% ส่งเป็น LINE Flex Card ทันที (แผน Elite)',
    botName: 'น้อง DealMee — B2B Pro',
    botEmoji: '🏢',
    messages: [
      {
        type: 'user',
        text: 'บริษัท สยามดิจิทัล ต้องการขอใบเสนอราคา ปริ้นเตอร์ LQ-590II จำนวน 5 เครื่องครับ',
        time: '10:15',
      },
      {
        type: 'bot',
        text: `ยินดีให้บริการครับ ขอทราบเลขผู้เสียภาษีและที่อยู่ออกเอกสารของ บจก. สยามดิจิทัล สักครู่ครับ`,
        time: '10:15',
        options: ['ใช้ข้อมูลบริษัทเดิมในระบบ', 'พิมพ์ที่อยู่ใหม่'],
      },
      {
        type: 'user',
        text: 'ใช้ข้อมูลบริษัทเดิมในระบบ',
        time: '10:16',
      },
      {
        type: 'bot',
        tool: 'create_quotation',
        text: `✅ ออกใบเสนอราคาอย่างเป็นทางการเรียบร้อยแล้วครับ! ออกในนาม บจก. สยามดิจิทัล มีผลยืนราคา 30 วัน`,
        time: '10:16',
        flexType: 'quotation',
        flexData: {
          docNo: 'QT-2026-0089',
          company: 'บจก. สยามดิจิทัล โซลูชั่นส์',
          items: 'EPSON LQ-590II × 5 เครื่อง',
          subtotal: '฿92,500.00',
          vat: '฿6,475.00 (VAT 7%)',
          total: '฿98,975.00',
          validDays: '30 วัน',
        },
        options: ['เปิดดู PDF ฉบับเต็ม', 'ยืนยันสั่งซื้อตามใบเสนอราคา'],
      },
    ],
  },
  {
    key: 'vip',
    label: '💎 Customer Memory & Upsell',
    subtitle: 'จดจำโปรไฟล์ลูกค้าเก่า ข้อมูลความชอบ สินค้าที่เคยสั่ง และแนะนำสินค้าเข้าคู่ได้อย่างแนบเนียน',
    botName: 'น้อง DealMee — Skincare',
    botEmoji: '✨',
    messages: [
      {
        type: 'user',
        text: 'สวัสดีค่ะ มาสั่งครีมบำรุงรอบก่อนเพิ่มค่ะ',
        time: '19:40',
      },
      {
        type: 'bot',
        tool: 'get_customer_history',
        text: `ยินดีต้อนรับคุณมินตรากลับมาอีกครั้งนะคะ 💖\nประวัติการสั่งซื้อล่าสุดเมื่อ 24 ม.ค.: Glow Serum 30ml\n\nรอบนี้รับเซรั่มขวดเดิมเลยไหมคะ?`,
        time: '19:40',
        options: ['รับขวดเดิม 1 ขวด', 'ขอดูสินค้าแนะนำคู่กัน'],
      },
      {
        type: 'user',
        text: 'ขอดูสินค้าแนะนำคู่กัน',
        time: '19:41',
      },
      {
        type: 'bot',
        text: `🌸 แนะนำคู่หูกู้ผิวสูตรเสริมฤทธิ์กันค่ะ:\n• Moisture Barrier Cream 50g — ฿490\n\n👑 พิเศษสำหรับคุณมินตรา (สมาชิกระดับ Gold): ลดเพิ่ม 10% ทันทีเมื่อรับเป็นคู่ค่ะ ✨`,
        time: '19:41',
        options: ['รับทั้งคู่เลยค่ะ', 'รับแค่ครีม'],
      },
      {
        type: 'user',
        text: 'รับทั้งคู่เลยค่ะ (ระวังผิวแพ้น้ำหอมนะคะ)',
        time: '19:42',
      },
      {
        type: 'bot',
        tool: 'update_customer_note',
        text: `รับทราบค่ะ บันทึกข้อมูล "ผิวแพ้น้ำหอม/สูตร Fragrance-Free" ลงในโปรไฟล์ให้เรียบร้อยแล้วค่ะ 📝 ทางทีมจัดส่งจะเลือกสูตรอ่อนโยนพิเศษให้นะคะ`,
        time: '19:42',
      },
    ],
  },
  {
    key: 'handoff',
    label: '🆘 ส่งต่อแอดมินคนจริง',
    subtitle: 'ตรวจจับคำถามซับซ้อนหรือเคสร้องเรียน สลับโหมดเป็น Human ทันที พร้อมหยุด AI ชั่วคราว',
    botName: 'น้อง DealMee — Customer Care',
    botEmoji: '🛎️',
    messages: [
      {
        type: 'user',
        text: 'สินค้าที่ส่งมามีรอยแตกเสียหาย ขอคุยกับเจ้าของร้านด่วนครับ!',
        time: '16:05',
      },
      {
        type: 'bot',
        text: `ขออภัยเป็นอย่างยิ่งในความไม่สะดวกครับ 🙏 เพื่อการดูแลที่รวดเร็วที่สุด ผมขอส่งต่อให้ทีมผู้จัดการร้านดูแลคุณโดยตรงทันทีครับ`,
        time: '16:05',
      },
      {
        type: 'bot',
        tool: 'request_human_agent',
        text: `🔔 แจ้งเตือนแอดมินผู้จัดการร้านเรียบร้อยแล้ว\n────────────────\n⚠️ สถานะ: เคสเคลมสินค้าเร่งด่วน\n🤖 AI หยุดตอบข้อความในแชทนี้ชั่วคราว (Auto-Pause)\n────────────────\nเจ้าหน้าที่แอดมินจะเข้ามาตอบกลับภายใน 2-3 นาทีนี้ครับ ขอบพระคุณครับ`,
        time: '16:06',
      },
    ],
  },
]

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
    label: 'Customer Memory Graph',
    description: 'จดจำชื่อลูกค้า ยอดซื้อสะสม ที่อยู่ และความชอบส่วนบุคคล',
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
    a: 'ไม่ต้องเลยครับ! คุณเพียงแค่มี LINE Official Account ของร้านค้า และนำ Token มากรอกในระบบ DealMee AI ระบบจะพร้อมทำงานและตอบลูกค้าได้ภายใน 5 นาที มีคู่มือและวิดีโอแนะนำขั้นตอนแบบจับมือทำ',
  },
  {
    q: 'บอทเชื่อมต่อกับ LINE Official Account เดิมที่มีลูกค้าอยู่แล้วได้ไหม?',
    a: 'สามารถเชื่อมต่อได้ทันทีครับ โดยประวัติแชทและเพื่อนเดิมใน LINE OA จะยังคงอยู่ครบถ้วน บอทจะเข้ามาช่วยตอบข้อความใหม่ที่ลูกค้าทักเข้ามาโดยไม่รบกวนข้อมูลเดิม',
  },
  {
    q: 'ระบบตรวจสลิปโอนเงินทำงานอย่างไร มีโอกาสผิดพลาดไหม?',
    a: 'ระบบเชื่อมต่อกับระบบตรวจสอบสลิปมาตรฐานธนาคาร (Bank-grade Slip Verification) โดยเช็คความถูกต้องของ QR Code บนสลิป ตรวจสอบยอดเงิน ผู้รับ วันที่และเวลาโอน ป้องกันทั้งสลิปปลอม สลิปแต่งรูป และสลิปที่เคยถูกใช้งานไปแล้วได้อย่างแม่นยำ',
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
