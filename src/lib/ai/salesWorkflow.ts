/**
 * Sales Workflow Engine & Conversation Stage Tracker
 *
 * Tracks and guides the conversation through 5 distinct sales stages:
 * 1. greeting   - ทักทายเริ่มต้น แนะนำตัวและสังเกตความต้องการ
 * 2. discovery  - วินิจฉัยปัญหา ค้นหาความชอบ และเจาะจงความต้องการ (SPIN Selling)
 * 3. showcase   - นำเสนอสินค้า จุดเด่น โปรโมชั่น และคลี่คลายข้อกังวล (Objection Handling)
 * 4. closing    - รวบรวมข้อมูลสั่งซื้อ ออก QR Code หรือจัดส่งใบเสนอราคา (Alternative Close)
 * 5. post_sale  - ขอบคุณ ยืนยันการชำระเงิน/สลิป แนะนำสินค้าเสริม หรือขอรีวิว
 */

import { hasUnnegatedMatch } from '@/lib/ai/thaiMatch'

export type SalesStage = 'greeting' | 'discovery' | 'showcase' | 'closing' | 'post_sale'

export interface StageDeterminationInput {
  currentStage?: string | null
  userQuery: string
  executedToolNames?: string[]
  hasPendingOrder?: boolean
  hasCompletedOrder?: boolean
  lastMessageAt?: string | null
}

/**
 * Returns human-readable Thai label and badge styling for each sales stage
 */
export function getSalesStageMeta(stage: string | null | undefined): {
  label: string
  stage: SalesStage
  badgeClass: string
  dotClass: string
  description: string
} {
  const normalized: SalesStage = (
    stage === 'discovery' || stage === 'showcase' || stage === 'closing' || stage === 'post_sale'
      ? stage
      : 'greeting'
  )

  switch (normalized) {
    case 'discovery':
      return {
        label: 'ค้นหาความต้องการ',
        stage: 'discovery',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
        dotClass: 'bg-sky-500',
        description: 'กำลังซักถามปัญหา สเปก หรือความต้องการเฉพาะ',
      }
    case 'showcase':
      return {
        label: 'นำเสนอสินค้า/โปร',
        stage: 'showcase',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
        dotClass: 'bg-indigo-500',
        description: 'กำลังแนะนำสินค้า เช็กสต็อก หรือคลี่คลายข้อกังวล',
      }
    case 'closing':
      return {
        label: 'กำลังปิดการขาย',
        stage: 'closing',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500',
        description: 'กำลังสรุปออเดอร์ ขอที่อยู่ หรือส่ง QR ชำระเงิน',
      }
    case 'post_sale':
      return {
        label: 'ปิดการขายแล้ว',
        stage: 'post_sale',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
        description: 'บันทึกออเดอร์/การจองสำเร็จ หรือตรวจสอบสลิปเรียบร้อยแล้ว',
      }
    case 'greeting':
    default:
      return {
        label: 'ทักทายแรกเริ่ม',
        stage: 'greeting',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dotClass: 'bg-slate-400',
        description: 'ลูกค้าเพิ่งทักเข้ามา หรือบทสนทนาเริ่มต้นใหม่',
      }
  }
}

/**
 * Pure state transition logic that determines the next sales stage
 */
