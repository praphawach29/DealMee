import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPeriod } from '@/lib/billing/usage'
import { getCustomerProfileContext } from '@/lib/customerMemory'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const QUOTA_EXCEEDED_MESSAGE_TH =
  'ขออภัยค่ะ ร้านค้าใช้ข้อความครบตามแพ็กเกจในเดือนนี้แล้ว กรุณาติดต่อทางร้านหรือรออัปเกรดแพ็กเกจเพื่อใช้งานต่อค่ะ'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesAgentRequest {
  shop: any
  userQuery: string
  userId: string
  conversationId: string
  /**
   * Optional explicit conversation history, used in place of the
   * chat_messages DB lookup. The Chat Playground never persists turns to
   * chat_messages (unlike the real LINE webhook), so without this override
   * every Playground message would be treated as the start of a brand new
   * conversation with no memory of what was just said.
   */
  conversationHistory?: { sender: 'user' | 'bot'; text: string }[]
}

export type ComplexityLevel = 'LOW' | 'HIGH'
export type AiProvider = 'gemini' | 'claude' | 'openai'

export type AgentToolName =
  | 'send_payment_qr'
  | 'take_order'
  | 'check_order_status'
  | 'get_payment_slip_status'
  | 'send_invoice'
  | 'calculate_installment'
  | 'apply_custom_discount'
  | 'search_products'
  | 'check_stock'
  | 'get_product_image'
  | 'get_upsell_products'
  | 'get_crosssell_products'
  | 'recommend_product_match'
  | 'upsell_suggestion'
  | 'check_available_slots'
  | 'book_appointment'
  | 'reschedule_booking'
  | 'check_booking'
  | 'cancel_booking'
  | 'calculate_shipping'
  | 'track_parcel'
  | 'save_lead'
  | 'update_customer_note'
  | 'add_customer_tag'
  | 'get_customer_history'
  | 'check_loyalty_points'
  | 'search_knowledge_base'
  | 'get_active_promotions'
  | 'create_quotation'
  | 'request_human_agent'
  | 'transfer_to_agent'
  | 'schedule_followup'
  // New tools
  | 'get_shop_info'
  | 'check_warranty'
  | 'request_review'
  | 'get_return_policy'

export interface AgentToolCall {
  name: AgentToolName
  args: Record<string, any>
}

