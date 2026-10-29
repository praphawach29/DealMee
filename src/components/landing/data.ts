import { PackageTier, AddonPack, FeatureRow } from './types'

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

  {
    category: 'ระบบการขาย & การเงิน',
    label: 'บันทึกสลิปเข้าแดชบอร์ดร้าน',
    description: 'พนักงานถ่ายสลิปผ่าน LINE แล้วบันทึกยอดให้เจ้าของเห็นทันที',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
  {
    category: 'ระบบการขาย & การเงิน',
    label: 'แจ้งลูกค้าเมื่อสินค้ากลับมา (back-in-stock)',
    description: 'บอทตรวจสต็อกจริงก่อนแจ้งลูกค้าที่ขอให้ติดตาม',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
  {
    category: 'ความสามารถพื้นฐาน & AI',
    label: 'Response caching สำหรับคำถามซ้ำ',
    description: 'คำถามซ้ำ เช่น ราคา เมนู เวลาทำการ ใช้ cache เพื่อลดค่า AI',
    starter: true,
    pro: true,
    agency: true,
    byok: true,
  },
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
    q: 'ตอนนี้บอทตอบลูกค้าได้ในช่องทางไหนบ้าง?',
    a: 'ตอนนี้ใช้งานได้กับ LINE Official Account ของร้านครับ ซึ่งเป็นช่องทางที่ร้านค้าไทยใช้ขายกันมากที่สุด ส่วน Facebook Messenger กำลังอยู่ระหว่างขออนุมัติแอปจาก Meta จะเปิดให้ใช้เมื่อผ่านแล้ว เราจะไม่โฆษณาช่องทางที่ยังใช้จริงไม่ได้',
  },
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
