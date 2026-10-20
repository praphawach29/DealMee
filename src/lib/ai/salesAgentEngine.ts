import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { businessHoursPromptContext } from '@/lib/shop/businessHours'
import { salesAutomationEnabled, SALES_AUTOMATION_TOOLS, SALES_LOCKED_PROMPT } from '@/lib/billing/trial'
import { getPlanLimits, getAddonRemaining, consumeAddonCredit } from '@/lib/billing/planLimits'
import { selectRelevantKnowledge } from '@/lib/ai/knowledgeSelect'
import { createAdminClient } from '@/lib/supabase/admin'
import { platformSecret } from '@/lib/platformSecrets'
import { buildBusinessPromptContext } from '@/lib/businessGreeting'
import { getCurrentPeriod } from '@/lib/billing/usage'
import { getCustomerProfileSummary, formatCustomerProfileContext, isVipProfile } from '@/lib/customerMemory'
import { getGeminiPromptCache, dropGeminiPromptCache } from '@/lib/ai/geminiCache'
import { executeTool as realExecuteTool, type ToolExecutor, type ToolExecutionContext, type CustomerMessage } from '@/lib/ai/toolDispatcher'
import { t, detectCustomerLanguage, type CustomerLanguage } from '@/lib/i18n/customerMessages'
import {
  formatSalesStagePromptContext,
  determineNextSalesStage,
  type SalesStage,
} from '@/lib/ai/salesWorkflow'
import {
  retrieveWinningTrajectories,
  formatGoldenClosersPromptContext,
} from '@/lib/ai/salesTrajectory'

const supabase = createAdminClient()

/**
 * Sent the moment a plan turns out to need more than one AI call, so the
 * customer isn't left waiting in silence. Takes the state rather than a bare
 * language so callers can't accidentally send it in the wrong one, and so
 * the Chat Playground shows exactly what LINE sends.
 */
export function planningAckMessage(state: PlanningState): string {
  return t('planningAck', state.language)
}

export const QUOTA_EXCEEDED_MESSAGE_TH = t('quotaExceeded', 'th')

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
  isPlayground?: boolean
  /**
   * Overrides tool execution — defaults to the real executeTool() (writes to
   * the database, sends real LINE messages via the returned
   * immediateMessages). The Chat Playground supplies a safe-preview
   * executor instead, so testing a multi-step plan never creates real
   * orders/bookings/etc.
   */
  toolExecutor?: ToolExecutor
  /**
   * Optional caller-scoped Supabase client. Dashboard server actions pass the
   * authenticated user client so RLS-protected shop data (products, KB, etc.)
   * is visible inside the agent loop; webhook callers can omit this and use
   * the existing anon-key client behavior.
   */
  supabaseClient?: SupabaseClient
}

/** One turn of the Planning Layer's provider-agnostic conversation state. Each callXApi function serializes this into its own wire format. */
export type PlanningTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text?: string; toolCall?: IdentifiedToolCall }
  | { role: 'tool_result'; toolCallId?: string; toolName: string; result: string }

export type ComplexityLevel = 'LOW' | 'HIGH'
export type AiProvider = 'gemini' | 'claude' | 'openai'

export type AgentToolName =
  | 'send_payment_qr'
  | 'take_order'
  | 'check_order_status'
  | 'apply_custom_discount'
  | 'accept_quotation'
  | 'search_products'
  | 'check_stock'
  | 'check_available_slots'
  | 'book_appointment'
  | 'reschedule_booking'
  | 'check_booking'
  | 'cancel_booking'
  | 'calculate_shipping'
  | 'save_lead'
  | 'update_customer_note'
  | 'add_customer_tag'
  | 'update_customer_preference'
  | 'get_customer_history'
  | 'check_loyalty_points'
  | 'search_knowledge_base'
  | 'get_active_promotions'
  | 'create_quotation'
  | 'create_official_letter'
  | 'request_human_agent'
  | 'transfer_to_agent'
  | 'schedule_followup'

export interface AgentToolCall {
  name: AgentToolName
  args: Record<string, any>
}

/**
 * A tool call plus the provider's own id for it (required to send the
 * matching tool result back on the next planning-loop turn). `thoughtSignature`
 * is Gemini-only (opaque per-functionCall reasoning-continuity token Gemini
 * 3.6 attaches — must be echoed back on the same functionCall part on the
 * next turn or Gemini 400s with "missing a thought_signature"); other
 * providers just never set it.
 */
export type IdentifiedToolCall = AgentToolCall & { id?: string; thoughtSignature?: string }

export interface AgentUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  provider: AiProvider
  /** Cached input tokens (Claude prompt caching, Gemini cachedContentTokenCount). */
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface AgentResult {
  text: string
  usage?: AgentUsage
  quotaExceeded?: boolean
  /** Messages (QR images, order confirmations, etc.) to push to the customer — tool execution now happens inside processSalesAgentChat's planning loop, so the caller (webhook route) just delivers these instead of dispatching tools itself. Always an array (empty if no tool ran). */
  immediateMessages: CustomerMessage[]
  /** Every tool actually executed this turn, in order — for future use by the Sales Workflow Engine (stage transitions) and debugging. Always an array. */
  toolCallsExecuted: AgentToolCall[]
  /** Delayed pushes (schedule_followup) — the engine has no channel access to set its own setTimeout, so the caller (webhook route) does it. Always an array. */
  scheduledMessages: { delayMs: number; message: CustomerMessage }[]
  /** Products returned by search_products for rendering LINE Flex Carousel product cards. */
  productsData?: any[]
  /** Active sales stage computed at the end of the turn (greeting, discovery, showcase, closing, post_sale). */
  salesStage?: SalesStage
}

/**
 * Bounded multi-step tool loop. Most messages resolve in a single step
 * (identical behavior to before this existed); a message like
 * "มีเสื้อยืดไซส์ L ไหม ถ้ามีเอา 2 ตัว" can chain
 * search_products/check_stock -> take_order in one customer turn.
 */
export const MAX_PLANNING_STEPS = 6

/**
 * Output-token ceiling per provider call. Deliberately generous because
 * Gemini 3.x bills its internal reasoning against this same budget: at the
 * previous 1024 a single booking turn could burn most of the budget thinking
 * and return a reply truncated mid-sentence (observed live). Thai also
 * tokenizes poorly — a normal confirmation message costs far more tokens
 * here than the equivalent English one.
 */
export const MAX_OUTPUT_TOKENS = 4096

/**
 * How much of the knowledge base rides along in every system prompt. The
 * remainder stays reachable through search_knowledge_base, so a shop can
 * import a whole catalogue without every customer message carrying it. Thai
 * costs roughly one token per character, so the character budget is close
 * enough to a token budget to reason about.
 */
export const KNOWLEDGE_INLINE_MAX_ITEMS = 150
export const KNOWLEDGE_INLINE_MAX_CHARS = 50000

/**
 * The whole system prompt is resent on every planning step, so per-message
 * context is capped: a long bot reply (product lists, order summaries) in the
 * history or a pasted product description otherwise rides along several times
 * per customer message. The full text stays in the database and the tools.
 */
export const HISTORY_LINE_MAX_CHARS = 500
export const PRODUCT_DESCRIPTION_MAX_CHARS = 150