export interface AgentUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AgentResult {
  text: string
  toolCall?: AgentToolCall
  usage?: AgentUsage
  quotaExceeded?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Tool List (36 Tools) — OpenAI format (canonical)
// ─────────────────────────────────────────────────────────────────────────────

const MASTER_TOOLS = [
  // ── 💳 Payment ──────────────────────────────────────────────────────────────
  {
    name: 'send_payment_qr',
    description: 'ส่ง QR Code PromptPay ให้ลูกค้าสแกนจ่าย ใช้เมื่อลูกค้าพร้อมชำระเงินหรือตกลงซื้อแล้ว',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'ยอดเงินรวมที่ต้องชำระ (บาท)' },
        order_summary: { type: 'string', description: 'สรุปรายการสินค้า เช่น "สินค้า A x2"' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'get_payment_slip_status',
    description: 'ตรวจสอบสถานะการชำระเงินและสลิปโอนเงินของออเดอร์',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'รหัสออเดอร์ เช่น ORD-000123' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'send_invoice',
    description: 'สร้างและส่งลิงก์ชำระเงิน (Invoice/Payment Link) ให้ลูกค้าสำหรับออเดอร์ที่สร้างแล้ว',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'รหัสออเดอร์' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'calculate_installment',
    description: 'คำนวณยอดผ่อนชำระรายเดือน สำหรับลูกค้าที่ต้องการซื้อแบบผ่อน',
    parameters: {
      type: 'object',
      properties: {
        principal: { type: 'number', description: 'ยอดจัด (ราคาสินค้าลบเงินดาวน์)' },
        months: { type: 'number', description: 'จำนวนเดือนที่ผ่อน เช่น 6, 12, 24' },
        interest_rate: { type: 'number', description: 'ดอกเบี้ยต่อเดือน เช่น 0.89' },
      },
      required: ['principal', 'months', 'interest_rate'],
    },
  },
  {
    name: 'apply_custom_discount',
    description: 'ให้ส่วนลดพิเศษกับลูกค้าที่ลังเลเพื่อปิดการขาย ลดได้ไม่เกินโควต้าสูงสุดของร้าน',
    parameters: {
      type: 'object',
      properties: {
        original_price: { type: 'number', description: 'ราคาปกติก่อนลด' },
        discount_amount: { type: 'number', description: 'จำนวนเงินที่ลดให้ (บาท)' },
        reason: { type: 'string', description: 'เหตุผลที่ลดให้ เช่น ลูกค้าบอกร้านอื่นถูกกว่า' },
      },
      required: ['original_price', 'discount_amount', 'reason'],
    },
  },
  {
    name: 'create_quotation',
    description: 'สร้างใบเสนอราคา (Quotation) และส่ง Link ให้ลูกค้า',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'ชื่อลูกค้า' },
        items: {
          type: 'array',
          description: 'รายการสินค้า',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              qty: { type: 'number' },
              price: { type: 'number' },
            },
          },
        },
      },
      required: ['customer_name', 'items'],
    },
  },

  // ── 🛒 Order ─────────────────────────────────────────────────────────────────
  {
    name: 'take_order',
    description: 'สรุปและสร้างออเดอร์ใหม่เมื่อลูกค้าให้ข้อมูลครบถ้วนและตกลงซื้อแล้ว',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'ชื่อลูกค้า' },
        phone: { type: 'string', description: 'เบอร์โทรติดต่อ' },
        product: { type: 'string', description: 'ชื่อสินค้าที่สั่ง' },
        qty: { type: 'string', description: 'จำนวน' },
        variants: { type: 'string', description: 'สี, ขนาด หรือตัวเลือกอื่นๆ ถ้าไม่มีใส่ "-"' },
        address: { type: 'string', description: 'ที่อยู่จัดส่งครบถ้วน' },
        payment_method: { type: 'string', description: 'วิธีชำระเงิน เช่น โอนเงิน, เก็บปลายทาง' },
        total_price: { type: 'number', description: 'ยอดรวมทั้งหมดที่ต้องชำระ (บาท)' },
        tax_invoice: { type: 'string', description: 'ต้องการใบกำกับภาษีหรือไม่' },
      },
      required: ['name', 'phone', 'product', 'qty', 'address', 'payment_method', 'total_price'],
    },
  },
  {
    name: 'check_order_status',
    description: 'ตรวจสอบสถานะการจัดส่งออเดอร์ของลูกค้า',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'รหัสออเดอร์ เช่น ORD-000123' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'track_parcel',
    description: 'เช็คสถานะพัสดุด้วยเลข Tracking Number โดยรองรับ Kerry, Flash, ไปรษณีย์ไทย, J&T',
    parameters: {
      type: 'object',
      properties: {
        tracking_no: { type: 'string', description: 'เลขพัสดุ (Tracking Number)' },
        carrier: { type: 'string', description: 'ขนส่ง เช่น kerry, flash, thaipost, jandt (optional)' },
      },
      required: ['tracking_no'],
    },
  },
  {
    name: 'calculate_shipping',
    description: 'คำนวณและดูอัตราค่าจัดส่งตามจังหวัดปลายทาง',
    parameters: {
      type: 'object',
      properties: {
        province: { type: 'string', description: 'จังหวัดปลายทาง' },
        weight_kg: { type: 'number', description: 'น้ำหนักพัสดุ (กิโลกรัม) ถ้ามี' },
      },
      required: ['province'],
    },
  },

  // ── 📦 Product ────────────────────────────────────────────────────────────────
  {
    name: 'search_products',
    description: 'ค้นหาสินค้าจากฐานข้อมูลจริง ใช้เมื่อลูกค้าถามสินค้า ราคา หรือต้องการข้อมูลสินค้าที่ถูกต้อง',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'คำค้นหา เช่น "ชุดนอน" "สีชมพู" หรือชื่อสินค้า' },
        category: { type: 'string', description: 'หมวดหมู่สินค้า (optional)' },
        max_price: { type: 'number', description: 'ราคาสูงสุดที่ลูกค้ารับได้ (บาท, optional)' },
        limit: { type: 'number', description: 'จำนวนสินค้าที่ต้องการ (default 5, max 10)' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'check_stock',
    description: 'ตรวจสอบจำนวนสต็อกสินค้า real-time เพื่อป้องกันแนะนำสินค้าที่หมด',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'ชื่อสินค้าที่ต้องการเช็ค สามารถใช้ชื่อย่อได้' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'get_product_image',
    description: 'ดึงลิงก์รูปภาพของสินค้าเพื่อนำไปแสดงให้ลูกค้าดู เมื่อลูกค้าขอดูรูปสินค้า',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'ชื่อสินค้าที่ต้องการดูรูป' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'get_upsell_products',
    description: 'แนะนำสินค้าสเปคดีกว่า ราคาสูงกว่าในหมวดเดียวกัน เพื่อ Upsell',
    parameters: {
      type: 'object',
      properties: {
        base_product_name: { type: 'string', description: 'ชื่อสินค้าที่ลูกค้ากำลังดูอยู่' },
      },
      required: ['base_product_name'],
    },
  },
  {
    name: 'get_crosssell_products',
    description: 'แนะนำสินค้าหมวดอื่นที่ควรซื้อคู่กัน เช่น อุปกรณ์เสริม อะไหล่',
    parameters: {
      type: 'object',
      properties: {
        base_product_name: { type: 'string', description: 'ชื่อสินค้าหลัก' },
      },
      required: ['base_product_name'],
    },
  },
  {
    name: 'recommend_product_match',
    description: 'แนะนำสินค้าที่เข้าชุดกันหรือใช้งานร่วมกันได้ เช่น ซื้อเสื้อ แนะนำกางเกงที่เข้ากัน',
    parameters: {
      type: 'object',
      properties: {
        base_product_name: { type: 'string', description: 'ชื่อสินค้าหลักที่ลูกค้าสนใจ' },
      },
      required: ['base_product_name'],
    },
  },
  {
    name: 'upsell_suggestion',
    description: 'ค้นหาสินค้าที่ควรนำเสนอ Upsell/Cross-sell จากสินค้าที่ลูกค้ากำลังสนใจ',
    parameters: {
      type: 'object',
      properties: {
        base_product: { type: 'string', description: 'ชื่อสินค้าหลักที่ลูกค้าสนใจ' },
      },
      required: ['base_product'],
    },
  },

  // ── 📅 Booking ───────────────────────────────────────────────────────────────
  {
    name: 'check_available_slots',
    description: 'ตรวจสอบเวลาว่างสำหรับจองคิว ต้องเรียกก่อน book_appointment เสมอ',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ต้องการเช็ค เช่น "พรุ่งนี้" "วันศุกร์" "15/07/2025"' },
        service: { type: 'string', description: 'ชื่อบริการที่ต้องการจอง เช่น "ตัดผม" "นวด"' },
      },
      required: [],
    },
  },
  {
    name: 'book_appointment',
    description: 'จองคิวรับบริการ (ต้องเรียก check_available_slots ก่อนเสมอ)',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'ชื่อบริการที่ต้องการจอง' },
        date: { type: 'string', description: 'วันที่จอง (DD/MM/YYYY)' },
        time: { type: 'string', description: 'เวลาที่จอง เช่น 10:00, 14:30' },
        name: { type: 'string', description: 'ชื่อลูกค้า' },
        phone: { type: 'string', description: 'เบอร์โทรติดต่อ' },
        deposit_amount: { type: 'number', description: 'ค่ามัดจำ (ถ้ามี)' },
        note: { type: 'string', description: 'หมายเหตุเพิ่มเติม' },
      },
      required: ['service', 'date', 'time', 'name', 'phone'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'เลื่อนคิวจองบริการเป็นวัน/เวลาใหม่',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'รหัสคิวเดิม เช่น BK-000123' },
        new_date: { type: 'string', description: 'วันที่ใหม่ (DD/MM/YYYY)' },
        new_time: { type: 'string', description: 'เวลาใหม่ เช่น 10:00' },
      },
      required: ['booking_id', 'new_date', 'new_time'],
    },
  },
  {
    name: 'check_booking',
    description: 'ตรวจสอบสถานะการจองนัดหมาย',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ชื่อลูกค้า หรือ Booking ID' },
      },
      required: ['query'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'ยกเลิกการจองนัดหมาย',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Booking ID ที่ต้องการยกเลิก' },
        reason: { type: 'string', description: 'เหตุผลที่ยกเลิก (optional)' },
      },
      required: ['booking_id'],
    },
  },

  // ── 👤 Customer ───────────────────────────────────────────────────────────────
  {
    name: 'save_lead',
    description: 'บันทึกข้อมูลลูกค้าที่สนใจสินค้าแต่ยังไม่ตัดสินใจซื้อ เพื่อ Follow-up ภายหลัง',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'สินค้าที่ลูกค้าสนใจ' },
        customer_name: { type: 'string', description: 'ชื่อลูกค้า (ถ้าทราบ)' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'update_customer_note',
    description: 'บันทึกข้อมูลสำคัญเกี่ยวกับลูกค้า เช่น ความชอบ โรคประจำตัว ข้อมูลพิเศษ เพื่อปรับปรุงบริการครั้งต่อไป',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'ข้อมูลที่ต้องการบันทึก เช่น "ชอบสีชมพู" "แพ้สีเอียน"' },
      },
      required: ['note'],
    },
  },
  {
    name: 'add_customer_tag',
    description: 'ติด Tag ให้ลูกค้าเพื่อจัดกลุ่มอัตโนมัติ เช่น VIP, Wholesale, Complain',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'ชื่อ Tag เช่น "VIP" "Wholesale" "ลูกค้าประจำ"' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'get_customer_history',
    description: 'ดูประวัติการซื้อและออเดอร์เก่าของลูกค้ารายนี้ เพื่อให้บริการส่วนตัวมากขึ้น',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'check_loyalty_points',
    description: 'เช็คคะแนนสะสม (Loyalty Points) หรือยอดซื้อสะสมของลูกค้ารายนี้',
    parameters: { type: 'object', properties: {}, required: [] },
  },

  // ── 🧠 Knowledge ──────────────────────────────────────────────────────────────
  {
    name: 'search_knowledge_base',
    description: 'ค้นหาข้อมูลจาก Knowledge Base ของร้าน เช่น นโยบายร้าน วิธีใช้งาน สเปคสินค้าเชิงลึก ใช้เมื่อลูกค้าถามเรื่องที่ไม่มีในสต็อก',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'คำถามหรือข้อความที่ต้องการค้นหา' },
      },
      required: ['query'],
    },
  },

  // ── 🎁 Promotions ──────────────────────────────────────────────────────────────
  {
    name: 'get_active_promotions',
    description: 'ดึงโปรโมชั่นและส่วนลดที่กำลังใช้งานอยู่เพื่อแนะนำให้ลูกค้า',
    parameters: { type: 'object', properties: {}, required: [] },
  },

  // ── 🙋 Escalation ─────────────────────────────────────────────────────────────
  {
    name: 'request_human_agent',
    description: 'เรียกแอดมิน/เจ้าของร้านเข้ามาดูแลแชท เมื่อ AI ไม่สามารถช่วยได้หรือลูกค้าต้องการพูดคุยกับคน',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'เหตุผลที่ต้องการ Human Agent' },
        urgency: { type: 'string', description: 'urgent หรือ normal' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'transfer_to_agent',
    description: 'โอนสายให้ Agent แผนกอื่นเมื่อเจตนาลูกค้าเปลี่ยน เช่น จาก Sales ไป Support หรือ Booking',
    parameters: {
      type: 'object',
      properties: {
        target_agent: { type: 'string', description: 'SalesAgent, BookingAgent, หรือ SupportAgent' },
        reason: { type: 'string', description: 'เหตุผลที่โอนสาย' },
      },
      required: ['target_agent', 'reason'],
    },
  },

  // ── 📅 Follow-up ──────────────────────────────────────────────────────────────
  {
    name: 'schedule_followup',
    description: 'ตั้งเวลาให้ระบบทักหาลูกค้าอัตโนมัติ เมื่อลูกค้าบอกจะคิดก่อนหรือต้องการเวลาตัดสินใจ',
    parameters: {
      type: 'object',
      properties: {
        delay_minutes: { type: 'number', description: 'จำนวนนาทีที่รอก่อนทักกลับ เช่น 30, 60, 120' },
        reason: { type: 'string', description: 'เหตุผลที่ต้องการ Follow-up' },
      },
      required: ['delay_minutes', 'reason'],
    },
  },

  // ── ✨ NEW Tools (Added in botify-saas-web) ────────────────────────────────────
  {
    name: 'get_shop_info',
    description: 'ดึงข้อมูลทั่วไปของร้านค้า เช่น เวลาเปิด-ปิด ที่อยู่ ช่องทางติดต่อ เมื่อลูกค้าถามเกี่ยวกับร้าน',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'check_warranty',
    description: 'ตรวจสอบสถานะการรับประกันสินค้าของลูกค้า',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'รหัสออเดอร์ หรือเลขที่ใบเสร็จ' },
        product_name: { type: 'string', description: 'ชื่อสินค้าที่ต้องการเช็คประกัน' },
      },
      required: [],
    },
  },
  {
    name: 'request_review',
    description: 'ส่งคำขอให้ลูกค้าเขียนรีวิวหลังจากได้รับสินค้าแล้ว เพื่อสร้าง Social Proof',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'รหัสออเดอร์ที่ต้องการขอรีวิว' },
        platform: { type: 'string', description: 'แพลตฟอร์มที่ต้องการรีวิว เช่น LINE, Google, Facebook' },
      },
      required: [],
    },
  },
  {
    name: 'get_return_policy',
    description: 'ดึงนโยบายการคืนสินค้าและเงินคืนของร้านค้า เมื่อลูกค้าถามเรื่องการคืนสินค้า',
    parameters: { type: 'object', properties: {}, required: [] },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Convert MASTER_TOOLS → Provider-specific format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gemini: functionDeclarations. The current generateContent API expects
 * standard lowercase JSON-Schema type strings ("object", "string", ...) —
 * same as what Claude/OpenAI already accept in MASTER_TOOLS as authored.
 * An earlier version of this code uppercased them (matching an older
 * Gemini SDK convention), which the live API now rejects wholesale with a
 * 400 INVALID_ARGUMENT on every function declaration in the request.
 */
function toGeminiTools(tools: typeof MASTER_TOOLS) {
  return [
    {
      // Gemini also rejects any declaration with type:"object" and an empty
      // properties map, so no-argument tools must omit `parameters` entirely
      // rather than send `{ type: 'object', properties: {}, required: [] }`.
      functionDeclarations: tools.map((t) => {
        const hasProperties = Object.keys(t.parameters?.properties || {}).length > 0
        return {
          name: t.name,
          description: t.description,
          ...(hasProperties ? { parameters: t.parameters } : {}),
        }
      }),
    },
  ]
}

/** Claude: tools with input_schema */
function toClaudeTools(tools: typeof MASTER_TOOLS) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))
}