export function determineNextSalesStage({
  currentStage,
  userQuery,
  executedToolNames = [],
  hasPendingOrder = false,
  hasCompletedOrder = false,
  lastMessageAt,
}: StageDeterminationInput): SalesStage {
  const text = userQuery.toLowerCase().trim()
  const current: SalesStage = (
    currentStage === 'discovery' || currentStage === 'showcase' || currentStage === 'closing' || currentStage === 'post_sale'
      ? currentStage
      : 'greeting'
  )

  // 1. Check inactivity reset: If last message was > 24 hours ago and customer starts with a greeting
  if (lastMessageAt) {
    const elapsedMs = Date.now() - new Date(lastMessageAt).getTime()
    const isOver24Hours = elapsedMs > 24 * 60 * 60 * 1000
    const isGreetingText = /(สวัสดี|ดีครับ|ดีค่ะ|hello|hi|สอบถาม|ทักครับ|ทักค่ะ)/.test(text)
    if (isOver24Hours && isGreetingText && current === 'post_sale') {
      return 'greeting'
    }
  }

  // 2. Post-Sale signals: Order completed, booking completed, slip verified
  if (
    executedToolNames.includes('take_order') ||
    executedToolNames.includes('book_appointment') ||
    hasCompletedOrder
  ) {
    return 'post_sale'
  }

  // 3. Closing signals: Payment QR requested, checkout initiated, quotation issued
  // "ยังไม่เอาเลยค่ะ" is a refusal, not an order: a phrase right after ไม่ doesn't count
  const hasOrderIntentWords = hasUnnegatedMatch(text, /(เอาเลย|เอาค่ะ|เอาครับ|สั่งเลย|สั่งซื้อ|พร้อมโอน|ขอเลขบัญชี|ขอคิวอาร์|ขอ qr|จ่ายเงิน|เก็บปลายทาง|ใบเสนอราคา|เสนอราคา|quotation)/)
  if (
    executedToolNames.includes('send_payment_qr') ||
    executedToolNames.includes('create_quotation') ||
    executedToolNames.includes('create_official_letter') ||
    hasPendingOrder ||
    hasOrderIntentWords
  ) {
    return 'closing'
  }

  // 4. Showcase signals: Product search, stock check, discount discussion, objection handling
  const hasProductQuery = /(มีไหม|ราคา|เท่าไหร่|ขอดู|มีรูปไหม|โปร|สต็อก|ลดได้ไหม|ของแท้ไหม|คิดดูก่อน)/.test(text)
  if (
    executedToolNames.includes('search_products') ||
    executedToolNames.includes('check_stock') ||
    executedToolNames.includes('get_active_promotions') ||
    hasProductQuery
  ) {
    return 'showcase'
  }

  // 5. Discovery signals: Broad inquiries, problem descriptions, recommendations
  const hasDiscoveryIntent = /(แนะนำ|แบบไหนดี|เหมาะกับ|ใช้อะไรดี|มีปัญหา|ช่วยเลือก|ไซส์ไหนดี|สูตรไหนดี)/.test(text)
  if (hasDiscoveryIntent || current === 'greeting') {
    if (text.length > 5 && !/(สวัสดี|ดีครับ|ดีค่ะ|hello|hi)/.test(text)) {
      return 'discovery'
    }
  }

  return current
}

/**
 * Formats stage-specific prompt guidance injected into dynamic system prompt
 */
export function formatSalesStagePromptContext(stage: SalesStage): string {
  switch (stage) {
    case 'discovery':
      return `
[สถานะการขายปัจจุบัน: 🔍 Discovery (ค้นหาความต้องการ)]
- ลูกค้ากำลังอยู่ในช่วงค้นหาข้อมูล/ปรึกษา: ห้ามเร่งปิดการขายหรือยัดเยียดสินค้า
- หน้าที่ของคุณ: ถาม 1 คำถามเพื่อเจาะจงความต้องการ สไตล์ หรือปัญหาที่ต้องการแก้ไข (SPIN Discovery) แล้วคัดเฉพาะสินค้าที่ตรงจุด 1-2 รายการมาแนะนำ`

    case 'showcase':
      return `
[สถานะการขายปัจจุบัน: 📦 Showcase & Value (นำเสนอคุณค่า)]
- ลูกค้ากำลังพิจารณาสินค้า/ราคา: ให้ชูจุดเด่น ความคุ้มค่าระยะยาว หรือโปรโมชั่นที่ตอบโจทย์ Pain Point
- จัดการข้อกังวล/ความลังเลอย่างนุ่มนวล (Objection Handling) และลงท้ายด้วย Bridge Question หรือคำถามทางเลือก (Alternative Close) เสมอ`

    case 'closing':
      return `
[สถานะการขายปัจจุบัน: 🎯 Closing (กำลังปิดการขาย)]
- ลูกค้าแสดงความสนใจจะซื้อชัดเจน: ตรวจสอบข้อมูลให้ครบถ้วน (สินค้า/ไซส์/จำนวน, ชื่อ, เบอร์โทร, ที่อยู่, วิธีชำระเงิน)
- เมื่อข้อมูลครบ ให้เรียก Tool "take_order" หรือ "send_payment_qr" ทันที และสรุปข้อมูลออเดอร์พร้อมเลขอ้างอิงจริง`

    case 'post_sale':
      return `
[สถานะการขายปัจจุบัน: 🎉 Post-Sale (หลังการขาย & ดูแลต่อเนื่อง)]
- การสั่งซื้อ/การจองถูกบันทึกเรียบร้อยแล้ว: ขอบคุณลูกค้าอย่างอบอุ่น แนะนำขั้นตอนส่งสลิป หรือเสนอสินค้าเสริมที่เข้าชุดกัน (Cross-sell) อย่างเป็นมิตร`

    case 'greeting':
    default:
      return `
[สถานะการขายปัจจุบัน: 👋 Greeting (ทักทายแรกเริ่ม)]
- ทักทายลูกค้าอย่างอบอุ่น เป็นมิตร และสุภาพ สังเกตความต้องการแรกเริ่มและเตรียมพร้อมนำทางสู่ขั้นตอนการค้นหาสินค้าหรือบริการที่ตรงใจ`
  }
}