function clipForPrompt(text: string | null | undefined, max: number): string {
  const t = String(text || '')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * Everything a planning step needs, carried across steps so the webhook
 * route can pause after step 0 (to send a LINE ack once it knows the plan
 * needs more than one AI call) and resume the rest in the background — the
 * same reply-then-push-later shape `verifySlipAndNotify` already uses for
 * slip verification, just applied to multi-step planning instead.
 */
export interface PlanningState {
  shop: any
  conversationId: string
  salesStage: SalesStage
  /** Language of the customer's message, so the strings the system writes itself match the language the model is replying in. */
  language: CustomerLanguage
  turns: PlanningTurn[]
  /** Index of the step about to run (0-based) — callers own incrementing this between steps. */
  step: number
  routing: ReturnType<typeof classifyMessageComplexity>
  executor: ToolExecutor
  toolCtx: ToolExecutionContext
  staticSystemPrompt: string
  dynamicSystemPrompt: string
  systemInstruction: string
  modelName: string
  geminiKey: string
  claudeKey: string
  openAiKey: string
  allUsage: AgentUsage[]
  immediateMessages: CustomerMessage[]
  toolCallsExecuted: AgentToolCall[]
  scheduledMessages: { delayMs: number; message: CustomerMessage }[]
  productsData?: any[]
  lastProviderError?: string
  isPlayground?: boolean
  /** The shop runs on its own AI key only (no platform fallback) */
  byok?: boolean
}

export type PlanningStart =
  | { done: true; result: AgentResult }
  | { done: false; state: PlanningState }

/** Internal — one provider call's raw result within the planning loop (not the final AgentResult returned to callers). */
interface ProviderStepResult {
  text: string
  toolCall?: IdentifiedToolCall
  usage?: AgentUsage
  /** The provider stopped because it hit the output-token ceiling, so `text` is cut off mid-sentence and must not be sent to a customer as-is. */
  truncated?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Tool List (36 Tools) — OpenAI format (canonical)
// ─────────────────────────────────────────────────────────────────────────────

const MASTER_TOOLS = [
  // ── 💳 Payment ──────────────────────────────────────────────────────────────
  {
    name: 'send_payment_qr',
    description: 'ส่ง QR Code PromptPay ของออเดอร์ที่รอชำระ (หรือมัดจำการจอง) ให้ลูกค้าสแกนจ่าย ยอดเงินระบบดึงจากออเดอร์เอง เรียกได้ทันทีเมื่อลูกค้าขอ QR/ขอวิธีโอน โดยไม่ต้องถามเลขออเดอร์ ถ้ายังไม่มีออเดอร์ระบบจะบอกให้ take_order ก่อน',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'เลขที่ออเดอร์ เช่น ORD-123456 ไม่ต้องถามลูกค้า ถ้าไม่ระบุระบบใช้ออเดอร์ที่รอชำระล่าสุดของลูกค้ารายนี้เอง' },
        amount: { type: 'number', description: 'ยอดที่คาดว่าต้องชำระ (ใช้เทียบเท่านั้น ระบบใช้ยอดจากออเดอร์จริง)' },
      },
      required: [],
    },
  },
  {
    name: 'apply_custom_discount',
    description: 'ให้ส่วนลดกับออเดอร์ที่รอชำระของลูกค้าเพื่อปิดการขาย ระบบจำกัดไม่เกินเพดานที่ร้านตั้งไว้ และให้ได้ครั้งเดียวต่อออเดอร์ ต้องมีออเดอร์ (take_order) ก่อน',
    parameters: {
      type: 'object',
      properties: {
        discount_amount: { type: 'number', description: 'จำนวนเงินที่ขอลดให้ (บาท) ระบบจะลดไม่เกินเพดานของร้าน' },
        reason: { type: 'string', description: 'เหตุผลที่ให้ส่วนลด' },
      },
      required: ['discount_amount', 'reason'],
    },
  },
  {
    name: 'accept_quotation',
    description: 'เมื่อลูกค้ายืนยันตกลงตามใบเสนอราคาที่ออกให้ในแชทนี้ ให้เรียกเพื่อสร้างออเดอร์จากใบเสนอราคาตามยอดในเอกสาร จากนั้นเรียก send_payment_qr',
    parameters: {
      type: 'object',
      properties: {
        quotation_no: { type: 'string', description: 'เลขที่ใบเสนอราคา เช่น QT-20261017-1234 (ถ้าไม่ระบุ ใช้ใบล่าสุดของแชทนี้)' },
        payment_method: { type: 'string', description: 'วิธีชำระเงิน เช่น โอนเงิน' },
      },
      required: [],
    },
  },
  {
    name: 'create_quotation',
    description: 'สร้างใบเสนอราคา (Quotation) และส่ง Link ให้ลูกค้า',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'ชื่อลูกค้า' },
        customer_phone: { type: 'string', description: 'เบอร์โทรศัพท์ลูกค้า (ถ้ามี)' },
        customer_address: { type: 'string', description: 'ที่อยู่ลูกค้า (ถ้ามี)' },
        items: {
          type: 'array',
          description: 'รายการสินค้าหรือแพ็กเกจที่ต้องการออกใบเสนอราคา',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'ชื่อสินค้าหรือแพ็กเกจตามแคตตาล็อกของร้าน' },
              qty: { type: 'number', description: 'จำนวน เช่น 1' },
              price: { type: 'number', description: 'ราคาต่อหน่วย (บาท)' },
            },
            required: ['name', 'qty', 'price'],
          },
        },
      },
      required: ['customer_name', 'items'],
    },
  },
  {
    name: 'create_official_letter',
    description: 'ร่างและสร้างหนังสือราชการภายนอก (ตามระเบียบงานสารบรรณ) มีตราครุฑ พร้อมออกลิงก์ดู A4 และดาวน์โหลดไฟล์ Word (.docx) สำเร็จรูป',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'เรื่องของหนังสือราชการ เช่น ขอความอนุเคราะห์วิทยากรบรรยาย' },
        recipient: { type: 'string', description: 'เรียน (ตำแหน่งหรือชื่อผู้รับหนังสือ เช่น อธิบดีกรมส่งเสริมการเกษตร)' },
        department: { type: 'string', description: 'ชื่อส่วนราชการ/หน่วยงานเจ้าของหนังสือ (ถ้ามี)' },
        body_facts: { type: 'string', description: 'ภาคเหตุ (ด้วย... หรือ ตามที่...)' },
        body_purpose: { type: 'string', description: 'ภาคประสงค์หรือข้อพิจารณา (ในการนี้...)' },
        body_conclusion: { type: 'string', description: 'ภาคสรุป (จึงเรียนมาเพื่อโปรดพิจารณา...)' },
        signatory_name: { type: 'string', description: 'ชื่อผู้ลงนาม เช่น (นายสมชาย ใจดี)' },
        signatory_position: { type: 'string', description: 'ตำแหน่งผู้ลงนาม เช่น ผู้อำนวยการสำนักบริหารกลาง' },
        reference_to: { type: 'string', description: 'อ้างถึง (ถ้ามี)' },
        enclosures: { type: 'string', description: 'สิ่งที่ส่งมาด้วย (ถ้ามี)' },
      },
      required: ['subject', 'recipient', 'body_facts'],
    },
  },

  // ── 🛒 Order ─────────────────────────────────────────────────────────────────
  {
    name: 'take_order',
    description: 'สรุปและสร้างออเดอร์ใหม่เมื่อลูกค้าให้ข้อมูลครบถ้วนและตกลงซื้อแล้ว ระบบคำนวณราคา ค่าส่ง และตรวจสต๊อกจากข้อมูลร้านเอง ให้ใช้ชื่อสินค้าตามที่ search_products คืนมา ถ้าลูกค้าสั่งหลายสินค้า ให้ใส่ทุกรายการใน items ในออเดอร์เดียว (ห้ามแยกเป็นหลายออเดอร์)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'ชื่อลูกค้า' },
        phone: { type: 'string', description: 'เบอร์โทรติดต่อ' },
        items: {
          type: 'array',
          description: 'รายการสินค้าทั้งหมดที่ลูกค้าสั่งในออเดอร์นี้ (สินค้าเดียวก็ใส่ 1 รายการ)',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', description: 'ชื่อสินค้า' },
              qty: { type: 'number', description: 'จำนวน' },
              variants: { type: 'string', description: 'สี, ขนาด หรือตัวเลือกอื่นๆ ถ้าไม่มีใส่ "-"' },
            },
            required: ['product', 'qty'],
          },
        },
        address: { type: 'string', description: 'ที่อยู่จัดส่งครบถ้วน' },
        payment_method: { type: 'string', description: 'วิธีชำระเงิน เช่น โอนเงิน, เก็บปลายทาง' },
        total_price: { type: 'number', description: 'ยอดรวมทั้งหมดที่ต้องชำระ (บาท)' },
        tax_invoice: { type: 'string', description: 'ต้องการใบกำกับภาษีหรือไม่' },
      },
      required: ['name', 'phone', 'items', 'address', 'payment_method', 'total_price'],
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
        keyword: { type: 'string', description: 'คำค้นหาเฉพาะ เช่น "ชุดนอน" "สีชมพู" หรือชื่อสินค้า ถ้าลูกค้าถามกว้างๆ ว่ามีสินค้าอะไรบ้างให้เว้นว่างเพื่อแสดงรายการทั้งหมด' },
        category: { type: 'string', description: 'หมวดหมู่สินค้า (optional)' },
        max_price: { type: 'number', description: 'ราคาสูงสุดที่ลูกค้ารับได้ (บาท, optional)' },
        limit: { type: 'number', description: 'จำนวนสินค้าที่ต้องการ (default 5, max 10)' },
      },
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

  // ── 📅 Booking ───────────────────────────────────────────────────────────────
  {
    name: 'check_available_slots',
    description: 'ตรวจสอบเวลาว่างสำหรับจองคิว ต้องเรียกก่อน book_appointment เสมอ',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'วันที่ต้องการเช็ค เช่น "พรุ่งนี้" "วันศุกร์" "15/07/2025"' },
        service: { type: 'string', description: 'ชื่อบริการที่ต้องการจอง ถ้าลูกค้าไม่ได้ระบุ ให้ใช้แม่แบบจองหลักของร้าน' },
        time: { type: 'string', description: 'เวลาที่ลูกค้าถามหรืออยากจอง เช่น 18:00 ใช้เพื่อตรวจว่าตรงกับรอบจริงหรือไม่' },
        guest_count: { type: 'number', description: 'จำนวนคน/จำนวนที่นั่งที่ต้องการจอง ถ้าเป็นร้านอาหารหรือคลาส' },
        resource: { type: 'string', description: 'ช่าง โต๊ะ ห้อง โซน หรือทรัพยากรที่ลูกค้าต้องการ ถ้ามี' },
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
        guest_count: { type: 'number', description: 'จำนวนคน/จำนวนที่นั่ง เช่น จองโต๊ะ 4 คน' },
        resource: { type: 'string', description: 'ช่าง โต๊ะ ห้อง โซน หรือทรัพยากรที่ลูกค้าเลือก' },
        booking_type: { type: 'string', description: 'ประเภทการจอง เช่น service, table, queue, class, consultation' },
        note: { type: 'string', description: 'หมายเหตุเพิ่มเติม' },
      },
      required: ['service', 'date', 'time', 'name', 'phone'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'เลื่อนคิวจองบริการเป็นวัน/เวลาใหม่ ให้ AI ดำเนินการเองเหมือนเปิดสมุดจอง: ใช้ booking_id ถ้ามี หรือใช้ชื่อ/เบอร์/วันเวลาเดิมเพื่อค้นหารายการ แล้วอัปเดตด้วยเครื่องมือนี้ ห้ามโอนให้ BookingAgent สำหรับงานปกติ',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'รหัสคิวเดิม เช่น BK-000123' },
        query: { type: 'string', description: 'ชื่อ เบอร์โทร เลขที่การจอง หรือข้อมูลเดิมสำหรับค้นหารายการจอง' },
        name: { type: 'string', description: 'ชื่อลูกค้าที่ใช้จองเดิม' },
        phone: { type: 'string', description: 'เบอร์โทรที่ใช้จองเดิม' },
        date: { type: 'string', description: 'วันจองเดิม ถ้าทราบ' },
        time: { type: 'string', description: 'เวลาจองเดิม ถ้าทราบ' },
        new_date: { type: 'string', description: 'วันที่ใหม่ (DD/MM/YYYY)' },
        new_time: { type: 'string', description: 'เวลาใหม่ เช่น 10:00' },
      },
      required: ['new_date', 'new_time'],
    },
  },
  {
    name: 'check_booking',
    description: 'ตรวจสอบ/เปิดดูสมุดจอง ค้นได้ด้วย booking_id, booking_no, ชื่อ, เบอร์โทร, วัน หรือเวลา ใช้ก่อนเลื่อน/ยกเลิกถ้ายังไม่แน่ใจรายการ',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ชื่อ เบอร์โทร เลขที่การจอง หรือคำค้นหาอื่น ๆ' },
      },
      required: [],
    },
  },
  {
    name: 'cancel_booking',
    description: 'ยกเลิกการจองนัดหมาย ให้ AI ดำเนินการเองจากสมุดจอง: ใช้ booking_id ถ้ามี หรือใช้ชื่อ/เบอร์/วันเวลาเดิมเพื่อค้นหารายการ ห้ามโอนให้ BookingAgent สำหรับงานปกติ',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Booking ID ที่ต้องการยกเลิก' },
        query: { type: 'string', description: 'ชื่อ เบอร์โทร เลขที่การจอง หรือข้อมูลเดิมสำหรับค้นหารายการจอง' },
        name: { type: 'string', description: 'ชื่อลูกค้าที่ใช้จอง' },
        phone: { type: 'string', description: 'เบอร์โทรที่ใช้จอง' },
        date: { type: 'string', description: 'วันจองเดิม ถ้าทราบ' },
        time: { type: 'string', description: 'เวลาจองเดิม ถ้าทราบ' },
        reason: { type: 'string', description: 'เหตุผลที่ยกเลิก (optional)' },
      },
      required: [],
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

  // ── ✨ NEW Tools (Added in dealmee-saas-web) ────────────────────────────────────
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