/** OpenAI: tools array with type: 'function' wrapper */
function toOpenAITools(tools: typeof MASTER_TOOLS) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Groups (mirroring original toolDefinitions.js)
// ─────────────────────────────────────────────────────────────────────────────

const SALES_TOOL_NAMES: AgentToolName[] = [
  'search_products', 'check_stock', 'get_product_image',
  'get_upsell_products', 'get_crosssell_products', 'recommend_product_match', 'upsell_suggestion',
  'get_active_promotions', 'apply_custom_discount', 'calculate_installment',
  'calculate_shipping', 'take_order', 'create_quotation', 'send_payment_qr',
  'get_payment_slip_status', 'send_invoice',
  'save_lead', 'update_customer_note', 'add_customer_tag', 'get_customer_history', 'check_loyalty_points',
  'schedule_followup', 'request_human_agent', 'transfer_to_agent',
  'get_shop_info', 'request_review', 'get_return_policy',
]

const BOOKING_TOOL_NAMES: AgentToolName[] = [
  'check_available_slots', 'book_appointment', 'reschedule_booking', 'check_booking', 'cancel_booking',
  'get_active_promotions', 'request_human_agent', 'update_customer_note', 'transfer_to_agent',
  'send_payment_qr', 'get_shop_info',
]

const SUPPORT_TOOL_NAMES: AgentToolName[] = [
  'check_order_status', 'track_parcel', 'get_payment_slip_status',
  'search_knowledge_base', 'request_human_agent', 'update_customer_note', 'add_customer_tag',
  'transfer_to_agent', 'check_warranty', 'get_return_policy',
]

const GENERAL_TOOL_NAMES: AgentToolName[] = [
  'search_knowledge_base', 'request_human_agent', 'transfer_to_agent', 'get_shop_info',
  // Product lookup tools — ordinary "what do you have / is this in stock"
  // questions rarely contain negotiation keywords, so without these here the
  // bot could never actually query real product data for the common case.
  'search_products', 'check_stock', 'get_active_promotions',
]

function filterTools(names: AgentToolName[]) {
  return MASTER_TOOLS.filter((t) => names.includes(t.name as AgentToolName))
}

// ─────────────────────────────────────────────────────────────────────────────
// Botify Brain Engine™: Complexity Classifier & Router
// ─────────────────────────────────────────────────────────────────────────────

export function classifyMessageComplexity(userQuery: string): {
  complexity: ComplexityLevel
  targetProvider: AiProvider
  toolSet: typeof MASTER_TOOLS
  reason: string
} {
  const text = userQuery.toLowerCase().trim()

  const negotiationKeywords = ['ลด', 'ส่วนลด', 'ลดได้ไหม', 'ลดอีกไหม', 'แถม', 'ของแถม',
    'แพง', 'แพงกว่า', 'เทียบ', 'ต่อรอง', 'โปรโมชั่นพิเศษ', 'ราคาส่ง', 'เหมา']
  const bookingKeywords = ['จอง', 'นัด', 'จองคิว', 'นัดหมาย', 'ว่างไหม', 'เลื่อนนัด', 'ยกเลิกนัด']
  const supportKeywords = ['ออเดอร์', 'พัสดุ', 'tracking', 'ส่งแล้ว', 'ยังไม่ได้รับ', 'คืนสินค้า', 'ประกัน', 'ชำรุด']

  const isBooking = bookingKeywords.some((k) => text.includes(k))
  const isSupport = supportKeywords.some((k) => text.includes(k))
  const isHighComplexity = negotiationKeywords.some((k) => text.includes(k))

  const toolSet = isBooking
    ? filterTools(BOOKING_TOOL_NAMES)
    : isSupport
    ? filterTools(SUPPORT_TOOL_NAMES)
    : isHighComplexity
    ? filterTools(SALES_TOOL_NAMES)
    : filterTools(GENERAL_TOOL_NAMES)

  if (isHighComplexity) {
    return {
      complexity: 'HIGH',
      targetProvider: process.env.CLAUDE_API_KEY || process.env.CLAUDE_KEY ? 'claude' : 'gemini',
      toolSet,
      reason: 'Detected negotiation/discount intent → High-persuasion model',
    }
  }

  return {
    complexity: 'LOW',
    targetProvider: 'gemini',
    toolSet,
    reason: 'Standard FAQ / product / booking / support query',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quota Enforcement (Phase 2 — Billing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a shop has exceeded its plan's monthly message quota.
 * Limits are resolved from the admin-editable `plans` table (keyed by
 * shop.plan_key, falling back to shop.plan for shops not yet migrated),
 * not duplicated onto `shops`, so a plan edit takes effect immediately.
 * A messages limit of -1 (byok/unlimited sentinel) always skips the check.
 * An expired-but-not-yet-downgraded subscription (plan_expires_at in the
 * past) is treated as the free plan's limit.
 */
export interface QuotaStatus {
  planKey: string
  messagesUsed: number
  messageLimit: number // -1 = unlimited
  isUnlimited: boolean
  isOverQuota: boolean
}

/**
 * Resolves a shop's current-period usage against its plan's message limit.
 * Shared by the webhook's quota gate and the dashboard/Chat Playground so
 * both always agree on the same numbers.
 */
export async function getQuotaStatus(shop: any): Promise<QuotaStatus> {
  const admin = createAdminClient()
  const planKey = shop.plan_key || shop.plan || 'free'

  const { data: planRow } = await admin
    .from('plans')
    .select('key, messages')
    .eq('key', planKey)
    .maybeSingle()

  let messageLimit = planRow ? Number(planRow.messages) : null

  // Fallback for shops whose plan isn't in the `plans` table yet (defaults)
  if (messageLimit === null) {
    const defaults: Record<string, number> = { free: 500, starter: 3000, pro: 10000, agency: 30000, byok: -1 }
    messageLimit = defaults[planKey] ?? 500
  }

  // Expired subscription (past plan_expires_at) falls back to free-tier limit
  if (shop.plan_expires_at && new Date(shop.plan_expires_at) < new Date() && planKey !== 'free') {
    messageLimit = 500
  }

  const isUnlimited = messageLimit === -1

  const period = getCurrentPeriod()
  const { data: usageRow } = await admin
    .from('usage_logs')
    .select('messages_used')
    .eq('shop_id', shop.id)
    .eq('period', period)
    .maybeSingle()

  const messagesUsed = usageRow ? Number(usageRow.messages_used) : 0

  return {
    planKey,
    messagesUsed,
    messageLimit,
    isUnlimited,
    isOverQuota: !isUnlimited && messagesUsed >= messageLimit,
  }
}

async function isOverQuota(shop: any): Promise<boolean> {
  try {
    const status = await getQuotaStatus(shop)
    return status.isOverQuota
  } catch (err) {
    console.error('[isOverQuota] Exception (fail-open):', err)
    return false // never block a customer's chat due to a quota-check bug
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Agent Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export async function processSalesAgentChat({
  shop,
  userQuery,
  userId,
  conversationId,
  conversationHistory,
}: SalesAgentRequest): Promise<AgentResult> {
  if (await isOverQuota(shop)) {
    return { text: QUOTA_EXCEEDED_MESSAGE_TH, quotaExceeded: true }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  const claudeKey = process.env.CLAUDE_API_KEY || process.env.CLAUDE_KEY || process.env.NEXT_PUBLIC_CLAUDE_API_KEY || ''
  const openAiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

  // 1. Knowledge Base
  const { data: knowledgeItems } = await supabase
    .from('knowledge_base')
    .select('title, content, category')
    .eq('shop_id', shop.id)
    .eq('status', 'active')

  let knowledgeContext = ''
  if (knowledgeItems && knowledgeItems.length > 0) {
    knowledgeContext =
      `\n\n[คลังข้อมูลความรู้ของร้าน]\n` +
      knowledgeItems.map((k) => `Q: ${k.title}\nA: ${k.content}`).join('\n\n')
  }

  // 2. Products
  const features = (shop.features as Record<string, boolean>) || {}
  let productsContext = ''
  if (features.product_recommend !== false) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, stock, category, description')
      .eq('shop_id', shop.id)
      .gt('stock', 0)

    if (products && products.length > 0) {
      productsContext =
        `\n\n[แคตตาล็อกสินค้าพร้อมส่ง]\n` +
        products.map((p) =>
          `- ${p.name} (${p.category || 'ทั่วไป'}): ${Number(p.price || 0).toLocaleString()} บาท (คงเหลือ ${p.stock} ชิ้น)`
        ).join('\n')
    }
  }

  // 3. Chat History
  let historyContext = ''
  if (conversationHistory && conversationHistory.length > 0) {
    historyContext =
      `\n\n[ประวัติบทสนทนาล่าสุด]\n` +
      conversationHistory
        .slice(-10)
        .map((m) => `${m.sender === 'user' ? 'ลูกค้า' : 'AI'}: ${m.text}`)
        .join('\n')
  } else {
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('sender_type, message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentMessages && recentMessages.length > 0) {
      historyContext =
        `\n\n[ประวัติบทสนทนาล่าสุด]\n` +
        [...recentMessages].reverse()
          .map((m) => `${m.sender_type === 'user' ? 'ลูกค้า' : 'AI'}: ${m.message}`)
          .join('\n')
    }
  }

  // 4. Payment Info
  const promptpayId = shop.promptpay_id || shop.promptpay_number
  let paymentInfo = ''
  if (promptpayId || shop.bank_account_number) {
    paymentInfo = `\n\n[ช่องทางชำระเงิน]
- พร้อมเพย์: ${promptpayId || 'ไม่ระบุ'} (${shop.promptpay_name || shop.name})
- ธนาคาร: ${shop.bank_name || '-'} เลขบัญชี: ${shop.bank_account_number || '-'} ชื่อ: ${shop.bank_account_name || shop.name}`
  }

  // 5. Customer Profile (Customer Memory Graph) — auto-injected, no tool call needed
  const customerProfileContext = await getCustomerProfileContext(shop.id, userId)

  // 5. System Instruction
  const systemInstruction = `คุณคือ "${shop.bot_name || 'น้อง Botify'}" พนักงานขาย AI อัจฉริยะประจำร้าน "${shop.name}"
บุคลิกภาพ: ${shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ'}
คำอธิบายร้าน: ${shop.description || 'ร้านค้าออนไลน์'}

[Sales Pipeline]
1. [Greeting] ทักทายและถามความต้องการ
2. [Showcase] แนะนำสินค้า ราคา จุดเด่น ตามรายการสินค้าด้านล่าง
3. [Closing] เมื่อลูกค้าพร้อมชำระ → เรียก Tool "send_payment_qr" ทันที หรือ "take_order" เมื่อครบข้อมูล
4. [Post-Sales] ขอบคุณ + แนะนำส่งสลิปกลับมาในแชท

[กฎสำคัญ]
- ตอบภาษาไทยสุภาพ กระชับ
- ใช้ Tools ที่จำเป็นให้ถูกต้อง อย่าตอบเดา
- ถ้าไม่มีข้อมูล → แจ้งลูกค้าให้รอแอดมินหรือเรียก request_human_agent
${knowledgeContext}
${productsContext}
${paymentInfo}
${customerProfileContext}
${historyContext}`

  // 6. Route
  const routing = classifyMessageComplexity(userQuery)
  console.log(`[Botify Brain™] "${userQuery}" | ${routing.complexity} | ${routing.targetProvider.toUpperCase()} | Tools: ${routing.toolSet.length}`)

  if (routing.targetProvider === 'claude' && claudeKey) {
    const result = await callClaudeApi(systemInstruction, userQuery, claudeKey, routing.toolSet)
    if (result) return result
  } else if (routing.targetProvider === 'openai' && openAiKey) {
    const result = await callOpenAiApi(systemInstruction, userQuery, openAiKey, routing.toolSet)
    if (result) return result
  }

  if (!geminiKey) {
    return { text: shop.greeting_message || 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' }
  }

  const geminiResult = await callGeminiApi(systemInstruction, userQuery, modelName, geminiKey, routing.toolSet)
  if (geminiResult) return geminiResult

  return { text: `สวัสดีค่ะ ยินดีต้อนรับสู่ร้าน "${shop.name}" มีอะไรให้ช่วยแนะนำไหมคะ?` }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider: Google Gemini
// ─────────────────────────────────────────────────────────────────────────────

async function callGeminiApi(
  systemInstruction: string,
  userQuery: string,
  modelName: string,
  apiKey: string,
  toolSet: typeof MASTER_TOOLS
): Promise<AgentResult | null> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userQuery }] }],
        tools: toGeminiTools(toolSet),
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    })

    if (!response.ok) {
      console.error('[Gemini Error]:', await response.text())
      return null
    }

    const data = await response.json()
    const parts: any[] = data.candidates?.[0]?.content?.parts || []

    let replyText = ''
    let toolCall: AgentToolCall | undefined

    for (const part of parts) {
      if (part.text) replyText += part.text
      if (part.functionCall) {
        toolCall = { name: part.functionCall.name as AgentToolName, args: part.functionCall.args || {} }
      }
    }

    if (!replyText && !toolCall) return null

    const usageMeta = data.usageMetadata
    const usage: AgentUsage | undefined = usageMeta
      ? {
          promptTokens: usageMeta.promptTokenCount || 0,
          completionTokens: usageMeta.candidatesTokenCount || 0,
          totalTokens: usageMeta.totalTokenCount || 0,
        }
      : undefined

    return { text: replyText.trim(), toolCall, usage }
  } catch (err) {
    console.error('[Gemini Exception]:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider: Anthropic Claude
// ─────────────────────────────────────────────────────────────────────────────

async function callClaudeApi(
  systemInstruction: string,
  userQuery: string,
  apiKey: string,
  toolSet: typeof MASTER_TOOLS
): Promise<AgentResult | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: systemInstruction,
        tools: toClaudeTools(toolSet),
        messages: [{ role: 'user', content: userQuery }],
      }),
    })

    if (!response.ok) {
      console.error('[Claude Error]:', await response.text())
      return null
    }

    const data = await response.json()
    const blocks: any[] = data.content || []

    let replyText = ''
    let toolCall: AgentToolCall | undefined

    for (const block of blocks) {
      if (block.type === 'text') replyText += block.text
      if (block.type === 'tool_use') {
        toolCall = { name: block.name as AgentToolName, args: block.input || {} }
      }
    }

    if (!replyText && !toolCall) return null

    const usageData = data.usage
    const usage: AgentUsage | undefined = usageData
      ? {
          promptTokens: usageData.input_tokens || 0,
          completionTokens: usageData.output_tokens || 0,
          totalTokens: (usageData.input_tokens || 0) + (usageData.output_tokens || 0),
        }
      : undefined

    return { text: replyText.trim(), toolCall, usage }
  } catch (err) {
    console.error('[Claude Exception]:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider: OpenAI
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAiApi(
  systemInstruction: string,
  userQuery: string,
  apiKey: string,
  toolSet: typeof MASTER_TOOLS
): Promise<AgentResult | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userQuery },
        ],
        tools: toOpenAITools(toolSet),
        tool_choice: 'auto',
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      console.error('[OpenAI Error]:', await response.text())
      return null
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message
    if (!message) return null

    const replyText = message.content || ''
    let toolCall: AgentToolCall | undefined

    if (message.tool_calls?.length > 0) {
      const tc = message.tool_calls[0]
      if (tc.function?.name) {
        try {
          toolCall = {
            name: tc.function.name as AgentToolName,
            args: JSON.parse(tc.function.arguments || '{}'),
          }
        } catch {
          console.error('[OpenAI] tool_call parse error')
        }
      }
    }

    if (!replyText && !toolCall) return null

    const usageData = data.usage
    const usage: AgentUsage | undefined = usageData
      ? {
          promptTokens: usageData.prompt_tokens || 0,
          completionTokens: usageData.completion_tokens || 0,
          totalTokens: usageData.total_tokens || 0,
        }
      : undefined

    return { text: replyText.trim(), toolCall, usage }
  } catch (err) {
    console.error('[OpenAI Exception]:', err)
    return null
  }
}