/** Claude: tools with input_schema and Prompt Caching enabled on the last tool */
function toClaudeTools(tools: typeof MASTER_TOOLS) {
  return tools.map((t, index) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
    ...(index === tools.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
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
  'search_products', 'check_stock', 'get_active_promotions', 'apply_custom_discount', 'calculate_shipping',
  'take_order', 'create_quotation', 'accept_quotation', 'create_official_letter', 'send_payment_qr',
  'save_lead', 'update_customer_note', 'add_customer_tag', 'get_customer_history', 'check_loyalty_points',
  'schedule_followup', 'request_human_agent', 'transfer_to_agent', 'search_knowledge_base',
]

const BOOKING_TOOL_NAMES: AgentToolName[] = [
  'check_available_slots', 'book_appointment', 'reschedule_booking', 'check_booking', 'cancel_booking',
  'get_active_promotions', 'update_customer_note', 'send_payment_qr', 'search_knowledge_base',
]

const SUPPORT_TOOL_NAMES: AgentToolName[] = [
  'check_order_status', 'search_knowledge_base', 'request_human_agent', 'update_customer_note', 'add_customer_tag',
  'transfer_to_agent',
]

const GENERAL_TOOL_NAMES: AgentToolName[] = [
  'search_knowledge_base', 'request_human_agent', 'transfer_to_agent', 'search_products', 'check_stock',
  'get_active_promotions', 'create_quotation', 'accept_quotation', 'create_official_letter',
]

const ROUTED_TOOL_NAMES: AgentToolName[] = [
  ...new Set([...SALES_TOOL_NAMES, ...BOOKING_TOOL_NAMES, ...SUPPORT_TOOL_NAMES, ...GENERAL_TOOL_NAMES]),
]

// Offered on every message whatever the intent guess: keyword routing missed plain
// requests like "ขอ QR หน่อย" or "สั่งออเดอร์ 2 ชิ้น", leaving the model without the
// tool it needed and free to type totals or account numbers itself.
const CORE_SALES_TOOL_NAMES: AgentToolName[] = [
  'search_products', 'check_stock', 'take_order', 'send_payment_qr', 'accept_quotation',
  'apply_custom_discount', 'create_quotation', 'calculate_shipping',
  'search_knowledge_base', 'request_human_agent',
]

function filterTools(names: AgentToolName[]) {
  const wanted = new Set<string>([...names, ...CORE_SALES_TOOL_NAMES])
  return MASTER_TOOLS.filter((t) => wanted.has(t.name))
}

// ─────────────────────────────────────────────────────────────────────────────
// DealMee Brain Engine™: Complexity Classifier & Router
// ─────────────────────────────────────────────────────────────────────────────

// Negotiation/discount keywords — expanded per ROADMAP_AI_AGENT.md §4 step 1
// beyond the original narrow list, to catch more real phrasings without
// needing an extra AI call.
const NEGOTIATION_KEYWORDS = [
  'ลด', 'ส่วนลด', 'ลดได้ไหม', 'ลดอีกไหม', 'แถม', 'ของแถม',
  'แพง', 'แพงกว่า', 'เทียบ', 'ต่อรอง', 'โปรโมชั่นพิเศษ', 'ราคาส่ง', 'เหมา',
  'พอลดได้ไหม', 'ราคาพิเศษ', 'ซื้อเยอะลดไหม', 'งบไม่พอ', 'แพงไป', 'ลดหน่อย', 'ขอราคาพิเศษ',
]

// Hesitation and objection keywords — customer hesitation, quality/trust anxiety,
// fit/suitability concerns, or delivery worries that require consultative sales persuasion.
const HESITATION_AND_OBJECTION_KEYWORDS = [
  // Hesitation / Indecision
  'คิดดูก่อน', 'ขอดูก่อน', 'ยังไม่แน่ใจ', 'ไว้ค่อยดู', 'ดูก่อนนะ', 'ขอปรึกษา', 'ยังไม่ซื้อ', 'ขอคิดดู',
  // Quality / Trust / Safety
  'ของแท้ไหม', 'แท้ไหม', 'ดีจริงไหม', 'เห็นผลไหม', 'มีประกันไหม', 'ประกันกี่วัน', 'กลัวแพ้', 'แพ้ง่าย', 'ปลอดภัยไหม', 'มีอย', 'มีรีวิวไหม', 'น่าเชื่อถือไหม',
  // Suitability / Confusion
  'ใช้ยากไหม', 'เหมาะกับ', 'คนอ้วนใส่ได้ไหม', 'ไซส์ไหนดี', 'แนะนำหน่อย', 'สูตรไหนดี', 'เลือกไม่ถูก',
  // Delivery & Payment hesitation
  'ส่งกี่วัน', 'ส่งช้าไหม', 'ของจะพังไหม', 'กลัวไม่ตรงปก', 'มีเก็บเงินปลายทางไหม', 'เก็บปลายทางได้ไหม', 'กี่วันถึง',
]

/** Complexity score threshold at/above which a message is routed HIGH (high-persuasion model). */
export const HIGH_COMPLEXITY_THRESHOLD = 3

export interface ComplexityScoreInput {
  userQuery: string
  /** Prior customer messages in this conversation, most recent last. Optional — omit if unavailable (e.g. very first message). */
  recentCustomerMessages?: string[]
  /** From Customer Memory Graph: true if tagged VIP or total_spend exceeds the VIP threshold. */
  isVip?: boolean
}

/**
 * Pure, DB-free complexity scoring (ROADMAP_AI_AGENT.md §4 step 2) — unit
 * testable without touching the database or any AI provider. Replaces the
 * old binary "does this message contain a negotiation keyword" check with a
 * cumulative score, so nuance (message length, price figures, hesitation/objections,
 * negotiation signals earlier in the conversation, VIP status) can push a message over
 * the HIGH threshold even without an exact keyword match.
 */
export function computeComplexityScore({
  userQuery,
  recentCustomerMessages = [],
  isVip = false,
}: ComplexityScoreInput): number {
  const text = userQuery.toLowerCase().trim()
  let score = 0

  const matchedNegotiation = NEGOTIATION_KEYWORDS.filter((k) => text.includes(k))
  const matchedObjections = HESITATION_AND_OBJECTION_KEYWORDS.filter((k) => text.includes(k))
  
  // Combine unique matched triggers
  const uniqueMatches = Array.from(new Set([...matchedNegotiation, ...matchedObjections]))
  score += uniqueMatches.length * 2

  if (userQuery.trim().length > 100) score += 1
  if (/\d/.test(userQuery)) score += 1 // mentions a number (likely a price/quantity/size being discussed)

  for (const msg of recentCustomerMessages.slice(-3)) {
    const priorText = msg.toLowerCase()
    if (
      NEGOTIATION_KEYWORDS.some((k) => priorText.includes(k)) ||
      HESITATION_AND_OBJECTION_KEYWORDS.some((k) => priorText.includes(k))
    ) {
      score += 1
    }
  }

  if (isVip) score += 2 // VIP customers get the high-persuasion model even for plain-looking messages

  return score
}

export function classifyMessageComplexity(
  userQuery: string,
  options: { recentCustomerMessages?: string[]; isVip?: boolean } = {}
): {
  complexity: ComplexityLevel
  complexityScore: number
  toolSet: typeof MASTER_TOOLS
  reason: string
} {
  const complexityScore = computeComplexityScore({
    userQuery,
    recentCustomerMessages: options.recentCustomerMessages,
    isVip: options.isVip,
  })
  const isHighComplexity = complexityScore >= HIGH_COMPLEXITY_THRESHOLD

  // One tool set for every message: the shop's Gemini prompt cache holds the
  // tools, so a set chosen per message meant a separate cache (and separate
  // storage bill) for each kind of question. Unused declarations ride in the
  // cache at a tenth of the input price.
  const toolSet = filterTools(ROUTED_TOOL_NAMES)

  if (isHighComplexity) {
    return {
      complexity: 'HIGH',
      complexityScore,
      toolSet,
      reason: `Complexity score ${complexityScore} (>= ${HIGH_COMPLEXITY_THRESHOLD}) → High-persuasion routing`,
    }
  }

  return {
    complexity: 'LOW',
    complexityScore,
    toolSet,
    reason: `Complexity score ${complexityScore} (< ${HIGH_COMPLEXITY_THRESHOLD}) → Standard FAQ/product/booking/support query`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quota Enforcement (Phase 2 — Billing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a shop has used up its monthly AI messages. The limit comes
 * from the plan the shop is entitled to right now (src/lib/billing/planLimits.ts):
 * a trial's own allowance, Free once a trial or a paid plan has lapsed, and -1
 * (BYOK) for unlimited. Once the plan's allowance is used, each further message
 * takes one unit from a message add-on pack bought from the wallet.
 */
export interface QuotaStatus {
  planKey: string
  messagesUsed: number
  messageLimit: number // -1 = unlimited
  isUnlimited: boolean
  /** Units left in unexpired message add-on packs */
  addonMessagesRemaining: number
  isOverQuota: boolean
}

/**
 * Resolves a shop's current-period usage against its plan's message limit.
 * Shared by the webhook's quota gate and the dashboard/Chat Playground so
 * both always agree on the same numbers.
 */
export async function getQuotaStatus(shop: any): Promise<QuotaStatus> {
  const admin = createAdminClient()
  const { planKey, messages: messageLimit } = await getPlanLimits(shop)
  const isUnlimited = messageLimit === -1

  const period = getCurrentPeriod()
  const [{ data: usageRow }, addonMessagesRemaining] = await Promise.all([
    admin
      .from('usage_logs')
      .select('messages_used')
      .eq('shop_id', shop.id)
      .eq('period', period)
      .maybeSingle(),
    isUnlimited ? Promise.resolve(0) : getAddonRemaining(shop.id, 'messages'),
  ])

  const messagesUsed = usageRow ? Number(usageRow.messages_used) : 0

  return {
    planKey,
    messagesUsed,
    messageLimit,
    isUnlimited,
    addonMessagesRemaining,
    isOverQuota: !isUnlimited && messagesUsed >= messageLimit && addonMessagesRemaining <= 0,
  }
}

/**
 * Quota gate for one incoming message. Past the plan's allowance the message is
 * paid for with an add-on unit here (the playground only checks, it isn't billed).
 */
async function isOverQuota(shop: any, isPlayground?: boolean): Promise<boolean> {
  try {
    const status = await getQuotaStatus(shop)
    if (status.isUnlimited || status.messagesUsed < status.messageLimit) return false
    if (isPlayground) return status.isOverQuota
    return !(await consumeAddonCredit(shop.id, 'messages'))
  } catch (err) {
    console.error('[isOverQuota] Exception (fail-open):', err)
    return false // never block a customer's chat due to a quota-check bug
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Agent Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

function quotaExceededResult(language: CustomerLanguage): AgentResult {
  return {
    text: t('quotaExceeded', language),
    quotaExceeded: true,
    immediateMessages: [],
    toolCallsExecuted: [],
    scheduledMessages: [],
  }
}

/**
 * Setup phase shared by both the single-call `processSalesAgentChat` and the
 * two-phase `startSalesAgentPlanning`/`continueSalesAgentPlanning` pair:
 * quota check, context gathering (KB/products/history/customer profile),
 * prompt construction, routing, and the initial turn — everything needed
 * before the first AI call, produced once so it's never duplicated between
 * the two call styles.
 */

async function preparePlanningState({
  shop,
  userQuery,
  userId,
  conversationId,
  conversationHistory,
  toolExecutor,
  supabaseClient,
  isPlayground,
}: SalesAgentRequest): Promise<
  { quotaExceeded: true; language: CustomerLanguage } | { quotaExceeded: false; state: PlanningState }
> {
  if (await isOverQuota(shop, isPlayground)) {
    // Language still matters on this path: the quota notice is the one
    // message a customer gets, and the model never runs to set the tone.
    return { quotaExceeded: true, language: detectCustomerLanguage(userQuery) }
  }

  const db = supabaseClient || supabase

  // A shop that brings its own key (BYOK) uses only that key: it pays for its own AI,
  // so when the key fails the conversation goes to the shop's admin rather than
  // quietly running on the platform's keys. Other shops use the platform's keys
  // (admin page → Vercel → legacy settings rows), Gemini first.
  const shopKey = String(shop?.custom_ai_key || shop?.ai_key || '').trim()
  const shopProvider = String(shop?.custom_ai_provider || shop?.ai_provider || '').toLowerCase()
  const byok = Boolean(shopKey) && ['gemini', 'claude', 'openai'].includes(shopProvider)
  const [geminiKey, claudeKey, openAiKey] = byok
    ? [shopProvider === 'gemini' ? shopKey : '', shopProvider === 'claude' ? shopKey : '', shopProvider === 'openai' ? shopKey : '']
    : await Promise.all([platformSecret('GEMINI_API_KEY'), platformSecret('CLAUDE_API_KEY'), platformSecret('OPENAI_API_KEY')])

  const modelName = shop.custom_ai_model || shop.ai_model || (await platformSecret('GEMINI_MODEL')) || 'gemini-3.8-flash'

  // 1. Knowledge Base — inlined up to a character budget, with the rest
  // reachable through search_knowledge_base. Every entry used to be inlined
  // with no limit, which was survivable while owners typed FAQs by hand but
  // stopped being so once a whole website or PDF could be imported: the
  // entire document would ride along on every customer message and be billed
  // again each turn.
  const { data: knowledgeItems } = await db
    .from('knowledge_base')
    .select('title, content')
    .eq('shop_id', shop.id)
    .or('status.eq.active,status.is.null')
    .order('created_at', { ascending: true })
    .limit(KNOWLEDGE_INLINE_MAX_ITEMS)

  // The knowledge block is built after the chat history below, so it can be
  // narrowed to the entries relevant to what this customer is asking about.
  let knowledgeContext = ''

  // 2. Products
  const features = (shop.features as Record<string, boolean>) || {}
  let productsContext = ''
  if (features.product_recommend !== false) {
    const { data: products } = await db
      .from('products')
      .select('id, name, price, stock, category, description')
      .eq('shop_id', shop.id)
      .limit(30)

    if (products && products.length > 0) {
      productsContext =
        `\n\n[แคตตาล็อกสินค้าของร้าน]\n` +
        products.map((p) => {
          const stockStr = p.stock !== null && p.stock !== undefined ? `${p.stock} ชิ้น` : 'มีพร้อมส่ง'
          const descStr = p.description ? ` (${clipForPrompt(p.description, PRODUCT_DESCRIPTION_MAX_CHARS)})` : ''
          return `- ${p.name}${descStr} [หมวดหมู่: ${p.category || 'ทั่วไป'}]: ${Number(p.price || 0).toLocaleString()} บาท (คงเหลือ: ${stockStr})`
        }).join('\n')
    }
  }

  // 3. Booking Templates
  let bookingContext = ''
  let bookingPromptTemplates: any[] = []
  // Same default as the dashboard: on for booking/service shops unless switched off, off for others unless switched on
  const bookingOn = features.booking_system ?? ['booking', 'service'].includes(String(shop.business_type || ''))
  if (bookingOn) {
    const { data: bookingTemplates } = await db
      .from('services')
      .select('name, booking_type, resource_label, staff_name, duration_minutes, available_days, start_time, end_time, buffer_minutes, capacity_per_slot, required_fields, deposit_amount, description')
      .eq('shop_id', shop.id)
      .neq('status', 'inactive')
      .order('created_at', { ascending: false })
      .limit(12)

    bookingPromptTemplates = bookingTemplates || []
    if (bookingTemplates && bookingTemplates.length > 0) {
      const typeLabel: Record<string, string> = {
        table: 'ร้านอาหาร/จองโต๊ะ',
        service: 'บริการ/นัดหมาย',
        queue: 'จองคิว',
        class: 'คลาส/กิจกรรม',
        consultation: 'นัดปรึกษา',
      }
      const primaryType = bookingTemplates.find((item: any) => item.booking_type === 'table')?.booking_type || bookingTemplates[0].booking_type || 'service'
      bookingContext =
        `

[แม่แบบการจองของร้าน]
บริบทหลักของร้านจากระบบจอง: ${typeLabel[primaryType] || primaryType}
` +
        bookingTemplates.map((item: any) => {
          const resource = item.resource_label || item.staff_name || '-'
          const fields = Array.isArray(item.required_fields) ? item.required_fields.join(', ') : '-'
          const slotInterval = Math.max((Number(item.duration_minutes) || 60) + (Number(item.buffer_minutes) || 0), 15)
          return `- ${item.name} (${typeLabel[item.booking_type] || item.booking_type || 'บริการ'}): ทรัพยากร ${resource}, ระยะเวลา ${item.duration_minutes || 60} นาที, รอบจองทุก ${slotInterval} นาที, ความจุต่อรอบ ${item.capacity_per_slot || 1}, เวลา ${String(item.start_time || '').slice(0, 5)}-${String(item.end_time || '').slice(0, 5)}, ข้อมูลที่ต้องถาม: ${fields}${Number(item.deposit_amount || 0) > 0 ? `, มัดจำ ${Number(item.deposit_amount).toLocaleString()} บาท` : ''}`
        }).join('\n') +
        `

[แนวทางการตอบตามระบบจอง]
- ถ้าบริบทหลักเป็นร้านอาหาร/จองโต๊ะ ให้ทักทายแบบร้านอาหาร เช่น สอบถามการจองโต๊ะ จำนวนท่าน วันที่ และเวลา ไม่ควรเริ่มด้วยการขายสินค้า
- ถ้าลูกค้าทักทายเฉยๆ ให้ตอบโดยอิงบริการจองหลักของร้าน และเสนอช่วยจอง/เช็กเวลาว่าง
- ถ้าลูกค้าต้องการจอง ให้ถามเฉพาะข้อมูลที่ยังขาดตาม required_fields ของแม่แบบนั้น แล้วใช้ check_available_slots ก่อน book_appointment
- ถ้าลูกค้าพูดแค่จำนวนคน/วัน/เวลา แต่ไม่ได้ระบุบริการ ให้ใช้แม่แบบจองหลักจาก [แม่แบบการจองของร้าน] เอง ห้ามปล่อย service ว่างโดยตั้งใจ; สำหรับร้านอาหารให้ใช้จองโต๊ะ และถ้าลูกค้าระบุโซน/ห้อง เช่น ริมน้ำ หรือ ห้องแอร์ ให้ส่งค่า resource ให้ตรงกับแม่แบบนั้น
- เวลาเรียก check_available_slots ต้องส่ง time ที่ลูกค้าถามเข้าไปด้วยเสมอถ้ามี เพื่อให้เครื่องมือตรวจว่าเวลานั้นตรงกับรอบจริงหรือไม่
- เวลาเปิดจองต้องยึดตามผล check_available_slots เท่านั้น ถ้าเครื่องมือบอกว่ารอบเปิดทุก 120 นาที ให้เสนอเฉพาะรอบในรายการ เช่น 11:00, 13:00, 15:00, 17:00 ห้ามเสนอ 14:00 เองถ้าไม่อยู่ในรายการ
- ถ้าลูกค้าขอเวลาที่ไม่อยู่ในสล็อต ให้บอกว่าระบบเปิดเป็นรอบตามเวลาที่ร้านตั้งไว้ และเสนอรอบว่างที่ใกล้ที่สุดจากผลเครื่องมือ
- สำหรับจองโต๊ะ ให้เก็บจำนวนคนใน guest_count และบอกจำนวนท่านในการสรุปการจอง
- งานจองทั่วไปให้ AI จัดการเองเหมือนถือสมุดจองอยู่: เปิดดูด้วย check_booking, เช็กเวลาว่างด้วย check_available_slots, บันทึกด้วย book_appointment, เลื่อนด้วย reschedule_booking, ยกเลิกด้วย cancel_booking
- ห้ามใช้ transfer_to_agent หรือบอกว่าจะส่งให้ BookingAgent สำหรับการจอง/เลื่อน/ยกเลิก/เช็กคิวปกติ เว้นแต่ลูกค้าขอคุยกับคนจริง หรือเครื่องมือคืน error ที่แก้เองไม่ได้
- ห้ามบอกว่าเจ้าหน้าที่จะติดต่อกลับแทนการจอง ให้บันทึกเองด้วย book_appointment ตาม [Booking Pipeline]
- ถ้ายังไม่มีเลขที่การจอง ให้ใช้ชื่อ เบอร์โทร วัน/เวลาเดิม หรือรายการล่าสุดในบทสนทนาเพื่อ check_booking/ดำเนินการต่อ ถ้าพบหลายรายการค่อยถามให้ลูกค้าเลือกเลขที่การจอง
- ถ้าลูกค้าขอเปลี่ยนเวลา ให้เช็กเวลาว่างใหม่ แล้วเรียก reschedule_booking พร้อมข้อมูลระบุรายการเดิมและ new_date, new_time`
    }
  }
  // 3. Chat History
  let historyContext = ''
  // Prior customer messages only (not bot replies), most recent last — fed
  // into the Model Router's complexity scoring below so negotiation signals
  // earlier in the conversation still count even if the current message is
  // just "ok" or "yes". Populated from whichever history source is in use.
  let recentCustomerMessages: string[] = []

  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-10)
    historyContext =
      `\n\n[ประวัติบทสนทนาล่าสุด]\n` +
      recent.map((m) => `${m.sender === 'user' ? 'ลูกค้า' : 'AI'}: ${clipForPrompt(m.text, HISTORY_LINE_MAX_CHARS)}`).join('\n')
    recentCustomerMessages = recent.filter((m) => m.sender === 'user').map((m) => m.text)
  } else {
    const { data: recentMessages } = await db
      .from('chat_messages')
      .select('sender_type, message, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentMessages && recentMessages.length > 0) {
      const ordered = [...recentMessages].reverse()
      historyContext =
        `\n\n[ประวัติบทสนทนาล่าสุด]\n` +
        ordered.map((m) => `${m.sender_type === 'user' ? 'ลูกค้า' : 'AI'}: ${clipForPrompt(m.message, HISTORY_LINE_MAX_CHARS)}`).join('\n')
      recentCustomerMessages = ordered.filter((m) => m.sender_type === 'user').map((m) => m.message)
    }
  }

  // Knowledge base: inline only the entries related to this conversation
  // (whole KB when it is small); everything else via search_knowledge_base.
  if (knowledgeItems && knowledgeItems.length > 0) {
    const { blocks, omitted } = selectRelevantKnowledge(knowledgeItems, userQuery, recentCustomerMessages)
    knowledgeContext =
      `\n\n[คลังข้อมูลความรู้ของร้าน (เฉพาะส่วนที่เกี่ยวข้อง)]\n` +
      blocks.join('\n\n') +
      (omitted > 0
        ? `\n\n(ยังมีข้อมูลอีก ${omitted} ข้อที่ไม่ได้แสดงตรงนี้ ถ้าลูกค้าถามเรื่องที่ไม่มีข้างบน ให้เรียก search_knowledge_base ค้นหาก่อนตอบว่าไม่รู้)`
        : '')
  }

  // 4. Payment Info
  const promptpayId = shop.promptpay_id || shop.promptpay_number
  let paymentInfo = ''
  if (promptpayId || shop.bank_account_number) {
    paymentInfo = `\n\n[ช่องทางชำระเงิน]
- พร้อมเพย์: ${promptpayId || 'ไม่ระบุ'} (${shop.promptpay_name || shop.name})
- ธนาคาร: ${shop.bank_name || '-'} เลขบัญชี: ${shop.bank_account_number || '-'} ชื่อ: ${shop.bank_account_name || shop.name}`
  }

  // 5. Customer Profile (Customer Memory Graph) — auto-injected, no tool call
  // needed. Fetched once and reused both for the prompt context text below
  // and for the Model Router's VIP check, to avoid querying customer_profiles twice.
  const customerProfileSummary = await getCustomerProfileSummary(shop.id, userId)
  const customerProfileContext = formatCustomerProfileContext(customerProfileSummary)
  const isVipCustomer = isVipProfile(customerProfileSummary)

  // 5b. This customer's real bookings. Without this the model has no way to
  // tell a booking it actually saved from one it merely described, and it
  // has been observed announcing "จองเรียบร้อยแล้ว" for a booking that was
  // never written. Stating the truth up front makes that claim contradict
  // its own context instead of being unconstrained.
  let bookingStateContext = ''
  if (features.booking_system !== false) {
    const { data: myBookings } = await db
      .from('bookings')
      .select('booking_no, service_name, booking_date, booking_time, guest_count, customer_name, phone, status')
      .eq('shop_id', shop.id)
      .neq('status', 'cancelled')
      .contains('metadata', { line_user_id: userId })
      .order('created_at', { ascending: false })
      .limit(5)

    bookingStateContext = myBookings?.length
      ? `\n\n[การจองที่บันทึกจริงแล้วของลูกค้ารายนี้]\n` +
        myBookings.map((b: any) =>
          `- ${b.booking_no}: ${b.service_name || '-'} ${b.booking_date} ${String(b.booking_time || '').slice(0, 5)} น.` +
          `${b.guest_count ? ` ${b.guest_count} ท่าน` : ''} (${b.customer_name || '-'} ${b.phone || '-'}) สถานะ ${b.status}`
        ).join('\n') +
        `\n(ใช้เลขที่จองจากรายการนี้เท่านั้น ห้ามแต่งเลขใหม่)`
      : `\n\n[การจองที่บันทึกจริงแล้วของลูกค้ารายนี้]\nยังไม่มีการจองที่บันทึกจริงเลย — ถ้ายังไม่ได้เรียก book_appointment สำเร็จในเทิร์นนี้ ห้ามบอกลูกค้าว่าจองเรียบร้อยแล้วเด็ดขาด และไม่มีรายการให้ยกเลิก/เลื่อน`
  }

  // 5c. Same grounding for the retail side: the model was equally free to
  // announce an order it had never created, and now has real order numbers
  // to quote instead of inventing one.
  const { data: myOrders } = await db
    .from('orders')
    .select('order_no, product_name, quantity, total_amount, status, payment_status')
    .eq('shop_id', shop.id)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(5)

  const orderStateContext = myOrders?.length
    ? `\n\n[ออเดอร์ที่บันทึกจริงแล้วของลูกค้ารายนี้]\n` +
      myOrders.map((o: any) =>
        `- ${o.order_no}: ${o.product_name || '-'}${o.quantity ? ` x${o.quantity}` : ''} ` +
        `${Number(o.total_amount || 0).toLocaleString()} บาท (สถานะ ${o.status}, ชำระเงิน ${o.payment_status || '-'})`
      ).join('\n') +
      `\n(ใช้เลขที่ออเดอร์จากรายการนี้เท่านั้น ห้ามแต่งเลขใหม่)`
    : `\n\n[ออเดอร์ที่บันทึกจริงแล้วของลูกค้ารายนี้]\nยังไม่มีออเดอร์ที่บันทึกจริงเลย — ถ้ายังไม่ได้เรียก take_order สำเร็จในเทิร์นนี้ ห้ามบอกลูกค้าว่ารับออเดอร์แล้วเด็ดขาด`

  // 5d. Grounding for Quotations & Invoices: allows AI to answer queries about
  // active quotations, items, pricing, discounts, and payment details
  let documentStateContext = ''
  try {
    const { data: myDocuments } = await db
      .from('documents')
      .select('doc_number, doc_no, doc_type, customer_name, customer_phone, total_amount, status, items, notes, created_at')
      .eq('shop_id', shop.id)
      // Only this conversation's documents: listing the shop's latest documents put other
      // customers' names, phone numbers and totals into every customer's prompt.
      .eq('customer_info->>conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(6)

    if (myDocuments && myDocuments.length > 0) {
      documentStateContext =
        `\n\n[ใบเสนอราคาและใบแจ้งหนี้ของลูกค้ารายนี้]\n` +
        myDocuments.map((d: any) => {
          const no = d.doc_number || d.doc_no || 'DOC'
          const typeStr = d.doc_type === 'invoice' ? 'ใบแจ้งหนี้ (Invoice)' : d.doc_type === 'sales_order' ? 'ใบสั่งขาย (Sales Order)' : 'ใบเสนอราคา (Quotation)'
          const statusStr = d.status === 'accepted' ? 'อนุมัติแล้ว (Accepted)' : d.status === 'pending_payment' ? 'รอชำระเงิน' : 'รออนุมัติ'
          const itemsList = Array.isArray(d.items)
            ? d.items.map((it: any) => `${it.name || 'สินค้า'} (x${it.qty || 1} @ ฿${Number(it.price || 0).toLocaleString()})`).join(', ')
            : '-'
          return `- ${typeStr} ${no} (ลูกค้า: ${d.customer_name || '-'}) ยอด: ฿${Number(d.total_amount || 0).toLocaleString()} บ. [สถานะ: ${statusStr}] รายการ: [${itemsList}]`
        }).join('\n') +
        `\n(ถ้าลูกค้าถามเกี่ยวกับใบเสนอราคา, ยอดเงินในใบแจ้งหนี้, รายการสินค้า, หรือการชำระเงินตามบิล ให้ตอบตามข้อมูลเอกสารข้างต้นอย่างสุภาพและถูกต้อง)`
    }
  } catch (docErr) {
    console.warn('[salesAgentEngine] Could not load documents context:', docErr)
  }

  // 5. System Instruction — split into a static block (stable per shop:
  // identity, knowledge base, products, payment info) and a dynamic block
  // (customer profile, chat history — changes per customer/message). This
  // split only matters for Claude's explicit prompt caching (callClaudeApi
  // tags the static block cache_control so it's billed once per window
  // instead of every message); Gemini/OpenAI keep receiving them combined
  // since Gemini's caching is automatic regardless of structure and OpenAI
  // isn't currently reachable by the routing below.
  const activeBotName = (shop.bot_name && !/botify/i.test(shop.bot_name)) ? shop.bot_name : 'น้อง DealMee'
  const staticSystemPrompt = `คุณคือ "${activeBotName}" พนักงานขาย AI อัจฉริยะและผู้จัดการร้านมืออาชีพประจำร้าน "${shop.name}"
บุคลิกภาพ: ${shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ เป็นมิตรและมีไหวพริบในการขายสูง'}
คำอธิบายร้าน: ${shop.description || 'ร้านค้าออนไลน์'}

[Master Consultative Sales Psychology & Active Closing Rules]
คุณคือสุดยอดพนักงานขายมืออาชีพ (Consultative Sales Closer) ที่มีไหวพริบ ไม่ใช่แค่บอทถามคำตอบคำ (ห้าม Passive):
1. [Always End with a Bridge Question - กฎถามต่อเพื่อคุมเกมเสมอ]
- ห้ามตอบข้อมูล ราคา หรือสต็อกแบบทื่อๆ แล้วตัดจบประโยคเด็ดขาด เพราะจะทำให้ลูกค้าอ่านแล้วเงียบหาย
- ทุกครั้งที่ตอบข้อมูล ต้องลงท้ายด้วยคำถาม 1 คำถามที่ตอบง่าย (Low cognitive load) เพื่อนำทางลูกค้าสู่ขั้นถัดไปเสมอ:
  - ขั้นค้นหาความต้องการ: ถามเพื่อวินิจฉัยปัญหาหรือความชอบ (เช่น "คุณลูกค้าตั้งใจนำไปใช้งานด้านไหนเป็นพิเศษคะ?", "ชอบเนื้อสัมผัสแบบบางเบาหรือเน้นชุ่มชื้นเป็นพิเศษคะ?")
  - ขั้นตอบราคา/สเปก: ถามเพื่อพาไปสู่การตัดสินใจ (เช่น "สะดวกรับเป็นไซส์ L หรือ XL ดีคะ?", "รับเป็น 1 ชิ้น หรือรับเป็นเซ็ต 2 ชิ้นสุดคุ้มส่งฟรีดีคะ?")

2. [SPIN Discovery & Diagnostic Selling - วินิจฉัยก่อนขาย]
- หากลูกค้าถามกว้างๆ เช่น "ขอรายละเอียดสินค้า", "มีอะไรบ้าง", "ราคาเท่าไหร่" ห้ามขนสินค้าทั้งหมดมาวางทับ ให้ทักทายอย่างเป็นมิตรพร้อมถาม 1 คำถามเพื่อเจาะจงความต้องการ แล้วเลือกเสนอเพียง 1-2 รายการที่ตรงจุดที่สุด
- ชูคุณค่าและจุดเด่น (Value Proposition) ที่แก้ปัญหาให้ลูกค้ารายนั้นโดยเฉพาะ ไม่ใช่แค่บอกฟีเจอร์สินค้า

3. [Proactive Objection & Hesitation Handling Matrix - จัดการข้อกังวล 4 ด้าน]
เมื่อสัมผัสได้ว่าลูกค้ากำลังลังเล ถามคำถามเชิงกังวล หรือพูดว่า "ขอดูก่อน/คิดดูก่อน" ให้คลี่คลายอย่างจริงใจและนุ่มนวล:
- [กังวลเรื่องราคา / คิดว่าแพง / ขอดูก่อน]: ชี้ความคุ้มค่าระยะยาว (Cost-per-use) + เสนอโปรโมชั่น/ของแถม หรือแนะนำรุ่นรอง (Downsell) ที่ราคาเป็นมิตรและตอบโจทย์ได้เช่นกัน
- [กังวลเรื่องคุณภาพ / ของแท้ / เห็นผลจริงไหม]: เสริม Social Proof ทันที เช่น เป็นรุ่นยอดนิยม ลูกค้ากว่า 90% ซื้อซ้ำ มีรีวิวแน่น และทางร้านมีนโยบายรับประกันสินค้า
- [กังวลเรื่องการเลือกไซส์ / สูตรที่เหมาะ]: อาสาช่วยเทียบสเปกทันที ("คุณลูกค้าสูง/หนัก หรือมีสภาพผิวแบบไหนคะ เดี๋ยวแอดมินช่วยแนะนำสูตร/ไซส์ที่เป๊ะที่สุดให้ค่ะ")
- [กังวลเรื่องการจัดส่ง / ความปลอดภัย]: แจ้งรอบจัดส่งด่วน มีเลขพัสดุติดตาม และมีช่องทางชำระเงินที่สบายใจ (เช่น โอนสแกน QR หรือ เก็บเงินปลายทาง)

4. [Assumptive & Alternative Choice Close - ตะล่อมปิดการขายด้วยตัวเลือก]
- หลีกเลี่ยงการถามเปิดช่องปฏิเสธ เช่น "รับไหมคะ?"
- ให้ใช้เทคนิคปิดการขายด้วยตัวเลือก 2 ทาง (Alternative Close) เสมอ เช่น:
  - "คุณลูกค้ารับเป็น สีขาว หรือ สีดำ ดีคะ?"
  - "รับเป็น 1 กล่อง หรือเซ็ต 2 กล่องโปรส่งฟรีดีคะ?"
  - "สะดวกชำระเป็น โอนสแกน QR พร้อมเพย์ หรือ เก็บเงินปลายทาง ดีคะ?"

5. [Ethical Urgency & Value Stacking - กระตุ้นการตัดสินใจอย่างสมเหตุสมผล]
- แจ้งสิทธิประโยชน์ทันที เช่น "รอบส่งวันนี้ตัดรอบ 14:00 น. หากคอนเฟิร์มตอนนี้แอดมินจะรีบล็อกสิทธิ์ส่งฟรีรอบวันนี้ให้เลยค่ะ"

6. [Product Card & Flex Carousel Display]
- เมื่อลูกค้าถามถึงสินค้า ขอดูสินค้า ขอดูรูปภาพ หรือสนใจสินค้าประเภทใดประเภทหนึ่งชัดเจน (เช่น "มีเสื้อยืดไหม", "ขอดูกางเกงหน่อย", "มีสินค้าอะไรบ้าง", "มีรูปไหม") คุณต้องเรียกใช้ Tool "search_products" เพื่อให้ระบบดึงข้อมูลและแสดงผลเป็นการ์ดรูปภาพสินค้าความละเอียดสูง (LINE Flex Carousel) ให้ลูกค้าดูทาง LINE!
- แต่ถ้าลูกค้ากำลังขอใบเสนอราคา ขอหนังสือราชการ จองคิว หรือถามคำถามทั่วไปที่ไม่เกี่ยวกับสินค้าในสต็อก **ห้ามเรียก search_products และห้ามส่งการ์ดสินค้าเด็ดขาด**

7. [Product Bundling & Upsell Synergy]
- เมื่อลูกค้าสนใจสินค้าชิ้นใดชิ้นหนึ่ง ให้เสนอสินค้าที่ใช้คู่กันแล้วผลลัพธ์ดียิ่งขึ้น (Product Match) หรือข้อเสนอแบบจัดเซตที่คุ้มค่ากว่าเสมอ

8. [Quotation & Document Request - กฎออกเอกสารทันที สำคัญที่สุด]
- เมื่อลูกค้าขอใบเสนอราคา (เช่น "ขอใบเสนอราคา...", "ออกใบเสนอราคาให้หน่อย") และให้ชื่อ หรือเบอร์โทร หรือระบุสิ่งที่ต้องการมาแล้ว ให้ถือว่าพร้อมออกเอกสาร คุณต้องเรียกใช้เครื่องมือ "create_quotation" ทันทีในเทิร์นนั้นเลย!
  * **ห้ามผัดวันประกันพรุ่ง และห้ามถามคำถามซ้ำวนไปวนมาจนไม่ได้ออกเอกสารเด็ดขาด** กฎออกใบเสนอราคามีความสำคัญสูงสุดเหนือการซักถามทั่วไป
  * นำชื่อลูกค้าและเบอร์โทรที่ลูกค้าให้มาใส่ใน "customer_name" และ "customer_phone" ทันที
  * หากลูกค้าเอ่ยชื่อแพ็กเกจหรือบริการ (เช่น "แพ็คเกจ Pro 1 ชิ้น", "แพ็กเกจ Starter", "แพ็กเกจ มาตรฐาน"):
    - ใส่ชื่อใน items ให้ตรงกับรายการใน [แคตตาล็อกสินค้าของร้าน] ที่ใกล้เคียงที่สุด (ระบบดึงราคาจากแคตตาล็อกเอง) แล้วออกใบเสนอราคาทันที ถ้าไม่มีรายการนั้นในแคตตาล็อก ให้ถามลูกค้าว่าหมายถึงรายการไหนในแคตตาล็อก
    - ในข้อความตอบกลับ ให้แจ้งสรุปว่าระบบได้ออกใบเสนอราคาให้เรียบร้อยแล้ว แตะดู PDF หรือดาวน์โหลด Word/Excel ได้ทันที และหากต้องการปรับเปลี่ยนจำนวนพนักงานหรือสเปกเพิ่มเติม สามารถแจ้งเพื่อปรับปรุงใบเสนอราคาได้ตลอดเวลา
- เมื่อลูกค้าขอหนังสือราชการ (เช่น "ออกหนังสือราชการ...", "ร่างบันทึกข้อความ...") ให้เรียกใช้เครื่องมือ "create_official_letter" ทันที เพื่อร่างหนังสือราชการภายนอกตามระเบียบงานสารบรรณ พร้อมตราครุฑ ลิงก์ดู A4 และปุ่มดาวน์โหลดไฟล์ Word (.docx)
- กฎเด็ดขาด: ขณะที่ออกใบเสนอราคาหรือหนังสือราชการ **ห้ามแนะนำสินค้าทั่วไปที่ไม่เกี่ยวข้อง (เช่น เสื้อผ้า กางเกง) เด็ดขาด**

[Store Manager Operating Mode]
คุณไม่ใช่แค่บอทตอบคำถาม แต่เป็นผู้จัดการร้าน AI ที่ถือสมุดงานของร้านไว้เอง ต้องคิด วางแผน และลงมือด้วยเครื่องมือที่มี โดยยังอยู่ในกรอบข้อมูลจริงของร้าน
- จัดการงานขาย: แนะนำสินค้า เช็กสต็อก สรุปออเดอร์ ปิดการขาย ส่งข้อมูลชำระเงิน และติดตามหลังการขาย
- จัดการงานจอง/คิว/นัดหมาย: เปิดดูเวลาว่าง บันทึกจองจริง เลื่อน ยกเลิก และตรวจสอบรายการจองด้วยเครื่องมือเอง ห้ามโยนไปหา BookingAgent สำหรับงานปกติ
- จัดการลูกค้า: ใช้ประวัติ ความชอบ แท็ก และบันทึกลูกค้าเพื่อทำให้บทสนทนาต่อเนื่องขึ้น แต่ห้ามแต่งข้อมูลที่ฐานข้อมูลไม่มี
- ตัดสินใจแบบผู้จัดการร้าน: ถ้าข้อมูลครบและเครื่องมือรองรับ ให้ลงมือทันที ถ้าข้อมูลขาด ให้ถามเฉพาะช่องที่ขาด ถ้าเครื่องมือ error หรือเรื่องเสี่ยง ให้ค่อยเรียกคนจริง
- หลังเรียกเครื่องมือสำเร็จ ให้ยืนยันด้วยข้อมูลจริงจากผลเครื่องมือ เช่น เลขที่จอง เลขออเดอร์ วัน เวลา จำนวนคน/จำนวนสินค้า ชื่อ เบอร์ และขั้นตอนถัดไป

[Sales Pipeline]
1. [Greeting & Discovery] ทักทาย สังเกตความประสงค์ และถามความต้องการเฉพาะ 1 ข้อเพื่อคัดเลือกสินค้าที่ใช่ที่สุด
2. [Showcase & Value] แนะนำสินค้า ชูจุดเด่นที่ตรงกับปัญหาของลูกค้า พร้อมจบด้วย Bridge Question นำทางสู่ตัวเลือก
3. [Closing & Choice Offer] เสนอตัวเลือกปิดการขาย (Alternative Close) เมื่อลูกค้าตอบรับ เช่น "เอาเลย", "รับ 1 ตัว", "ซื้อเลย", "สั่ง" ให้ตรวจสต็อก/ราคาก่อนถ้ายังไม่แน่ใจ แล้วถามข้อมูลที่ยังขาดให้ครบ: ชื่อ, เบอร์โทร, ที่อยู่จัดส่ง, วิธีชำระเงิน
4. [Order Creation] เมื่อข้อมูลครบและลูกค้าตกลงซื้อแล้ว ให้เรียก Tool "take_order" ก่อน จากนั้นจึงส่งช่องทางชำระเงินหรือเรียก "send_payment_qr" ตามความเหมาะสม
5. [Payment Close] หลังสร้าง/ยืนยันออเดอร์ ให้สรุปข้อมูลปิดการขายครบทุกครั้ง: เลขที่ออเดอร์ (จาก tool), รายการสินค้า, ยอดสุทธิ, ชื่อผู้รับ, เบอร์โทร, ที่อยู่จัดส่ง, วิธีชำระเงิน และขั้นตอนส่งสลิป
   - ทุกครั้งที่บอกว่ารับออเดอร์แล้ว ต้องมี "เลขที่ออเดอร์" ที่ได้จากผลเครื่องมือเสมอ ถ้าไม่มีเลขที่ออเดอร์แปลว่ายังไม่ได้บันทึกจริง ห้ามบอกว่าเรียบร้อยแล้ว
   - ลูกค้าใช้เลขที่ออเดอร์นี้เช็คสถานะภายหลัง จึงต้องแจ้งให้ชัดและไม่แต่งเลขขึ้นเอง
6. [Post-Sales] ขอบคุณอย่างอบอุ่น + แนะนำให้ส่งรูปสลิปกลับมาในแชทเพื่อตรวจสอบยอดอัตโนมัติ

[Booking Pipeline]
1. [Availability] ลูกค้าถามถึงวัน/เวลา/จำนวนคน ให้เรียก check_available_slots ทันที พร้อมส่ง time ที่ลูกค้าถามไปด้วยถ้ามี
2. [Collect] เก็บข้อมูลที่ยังขาดตาม required_fields ของแม่แบบนั้น ถามเฉพาะช่องที่ขาด ห้ามถามซ้ำสิ่งที่ลูกค้าตอบไปแล้วในบทสนทนา
3. [Booking Creation] ทันทีที่มี วันที่ + เวลา (ที่อยู่ในรอบว่างจริง) + จำนวนคน + ชื่อ + เบอร์โทร ครบแล้ว ให้เรียก Tool "book_appointment" ทันทีในเทิร์นนั้นเลย
   - ห้ามพิมพ์สรุปการจองก่อนเรียก book_appointment เด็ดขาด เพราะการจองจะยังไม่ถูกบันทึกจริง
   - ถ้าลูกค้าตอบข้อมูลที่ขาดมาครบในข้อความเดียว (เช่น "แจ็ค 0955851136 โซนริมน้ำ") ให้ถือว่าครบแล้ว เรียก book_appointment เลย ไม่ต้องถามยืนยันซ้ำ
4. [Confirm] หลัง book_appointment สำเร็จ จึงสรุปจากผลเครื่องมือจริง: เลขที่จอง, บริการ/โซน, วัน, เวลา, จำนวนคน, ชื่อ, เบอร์โทร
   - ทุกครั้งที่บอกว่าจองสำเร็จ ต้องมี "เลขที่จอง" ที่ได้จากผลเครื่องมือเสมอ ถ้าไม่มีเลขที่จองแปลว่ายังไม่ได้จองจริง ห้ามบอกว่าเรียบร้อยแล้ว
5. [Change] เลื่อน/ยกเลิก ต้องเรียก reschedule_booking / cancel_booking ให้สำเร็จก่อนจึงบอกลูกค้าว่าเรียบร้อย

[แยกคำถามออกจากคำสั่ง — สำคัญมาก]
คำถามที่ถามถึง "วิธีการ" ไม่ใช่คำสั่งให้ลงมือ ห้ามเรียกเครื่องมือที่เปลี่ยนแปลงข้อมูลจากคำถามพวกนี้
- "ยกเลิกการจองต้องทำยังไง", "ยกเลิกได้ไหม", "มีค่าปรับไหม" = ลูกค้าถามขั้นตอน ให้อธิบายวิธีและถามว่าต้องการให้ยกเลิกเลยหรือไม่ ห้ามเรียก cancel_booking
- "ยกเลิกการจองให้หน่อย", "ไม่ไปแล้วครับ ยกเลิกเลย" = คำสั่งจริง ให้ยืนยันรายการที่จะยกเลิกก่อน แล้วจึงเรียก cancel_booking
- หลักเดียวกันนี้ใช้กับ reschedule_booking และ take_order ด้วย

[กฎสำคัญ]
- ตอบด้วย "ภาษาเดียวกับที่ลูกค้าพิมพ์มา" เสมอ ลูกค้าพิมพ์ไทยตอบไทย พิมพ์อังกฤษตอบอังกฤษ พิมพ์จีนตอบจีน ห้ามสลับภาษากลางบทสนทนาเว้นแต่ลูกค้าสลับก่อน
- รักษาความสุภาพแบบเดียวกันในทุกภาษา และตอบกระชับ ไม่เกิน 10 บรรทัด
- ชื่อสินค้า ชื่อบริการ และชื่อร้าน ให้คงตามที่บันทึกไว้ในฐานข้อมูล ห้ามแปล เพราะลูกค้าต้องใช้ชื่อนั้นสื่อสารกับร้าน
- ใช้ Tools ที่จำเป็นให้ถูกต้อง อย่าตอบเดา
- ห้ามพิมพ์หัวข้อสรุปแล้วปล่อยค่าว่าง เช่น "- **" ถ้ายังไม่มีข้อมูลจริง ให้ถามหรือเรียกเครื่องมือแทน
- ถ้าลูกค้าให้ชื่อ/เบอร์/ที่อยู่แล้ว ให้สรุปข้อมูลเหล่านั้นกลับให้ครบ อย่าละไว้หรือแทนด้วยหัวข้อว่าง
- ตอบเป็น plain text ล้วนเสมอ ห้ามใช้ markdown ทุกชนิด (ตัวหนาด้วยดอกจันคู่, ตัวเอียงด้วยดอกจันเดี่ยว, code ด้วย backtick, หัวข้อด้วย #) เพราะ LINE ไม่แปลงให้ ลูกค้าจะเห็นเครื่องหมายพวกนี้ติดมาจริงๆ ถ้าอยากเน้น ให้ขึ้นบรรทัดใหม่หรือใช้อีโมจินำหน้าแทน
- ถ้ายังขาดวิธีชำระเงิน ให้เสนอทางเลือกจากข้อมูลร้าน เช่น พร้อมเพย์/โอนธนาคาร/เก็บปลายทาง แล้วถามให้ลูกค้าเลือก ก่อนเรียก take_order
- ห้ามสรุปว่ารับออเดอร์แล้วถ้ายังไม่ได้เรียก take_order หรือข้อมูลลูกค้ายังไม่ครบ ให้ถามเฉพาะข้อมูลที่ขาดแทน
- ถ้าไม่มีข้อมูล ให้แจ้งลูกค้าให้รอแอดมินหรือเรียก request_human_agent
${productsContext}
${buildBusinessPromptContext(shop, bookingPromptTemplates)}${bookingContext}
${paymentInfo}`

  // 5d. Sales Workflow Stage Context
  let initialSalesStage: SalesStage = 'greeting'
  let lastMessageAt: string | null = null
  if (conversationId) {
    const { data: convData } = await db
      .from('conversations')
      .select('sales_stage, last_message_at')
      .eq('id', conversationId)
      .single()

    if (convData) {
      initialSalesStage = (convData.sales_stage as SalesStage) || 'greeting'
      lastMessageAt = convData.last_message_at
    }
  }

  const salesStageContext = formatSalesStagePromptContext(initialSalesStage)

  // 5e. Golden Closers (Few-Shot Winning Sales Trajectories)
  const goldenTrajectories = await retrieveWinningTrajectories({
    shopId: shop.id,
    userQuery,
    limit: 2,
  })
  const goldenClosersContext = formatGoldenClosersPromptContext(goldenTrajectories)

  const dynamicSystemPrompt = `${salesStageContext}${goldenClosersContext ? `\n\n${goldenClosersContext}` : ''}
${knowledgeContext}${customerProfileContext}${bookingStateContext}${orderStateContext}${documentStateContext}${businessHoursPromptContext(shop.features)}
${historyContext}`

  // Free plan (incl. ended trials): sales automation is locked and orders go to the admin
  const salesLocked = !salesAutomationEnabled(shop)
  const systemInstruction = `${staticSystemPrompt}\n${dynamicSystemPrompt}${salesLocked ? SALES_LOCKED_PROMPT : ''}`

  // 6. Route
  const routing = classifyMessageComplexity(userQuery, {
    recentCustomerMessages,
    isVip: isVipCustomer,
  })
  if (salesLocked) {
    routing.toolSet = routing.toolSet.filter((t) => !SALES_AUTOMATION_TOOLS.has(t.name))
  }
  console.log(
    `[DealMee Brain™] "${userQuery}" | ${routing.complexity} (score ${routing.complexityScore}) | Tools: ${routing.toolSet.length}${isVipCustomer ? ' | VIP customer' : ''} | Stage: ${initialSalesStage}`
  )

  // Prompt size by section, to see what each planning step resends (staticTotal includes products and booking)
  const sectionSizes: Record<string, number> = {
    staticTotal: staticSystemPrompt.length, products: productsContext.length, booking: bookingContext.length,
    knowledge: knowledgeContext.length, history: historyContext.length, golden: goldenClosersContext.length,
    customer: customerProfileContext.length, state: bookingStateContext.length + orderStateContext.length + documentStateContext.length,
  }
  console.log(`[Prompt size] ${systemInstruction.length} chars: ` + Object.entries(sectionSizes).map(([k, v]) => `${k} ${v}`).join(', '))

  const language = detectCustomerLanguage(userQuery)

  const executor: ToolExecutor = toolExecutor || realExecuteTool
  const toolCtx: ToolExecutionContext = {
    shopId: shop.id,
    userId,
    conversationId,
    language,
    shop,
    supabase: db,
    supabaseAdmin: createAdminClient(),
  }

  return {
    quotaExceeded: false,
    state: {
      shop,
      conversationId,
      salesStage: initialSalesStage,
      language,
      turns: [{ role: 'user', text: userQuery }],
      step: 0,
      routing,
      executor,
      toolCtx,
      staticSystemPrompt,
      dynamicSystemPrompt: `${dynamicSystemPrompt}${salesLocked ? SALES_LOCKED_PROMPT : ''}`,
      systemInstruction,
      modelName,
      geminiKey,
      claudeKey,
      openAiKey,
      byok,
      allUsage: [],
      immediateMessages: [],
      toolCallsExecuted: [],
      scheduledMessages: [],
      isPlayground: isPlayground || false,
    },
  }
}

/** How long a provider may take before the next one is tried */
const GEMINI_TIMEOUT_MS = 12_000
const FALLBACK_TIMEOUT_MS = 15_000

function isTimeout(err: any): boolean {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError'
}

async function callCurrentStep(state: PlanningState): Promise<ProviderStepResult | null> {
  const { routing, staticSystemPrompt, dynamicSystemPrompt, systemInstruction, turns, claudeKey, openAiKey, geminiKey, modelName } = state

  // On the final step, disable tools so the model synthesizes a customer-facing text answer
  const activeToolSet = state.step >= MAX_PLANNING_STEPS - 1 ? [] : routing.toolSet

  // 1. Primary Engine: Gemini 3.8 Flash (High Speed & Accurate Tool Calling)
  if (geminiKey) {
    const result = await callGeminiApi(systemInstruction, turns, modelName, geminiKey, activeToolSet, state)
    if (result) return result
  }

  // 2. Disaster Recovery Failover: ChatGPT (OpenAI) if Gemini fails
  if (openAiKey) {
    console.warn(`[Failover] Gemini unavailable or failed for shop "${state.shop.name}", failing over to ChatGPT (OpenAI)...`)
    const result = await callOpenAiApi(systemInstruction, turns, openAiKey, activeToolSet, state)
    if (result) return result
  }

  // 3. Fallback: Anthropic Claude (if configured)
  if (claudeKey) {
    const result = await callClaudeApi(staticSystemPrompt, dynamicSystemPrompt, turns, claudeKey, activeToolSet, state)
    if (result) return result
  }

  return null
}

/**
 * Runs exactly one planning-loop step (one AI call, plus the tool it asks
 * for if any), mutating `state` in place. Split out from the loop itself so
 * the webhook route can run just step 0, decide sync-vs-async based on
 * whether it's done, and hand the same state to `continueSalesAgentPlanning`
 * for the remaining steps if not.
 */
async function runPlanningStep(state: PlanningState): Promise<{ done: true; finalText: string } | { done: false }> {
  const response = await callCurrentStep(state)

  if (!response) {
    // All configured providers failed this step
    const hasAnyKey = !!(state.geminiKey || state.claudeKey || state.openAiKey)
    const errDetail = state.lastProviderError || (!hasAnyKey ? 'ยังไม่ได้ตั้งค่า API Key ของ AI ในระบบ (กรุณาตั้งค่า GEMINI_API_KEY)' : 'AI Provider ขัดข้องชั่วคราว')

    console.error(`[DealMee Planning Loop] All providers failed for shop "${state.shop.name}":`, errDetail)

    // The playground is the owner testing: show what went wrong
    if (state.isPlayground) {
      return { done: true, finalText: `ขออภัยค่ะ ระบบ AI ไม่สามารถตอบกลับได้ในขณะนี้ (${errDetail})` }
    }

    // A customer never sees provider errors. The chat goes to the shop's admin
    // (human mode + LINE alert, same as request_human_agent) and the customer is told so.
    const reason = state.byok
      ? 'AI key ของร้าน (BYOK) ใช้งานไม่ได้ บอทจึงตอบลูกค้าไม่ได้ กรุณาตรวจสอบ key ที่หน้าตั้งค่าบอท'
      : 'ระบบ AI ตอบกลับไม่ได้ชั่วคราว บอทจึงส่งลูกค้าคนนี้ให้แอดมินดูแล'
    try {
      await state.executor('request_human_agent', { reason }, state.toolCtx)
    } catch (handoffErr) {
      console.error('[DealMee Planning Loop] handoff after provider failure failed:', handoffErr)
    }
    const finalText = state.language === 'en'
      ? 'Sorry, our automatic replies are having a problem right now. An admin will get back to you shortly 🙏'
      : 'ขออภัยค่ะ ตอนนี้ระบบตอบกลับอัตโนมัติขัดข้องชั่วคราว แอดมินจะรีบตอบกลับนะคะ 🙏'
    return { done: true, finalText }
  }

  if (response.usage) state.allUsage.push(response.usage)

  if (!response.toolCall) {
    // A truncated reply is a half-written sentence, not an answer — sending
    // it would show the customer something like "ขอสรุปรายละเอียดดังนี้: - **".
    // Salvage only whole lines and require enough of them to stand alone;
    // otherwise apologise rather than deliver a fragment.
    if (response.truncated) {
      const salvaged = salvageTruncatedText(response.text)
      return {
        done: true,
        finalText: salvaged || t('replyCutOff', state.language),
      }
    }
    return { done: true, finalText: response.text }
  }

  state.turns.push({ role: 'assistant', text: response.text, toolCall: response.toolCall })

  // Guard against repeated identical tool calls leading to dead loops
  const isDuplicateToolCall = state.toolCallsExecuted.some(
    (executed) =>
      executed.name === response.toolCall!.name &&
      JSON.stringify(executed.args) === JSON.stringify(response.toolCall!.args)
  )

  const toolResult = isDuplicateToolCall
    ? {
        resultForAi: 'เครื่องมือนี้ถูกเรียกไปแล้วด้วยข้อมูลเดียวกัน กรุณาสรุปคำตอบให้ลูกค้าจากข้อมูลที่มีอยู่ตอนนี้ โดยไม่ต้องเรียกเครื่องมือซ้ำ',
        immediateMessages: [],
        scheduledMessage: undefined,
        productsData: undefined,
      }
    : await state.executor(response.toolCall.name, response.toolCall.args, state.toolCtx)

  if (toolResult.productsData && toolResult.productsData.length > 0) {
    state.productsData = toolResult.productsData
  }
  state.toolCallsExecuted.push({ name: response.toolCall.name, args: response.toolCall.args })
  state.immediateMessages.push(...toolResult.immediateMessages)
  if (toolResult.scheduledMessage) state.scheduledMessages.push(toolResult.scheduledMessage)
  state.turns.push({
    role: 'tool_result',
    toolCallId: response.toolCall.id,
    toolName: response.toolCall.name,
    result: toolResult.resultForAi,
  })

  if (state.step === MAX_PLANNING_STEPS - 1) {
    // Reached maximum allowed planning steps without generating final text.
    // Transfer conversation to human handoff rather than leaking internal raw tool results to the customer.
    try {
      await state.toolCtx.supabase.from('conversations').update({ status: 'human' }).eq('id', state.conversationId)
    } catch (err) {
      console.error('[Planning Layer] Failed to flip conversation to human handoff:', err)
    }
    return { done: true, finalText: t('handoffTooComplex', state.language) }
  }

  return { done: false }
}

/**
 * Trims a reply that the provider cut off at its token ceiling back to the
 * last line that actually finished, so a customer never sees a dangling
 * fragment. Returns '' when too little survives to be worth sending, letting
 * the caller apologise instead.
 */
function salvageTruncatedText(text: string): string {
  const lines = text.split('\n')
  lines.pop() // the line the provider was still writing when it ran out
  const salvaged = lines.join('\n').trimEnd()
  return salvaged.length >= 60 ? salvaged : ''
}

/**
 * Strips Markdown the model likes to reach for. LINE renders text messages
 * literally, so `**เลขที่จอง:**` reaches the customer with the asterisks
 * still attached. Telling the model not to use Markdown was already in the
 * prompt and it kept doing it anyway, so the guarantee lives here instead.
 *
 * Bullets survive: the italic rule needs a non-space straight after the
 * asterisk, which "* รายการ" doesn't have.
 */
function toPlainText(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}[ \t]+/gm, '')
}

function finalizeAgentResult(state: PlanningState, finalText: string): AgentResult {
  // Sum usage across every step into one AgentUsage — quota/cost accounting
  // counts this as ONE customer message regardless of how many AI calls the
  // plan took internally.
  const usage: AgentUsage | undefined = state.allUsage.length > 0
    ? state.allUsage.reduce((acc, u) => ({
        promptTokens: acc.promptTokens + u.promptTokens,
        completionTokens: acc.completionTokens + u.completionTokens,
        totalTokens: acc.totalTokens + u.totalTokens,
        provider: u.provider,
        cacheReadTokens: (acc.cacheReadTokens || 0) + (u.cacheReadTokens || 0),
        cacheWriteTokens: (acc.cacheWriteTokens || 0) + (u.cacheWriteTokens || 0),
      }))
    : undefined

  const firstUserTurn = state.turns.find((t) => t.role === 'user')
  const userQueryText = firstUserTurn && 'text' in firstUserTurn ? firstUserTurn.text : ''

  const nextStage = determineNextSalesStage({
    currentStage: state.salesStage,
    userQuery: userQueryText,
    executedToolNames: state.toolCallsExecuted.map((t) => t.name),
    hasPendingOrder: state.toolCallsExecuted.some((t) => t.name === 'send_payment_qr'),
    hasCompletedOrder: state.toolCallsExecuted.some((t) => t.name === 'take_order' || t.name === 'book_appointment'),
  })

  return {
    text: toPlainText(finalText).trim(),
    usage,
    immediateMessages: state.immediateMessages,
    toolCallsExecuted: state.toolCallsExecuted,
    scheduledMessages: state.scheduledMessages,
    productsData: state.productsData,
    salesStage: nextStage,
  }
}

/**
 * Single-call entry point — runs the whole planning loop to completion and
 * returns the final AgentResult. Used by the Chat Playground (which has no
 * need for the ack/push split, since it's already a synchronous UI) and by
 * anything else that just wants "give me the final answer".
 */
export async function processSalesAgentChat(request: SalesAgentRequest): Promise<AgentResult> {
  const prep = await preparePlanningState(request)
  if (prep.quotaExceeded) return quotaExceededResult(prep.language)

  const state = prep.state
  let finalText = ''
  for (; state.step < MAX_PLANNING_STEPS; state.step++) {
    const outcome = await runPlanningStep(state)
    if (outcome.done) {
      finalText = outcome.finalText
      break
    }
  }
  return finalizeAgentResult(state, finalText)
}

/**
 * Two-phase entry point #1 — runs only the first planning step. If the AI
 * answered directly (no tool call), behaves exactly like
 * `processSalesAgentChat` and returns the final result. If the AI asked for
 * a tool (meaning at least one more AI call is needed), returns the
 * continuation state instead of running it — this is the signal the webhook
 * route uses to send a LINE ack ("กำลังตรวจสอบให้สักครู่นะคะ...") right
 * away, before handing the state to `continueSalesAgentPlanning` to finish
 * in the background (matching the reply-then-push-later shape
 * `verifySlipAndNotify` already uses for slip verification).
 */
export async function startSalesAgentPlanning(request: SalesAgentRequest): Promise<PlanningStart> {
  const prep = await preparePlanningState(request)
  if (prep.quotaExceeded) return { done: true, result: quotaExceededResult(prep.language) }

  const state = prep.state
  const outcome = await runPlanningStep(state)
  state.step += 1

  if (outcome.done) {
    return { done: true, result: finalizeAgentResult(state, outcome.finalText) }
  }
  return { done: false, state }
}

/**
 * Two-phase entry point #2 — resumes a `PlanningState` returned by
 * `startSalesAgentPlanning` (with `done: false`) and runs the remaining
 * steps to completion.
 */
export async function continueSalesAgentPlanning(state: PlanningState): Promise<AgentResult> {
  let finalText = ''
  for (; state.step < MAX_PLANNING_STEPS; state.step++) {
    const outcome = await runPlanningStep(state)
    if (outcome.done) {
      finalText = outcome.finalText
      break
    }
  }
  return finalizeAgentResult(state, finalText)
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider: Google Gemini
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts the provider-agnostic PlanningTurn[] into Gemini's `contents`
 * array. Verified live (28 กรกฎาคม 2026, Chat Playground) that Gemini's
 * current generateContent API rejects `role: 'function'` for tool results
 * — `400 INVALID_ARGUMENT: "Role 'function' is not supported... USER,
 * ASSISTANT, ..., MODEL, USER"` — so functionResponse parts go on a
 * 'user' turn instead, matching MODEL/USER from that accepted list.
 */
/** Puts the per-customer context ahead of the conversation, for requests whose system prompt is cached. */
function withLeadingContext(contents: any[], context: string): any[] {
  if (!context.trim() || contents.length === 0) return contents
  const [first, ...rest] = contents
  const note = { text: `[ข้อมูลประกอบจากระบบสำหรับลูกค้ารายนี้ — ไม่ใช่ข้อความของลูกค้า]\n${context}` }
  return [{ ...first, parts: [note, ...(first.parts || [])] }, ...rest]
}

function buildGeminiContents(turns: PlanningTurn[]): any[] {
  return turns.map((turn) => {
    if (turn.role === 'user') {
      return { role: 'user', parts: [{ text: turn.text }] }
    }
    if (turn.role === 'assistant') {
      const parts: any[] = []
      if (turn.text) parts.push({ text: turn.text })
      if (turn.toolCall) {
        const fcPart: any = {
          functionCall: {
            id: turn.toolCall.id,
            name: turn.toolCall.name,
            args: turn.toolCall.args,
          },
        }
        // Gemini 3 requires the thought signature on the same Part as the
        // functionCall when we echo model history back after tool execution.
        if (turn.toolCall.thoughtSignature) {
          fcPart.thoughtSignature = turn.toolCall.thoughtSignature
        }
        parts.push(fcPart)
      }
      return { role: 'model', parts }
    }
    // tool_result — Gemini's current API rejects role: 'function' (confirmed
    // live: "Role 'function' is not supported... USER, ASSISTANT, ...
    // MODEL, USER"), unlike the role this used to take in older versions.
    // functionResponse parts go on a 'user' turn instead.
    return {
      role: 'user',
      parts: [
        {
          functionResponse: {
            id: turn.toolCallId,
            name: turn.toolName,
            response: { result: turn.result },
          },
        },
      ],
    }
  })
}

async function callGeminiApi(
  systemInstruction: string,
  turns: PlanningTurn[],
  modelName: string,
  apiKey: string,
  toolSet: typeof MASTER_TOOLS,
  state?: PlanningState
): Promise<ProviderStepResult | null> {
  const candidateModels = Array.from(
    new Set([
      modelName,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
    ].filter(Boolean))
  )

  // Gemini 3 thinks before answering and bills it as output; left unset it defaults
  // to a high level, which was most of a turn's tokens and latency for routine sales
  // chat. GEMINI_THINKING_LEVEL (admin page or Vercel) overrides it; 'default' sends none.
  const thinkingLevel = (await platformSecret('GEMINI_THINKING_LEVEL')) || 'low'
  // One budget for every model this provider tries: a provider that hangs (Gemini
  // once took 32s to answer 503) should hand over to the next one, not hold the customer
  const deadline = AbortSignal.timeout(GEMINI_TIMEOUT_MS)
  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const generationConfig = {
        temperature: 0.7,
        // Gemini 3.x reasons before answering and those thinking tokens are
        // billed against maxOutputTokens too.
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(thinkingLevel !== 'default' ? { thinkingConfig: { thinkingLevel } } : {}),
      }
      const geminiTools = toGeminiTools(toolSet)
      const plainBody = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: buildGeminiContents(turns),
        tools: geminiTools,
        generationConfig,
      }

      // The shop's static prompt and the tools sit in an explicit cache; a request
      // using it may not also carry a system instruction or tools, so this
      // customer's context (history, orders, knowledge) moves to the first turn.
      const cacheName = state && toolSet.length > 0
        ? await getGeminiPromptCache({ apiKey, model, systemText: state.staticSystemPrompt, tools: geminiTools })
        : null
      const post = (body: unknown) => fetch(endpoint, {
        method: 'POST',
        signal: deadline,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      let usedCache = Boolean(cacheName && state)
      let response = usedCache && state
        ? await post({
            cachedContent: cacheName,
            contents: withLeadingContext(plainBody.contents, state.dynamicSystemPrompt),
            generationConfig,
          })
        : await post(plainBody)
      if (!response.ok && cacheName) {
        console.warn(`[Gemini cache] request with ${cacheName} failed ${response.status}:`, (await response.text()).slice(0, 300), '— retrying uncached')
        dropGeminiPromptCache(cacheName)
        usedCache = false
        response = await post(plainBody)
      }

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[Gemini Error] ${response.status} model=${model}:`, errBody.slice(0, 500))
        if (state) {
          state.lastProviderError = `Gemini (${model}) ${response.status}: ${errBody.slice(0, 150)}`
        }
        if (response.status === 404 || response.status === 400) {
          continue
        }
        return null
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const parts: any[] = candidate?.content?.parts || []
      const truncated = candidate?.finishReason === 'MAX_TOKENS'

      let replyText = ''
      let toolCall: IdentifiedToolCall | undefined

      // Gemini thinking signatures are part-level metadata. Depending on the
      // REST/SDK surface they can be exposed as thoughtSignature or
      // thought_signature, and in some responses they appear on the part before
      // the functionCall. Capture either spelling and echo it back unchanged.
      let pendingThoughtSig: string | undefined

      for (const part of parts) {
        const partThoughtSignature = part.thoughtSignature || part.thought_signature
        if (partThoughtSignature) {
          pendingThoughtSig = partThoughtSignature
        }

        // Skip thought content but capture its signature
        if (part.thought) {
          continue
        }
        if (part.text) replyText += part.text
        if (part.functionCall) {
          toolCall = {
            name: part.functionCall.name as AgentToolName,
            args: part.functionCall.args || {},
            id: part.functionCall.id,
            // thought_signature can be on the functionCall part itself or
            // from a preceding thought part — accept either.
            thoughtSignature:
              partThoughtSignature ||
              part.functionCall.thoughtSignature ||
              part.functionCall.thought_signature ||
              pendingThoughtSig,
          }
        }
      }

      if (!replyText && !toolCall) {
        if (state) state.lastProviderError = `Gemini (${model}): ตอบกลับเป็นข้อความว่าง`
        continue
      }

      const usageMeta = data.usageMetadata
      const usage: AgentUsage | undefined = usageMeta
        ? {
            promptTokens: usageMeta.promptTokenCount || 0,
            // Thinking tokens are billed as output, so they belong in the cost
            completionTokens: (usageMeta.candidatesTokenCount || 0) + (usageMeta.thoughtsTokenCount || 0),
            totalTokens: usageMeta.totalTokenCount || 0,
            provider: 'gemini',
            cacheReadTokens: usageMeta.cachedContentTokenCount || 0,
          }
        : undefined
      if (usageMeta) {
        console.log(
          `[Gemini usage] step ${state?.step ?? '?'} ${model}${usedCache ? ' (explicit cache)' : ''}: prompt ${usageMeta.promptTokenCount || 0}` +
          ` (cached ${usageMeta.cachedContentTokenCount || 0}), thinking ${usageMeta.thoughtsTokenCount || 0},` +
          ` output ${usageMeta.candidatesTokenCount || 0}, tools ${toolSet.length}`
        )
      }

      if (truncated) {
        console.warn(
          `[Gemini] Response hit MAX_TOKENS (thinking ${usageMeta?.thoughtsTokenCount ?? '?'} + output ${usageMeta?.candidatesTokenCount ?? '?'} of ${MAX_OUTPUT_TOKENS}) — reply was cut off mid-sentence.`
        )
      }

      return { text: replyText.trim(), toolCall, usage, truncated }
    } catch (err: any) {
      if (isTimeout(err)) {
        console.error(`[Gemini Timeout] model=${model} after ${GEMINI_TIMEOUT_MS}ms`)
        if (state) state.lastProviderError = `Gemini timeout`
        return null
      }
      console.error(`[Gemini Exception] model=${model}:`, err)
      if (state) {
        state.lastProviderError = `Gemini (${model}) exception: ${err?.message || String(err)}`
      }
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider: Anthropic Claude
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts PlanningTurn[] into Claude's `messages` array. Per Claude's
 * documented multi-turn format: the assistant's content (including the
 * tool_use block) is echoed back exactly as received, then a new user
 * message carries ONLY a tool_result block referencing that tool_use's id.
 */
function buildClaudeMessages(turns: PlanningTurn[]): any[] {
  const messages: any[] = []
  for (const turn of turns) {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text })
    } else if (turn.role === 'assistant') {
      const content: any[] = []
      if (turn.text) content.push({ type: 'text', text: turn.text })
      if (turn.toolCall) {
        content.push({ type: 'tool_use', id: turn.toolCall.id, name: turn.toolCall.name, input: turn.toolCall.args })
      }
      messages.push({ role: 'assistant', content })
    } else {
      // tool_result — must be its own user message containing only tool_result blocks
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: turn.toolCallId, content: turn.result }],
      })
    }
  }
  return messages
}

async function callClaudeApi(
  staticSystemPrompt: string,
  dynamicSystemPrompt: string,
  turns: PlanningTurn[],
  apiKey: string,
  toolSet: typeof MASTER_TOOLS,
  state?: PlanningState
): Promise<ProviderStepResult | null> {
  const candidateModels = Array.from(
    new Set(
      [
        await platformSecret('CLAUDE_MODEL'),
        'claude-sonnet-5-5',
        'claude-haiku-5-5',
      ].filter(Boolean)
    )
  ) as string[]

  // One budget for every model this provider tries: a provider that hangs (Gemini
  // once took 32s to answer 503) should hand over to the next one, not hold the customer
  const deadline = AbortSignal.timeout(FALLBACK_TIMEOUT_MS)
  for (const model of candidateModels) {
    try {
      // Prompt caching: the static block (bot identity, knowledge base,
      // products, payment info — stable per shop) is tagged cache_control so
      // Claude only bills full price for it once per 5-minute/1-hour window;
      // the dynamic block (customer profile, chat history) is never cached
      // since it changes per customer/message. Below Claude's 1024-token
      // cacheable minimum this just silently doesn't activate — no error.
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: deadline,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: [
            { type: 'text', text: staticSystemPrompt, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: dynamicSystemPrompt },
          ],
          tools: toClaudeTools(toolSet),
          messages: buildClaudeMessages(turns),
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`[Claude Error] ${response.status} model=${model}:`, errText.slice(0, 500))
        if (state) {
          state.lastProviderError = `Claude (${model}) ${response.status}: ${errText.slice(0, 150)}`
        }
        if (response.status === 404 || (response.status === 400 && errText.includes('not_found_error'))) {
          continue
        }
        return null
      }

      const data = await response.json()
      const blocks: any[] = data.content || []

      let replyText = ''
      let toolCall: IdentifiedToolCall | undefined

      for (const block of blocks) {
        if (block.type === 'text') replyText += block.text
        if (block.type === 'tool_use') {
          toolCall = { name: block.name as AgentToolName, args: block.input || {}, id: block.id }
        }
      }

      if (!replyText && !toolCall) {
        if (state) state.lastProviderError = `Claude (${model}): ตอบกลับเป็นข้อความว่าง`
        continue
      }

      const usageData = data.usage
      const usage: AgentUsage | undefined = usageData
        ? {
            promptTokens: usageData.input_tokens || 0,
            completionTokens: usageData.output_tokens || 0,
            totalTokens:
              (usageData.input_tokens || 0) +
              (usageData.output_tokens || 0) +
              (usageData.cache_creation_input_tokens || 0) +
              (usageData.cache_read_input_tokens || 0),
            provider: 'claude',
            cacheReadTokens: usageData.cache_read_input_tokens || 0,
            cacheWriteTokens: usageData.cache_creation_input_tokens || 0,
          }
        : undefined

      const truncated = data.stop_reason === 'max_tokens'
      if (truncated) {
        console.warn(`[Claude] Response hit max_tokens (${MAX_OUTPUT_TOKENS}) — reply was cut off mid-sentence.`)
      }

      return { text: replyText.trim(), toolCall, usage, truncated }
    } catch (err: any) {
      if (isTimeout(err)) {
        console.error(`[Claude Timeout] model=${model} after ${FALLBACK_TIMEOUT_MS}ms`)
        if (state) state.lastProviderError = `Claude timeout`
        return null
      }
      console.error(`[Claude Exception] model=${model}:`, err)
      if (state) {
        state.lastProviderError = `Claude (${model}) exception: ${err?.message || String(err)}`
      }
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider: OpenAI
// ─────────────────────────────────────────────────────────────────────────────

/** Converts PlanningTurn[] into OpenAI's `messages` array (stable, long-standing format — assistant message with tool_calls, then a role:'tool' message per result). */
function buildOpenAiMessages(systemInstruction: string, turns: PlanningTurn[]): any[] {
  const messages: any[] = [{ role: 'system', content: systemInstruction }]
  for (const turn of turns) {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text })
    } else if (turn.role === 'assistant') {
      const msg: any = { role: 'assistant', content: turn.text || null }
      if (turn.toolCall) {
        msg.tool_calls = [{
          id: turn.toolCall.id,
          type: 'function',
          function: { name: turn.toolCall.name, arguments: JSON.stringify(turn.toolCall.args) },
        }]
      }
      messages.push(msg)
    } else {
      messages.push({ role: 'tool', tool_call_id: turn.toolCallId, content: turn.result })
    }
  }
  return messages
}

async function callOpenAiApi(
  systemInstruction: string,
  turns: PlanningTurn[],
  apiKey: string,
  toolSet: typeof MASTER_TOOLS,
  state?: PlanningState
): Promise<ProviderStepResult | null> {
  const candidateModels = Array.from(
    new Set(
      [
        await platformSecret('OPENAI_MODEL'),
        'gpt-5.6-luna',
        'gpt-4o-mini',
      ].filter(Boolean)
    )
  ) as string[]

  // One budget for every model this provider tries: a provider that hangs (Gemini
  // once took 32s to answer 503) should hand over to the next one, not hold the customer
  const deadline = AbortSignal.timeout(FALLBACK_TIMEOUT_MS)
  for (const model of candidateModels) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: deadline,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: buildOpenAiMessages(systemInstruction, turns),
          ...(toolSet.length > 0 ? { tools: toOpenAITools(toolSet), tool_choice: 'auto' } : {}),
          // GPT-5.x rejects max_tokens and only allows function tools in Chat Completions
          // with reasoning turned off; older models (gpt-4o-mini) take the classic params.
          ...(/^gpt-5/.test(model)
            ? { max_completion_tokens: MAX_OUTPUT_TOKENS, reasoning_effort: 'none' }
            : { max_tokens: MAX_OUTPUT_TOKENS }),
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`[OpenAI Error] ${response.status} model=${model}:`, errText.slice(0, 500))
        if (state) {
          state.lastProviderError = `OpenAI (${model}) ${response.status}: ${errText.slice(0, 150)}`
        }
        if (response.status === 404 || response.status === 400) {
          continue
        }
        return null
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message
      if (!message) continue

      const replyText = message.content || ''
      let toolCall: IdentifiedToolCall | undefined

      if (message.tool_calls?.length > 0) {
        const tc = message.tool_calls[0]
        if (tc.function?.name) {
          try {
            toolCall = {
              name: tc.function.name as AgentToolName,
              args: JSON.parse(tc.function.arguments || '{}'),
              id: tc.id,
            }
          } catch {
            console.error('[OpenAI] tool_call parse error')
          }
        }
      }

      if (!replyText && !toolCall) {
        if (state) state.lastProviderError = `OpenAI (${model}): ตอบกลับเป็นข้อความว่าง`
        continue
      }

      const usageData = data.usage
      const usage: AgentUsage | undefined = usageData
        ? {
            promptTokens: usageData.prompt_tokens || 0,
            completionTokens: usageData.completion_tokens || 0,
            totalTokens: usageData.total_tokens || 0,
            provider: 'openai',
          }
        : undefined

      const truncated = data.choices?.[0]?.finish_reason === 'length'
      if (truncated) {
        console.warn(`[OpenAI] Response hit max_tokens (${MAX_OUTPUT_TOKENS}) — reply was cut off mid-sentence.`)
      }

      return { text: replyText.trim(), toolCall, usage, truncated }
    } catch (err: any) {
      if (isTimeout(err)) {
        console.error(`[OpenAI Timeout] model=${model} after ${FALLBACK_TIMEOUT_MS}ms`)
        if (state) state.lastProviderError = `OpenAI timeout`
        return null
      }
      console.error(`[OpenAI Exception] model=${model}:`, err)
      if (state) {
        state.lastProviderError = `OpenAI (${model}) exception: ${err?.message || String(err)}`
      }
    }
  }

  return null
}
