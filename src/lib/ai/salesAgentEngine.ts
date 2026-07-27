import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface SalesAgentRequest {
  shop: any
  userQuery: string
  userId: string
  conversationId: string
}

export type ComplexityLevel = 'LOW' | 'HIGH'
export type AiProvider = 'gemini' | 'claude' | 'openai'

// ─── Tool Use / Function Calling Types ────────────────────────────────────────

export interface AgentToolCall {
  name: 'send_payment_qr'
  args: {
    amount: number
    order_summary?: string
  }
}

export interface AgentResult {
  text: string
  toolCall?: AgentToolCall
}

// ─── Tool Definitions (per-provider format) ───────────────────────────────────

const TOOL_SEND_PAYMENT_QR_DESC =
  'เรียกใช้เมื่อลูกค้าพร้อมชำระเงินและต้องการ QR Code PromptPay สำหรับโอนเงิน ควรเรียกเมื่อลูกค้าบอกว่าจะโอน สั่งซื้อ หรือต้องการชำระเงิน และมีการสรุปยอดราคาแล้ว'

const PAYMENT_TOOLS_GEMINI = [
  {
    functionDeclarations: [
      {
        name: 'send_payment_qr',
        description: TOOL_SEND_PAYMENT_QR_DESC,
        parameters: {
          type: 'OBJECT',
          properties: {
            amount: {
              type: 'NUMBER',
              description: 'ยอดเงินรวมที่ต้องชำระ (หน่วย: บาท)',
            },
            order_summary: {
              type: 'STRING',
              description: 'สรุปรายการสินค้าที่สั่ง เช่น "สินค้า A x2, สินค้า B x1"',
            },
          },
          required: ['amount'],
        },
      },
    ],
  },
]

const PAYMENT_TOOLS_CLAUDE = [
  {
    name: 'send_payment_qr',
    description: TOOL_SEND_PAYMENT_QR_DESC,
    input_schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'ยอดเงินรวมที่ต้องชำระ (หน่วย: บาท)',
        },
        order_summary: {
          type: 'string',
          description: 'สรุปรายการสินค้าที่สั่ง',
        },
      },
      required: ['amount'],
    },
  },
]

const PAYMENT_TOOLS_OPENAI = [
  {
    type: 'function',
    function: {
      name: 'send_payment_qr',
      description: TOOL_SEND_PAYMENT_QR_DESC,
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'ยอดเงินรวมที่ต้องชำระ (หน่วย: บาท)',
          },
          order_summary: {
            type: 'string',
            description: 'สรุปรายการสินค้าที่สั่ง',
          },
        },
        required: ['amount'],
      },
    },
  },
]

// ─── Botify Brain Engine™: Complexity Classifier ──────────────────────────────

/**
 * Botify Brain Engine™: Invisible Intent & Complexity Classifier
 * Classifies customer queries to route between fast-responders and high-persuasion models.
 */
export function classifyMessageComplexity(userQuery: string): {
  complexity: ComplexityLevel
  targetProvider: AiProvider
  reason: string
} {
  const text = userQuery.toLowerCase().trim()

  // High complexity / negotiation / discount / comparison keywords
  const highComplexityKeywords = [
    'ลด', 'ส่วนลด', 'ลดได้ไหม', 'ลดอีกไหม', 'แถม', 'ของแถม',
    'แพง', 'แพงกว่า', 'เทียบ', 'ต่างยังไง', 'ต่างกันยังไง', 'ต่อรอง',
    'โปรโมชั่นพิเศษ', 'รวมส่ง', 'ส่งฟรีได้ไหม', 'โอนวันนี้', 'ลดราคาสินค้า',
    'ขอราคาพิเศษ', 'ราคาส่ง', 'เหมา'
  ]

  const isHighComplexity = highComplexityKeywords.some(keyword => text.includes(keyword))

  if (isHighComplexity) {
    return {
      complexity: 'HIGH',
      targetProvider: process.env.CLAUDE_API_KEY || process.env.CLAUDE_KEY ? 'claude' : 'gemini',
      reason: 'Detected negotiation, discount, or high-persuasion closing intent.',
    }
  }

  return {
    complexity: 'LOW',
    targetProvider: 'gemini',
    reason: 'Standard FAQ, greeting, or product catalog lookup.',
  }
}

// ─── Main Agent Orchestrator ──────────────────────────────────────────────────

export async function processSalesAgentChat({
  shop,
  userQuery,
  userId,
  conversationId,
}: SalesAgentRequest): Promise<AgentResult> {
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''

  const claudeKey =
    process.env.CLAUDE_API_KEY ||
    process.env.CLAUDE_KEY ||
    process.env.NEXT_PUBLIC_CLAUDE_API_KEY ||
    ''

  const openAiKey =
    process.env.OPENAI_API_KEY ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
    ''

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  // 1. Fetch Knowledge Base context
  const { data: knowledgeItems } = await supabase
    .from('knowledge_base')
    .select('title, content, category')
    .eq('shop_id', shop.id)
    .eq('status', 'active')

  let knowledgeContext = ''
  if (knowledgeItems && knowledgeItems.length > 0) {
    knowledgeContext =
      `\n\n[คลังข้อมูลความรู้และคำตอบอ้างอิงของร้านค้า]\n` +
      knowledgeItems.map((k) => `Q: ${k.title}\nA: ${k.content}`).join('\n\n')
  }

  // 2. Fetch Products context
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
        `\n\n[แคตตาล็อกสินค้าพร้อมส่งในร้าน]\n` +
        products
          .map(
            (p) =>
              `- ${p.name} (หมวดหมู่: ${p.category || 'ทั่วไป'}): ราคา ${Number(p.price || 0).toLocaleString()} บาท (สต๊อกคงเหลือ ${p.stock} ชิ้น)`
          )
          .join('\n')
    }
  }

  // 3. Fetch Customer History (Memory Retention - Last 10 Messages)
  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('sender_name, sender_type, message, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10)

  let historyContext = ''
  if (recentMessages && recentMessages.length > 0) {
    const sorted = [...recentMessages].reverse()
    historyContext =
      `\n\n[ประวัติบทสนทนาล่าสุดกับลูกค้าคนนี้]\n` +
      sorted
        .map((m) => `${m.sender_type === 'user' ? 'ลูกค้า' : 'พนักงาน AI'}: ${m.message}`)
        .join('\n')
  }

  // 4. Payment & Shipping Info Context
  let paymentInfo = ''
  const promptpayId = shop.promptpay_id || shop.promptpay_number
  if (promptpayId || shop.bank_account_number) {
    paymentInfo = `\n\n[ข้อมูลชำระเงินของร้านค้า]
- พร้อมเพย์: ${promptpayId || 'ไม่ระบุ'} (${shop.promptpay_name || shop.name})
- ธนาคาร: ${shop.bank_name || 'ไม่ระบุ'} เลขที่บัญชี: ${shop.bank_account_number || 'ไม่ระบุ'} ชื่อบัญชี: ${shop.bank_account_name || shop.name}`
  }

  // 5. Construct System Instruction for AI Sales Employee
  const systemInstruction = `คุณคือ "${shop.bot_name || 'น้อง Botify'}" พนักงานขาย AI อัจฉริยะประจำร้าน "${shop.name}".
ลักษณะบุคลิกภาพ: ${shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ'}
คำอธิบายร้านค้า: ${shop.description || 'ร้านค้าออนไลน์คุณภาพสูง'}

คู่มือและขั้นตอนการทำงานของพนักงานขาย (AI Sales Employee Pipeline):
1. [Stage 1: Discovery & Greeting] ทักทายลูกค้าอย่างอบอุ่น ถามความต้องการ แนะนำสินค้าให้ตรงจุด
2. [Stage 2: Product Showcase & Stock] ให้ข้อมูลสินค้า ราคา และจุดเด่นอย่างถูกต้องตามรายการสินค้าพร้อมส่งด้านล่าง
3. [Stage 3: Closing & Payment] ตอบข้อสงสัย สรุปยอดรวม และเมื่อลูกค้าตกลงซื้อหรือพร้อมชำระเงินแล้ว ให้เรียกใช้ Tool "send_payment_qr" ทันที พร้อมระบุ amount (ยอดเงิน) และ order_summary (รายการสินค้า)
4. [Stage 4: Post-Sales] ขอบคุณลูกค้า และแนะนำให้ส่งรูปสลิปโอนเงินกลับมาเมื่อชำระเสร็จสิ้น

กฎเหล็กสำคัญ:
- ตอบด้วยภาษาไทยที่สุภาพ กระชับ เป็นกันเอง และน่าซื้อ
- เมื่อลูกค้าพร้อมชำระเงิน ให้เรียก Tool "send_payment_qr" เพื่อส่ง QR Code ให้ลูกค้าสแกนจ่ายได้ทันที
- หากเป็นเรื่องที่ไม่มีข้อมูลในระบบ ให้ตอบอย่างสุภาพว่า "เดี๋ยวแจ้งให้แอดมินเข้ามาช่วยดูแลรายละเอียดเพิ่มเติมให้นะคะ"

${knowledgeContext}
${productsContext}
${paymentInfo}
${historyContext}`

  // 6. Botify Brain Engine™: Invisible Routing Decision
  const routing = classifyMessageComplexity(userQuery)
  console.log(`[Botify Brain Engine™] Query: "${userQuery}" | Complexity: ${routing.complexity} | Target: ${routing.targetProvider.toUpperCase()} (${routing.reason})`)

  // Dispatch to Target Provider with Fallbacks
  if (routing.targetProvider === 'claude' && claudeKey) {
    const result = await callClaudeApi(systemInstruction, userQuery, claudeKey)
    if (result) return result
  } else if (routing.targetProvider === 'openai' && openAiKey) {
    const result = await callOpenAiApi(systemInstruction, userQuery, openAiKey)
    if (result) return result
  }

  // Primary Default Provider: Gemini
  if (!geminiKey) {
    console.warn('[SalesAgentEngine] Warning: No GEMINI_API_KEY set.')
    return { text: `${shop.greeting_message || 'สวัสดีค่ะ ยินดีต้อนรับสู่ร้านค้าค่ะ'} (มีอะไรให้พนักงานช่วยแนะนำเพิ่มเติมไหมคะ?)` }
  }

  const geminiResult = await callGeminiApi(systemInstruction, userQuery, modelName, geminiKey)
  if (geminiResult) return geminiResult

  return { text: `สวัสดีค่ะ ยินดีต้อนรับสู่ร้าน "${shop.name}" มีอะไรให้ช่วยแนะนำไหมคะ?` }
}

// ─── Provider: Google Gemini ──────────────────────────────────────────────────

/**
 * Call Google Gemini REST API with Function Calling support
 */
async function callGeminiApi(
  systemInstruction: string,
  userQuery: string,
  modelName: string,
  apiKey: string
): Promise<AgentResult | null> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userQuery }] }],
        tools: PAYMENT_TOOLS_GEMINI,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    })

    if (!response.ok) {
      console.error('[SalesAgentEngine] Gemini API Error:', await response.text())
      return null
    }

    const data = await response.json()
    const parts: any[] = data.candidates?.[0]?.content?.parts || []

    let replyText = ''
    let toolCall: AgentToolCall | undefined

    for (const part of parts) {
      if (part.text) {
        replyText += part.text
      }
      if (part.functionCall?.name === 'send_payment_qr') {
        toolCall = {
          name: 'send_payment_qr',
          args: part.functionCall.args,
        }
      }
    }

    if (!replyText && !toolCall) return null
    return { text: replyText.trim(), toolCall }
  } catch (err) {
    console.error('[SalesAgentEngine] Gemini Exception:', err)
    return null
  }
}

// ─── Provider: Anthropic Claude ───────────────────────────────────────────────

/**
 * Call Anthropic Claude Messages API with Tool Use support
 */
async function callClaudeApi(
  systemInstruction: string,
  userQuery: string,
  apiKey: string
): Promise<AgentResult | null> {
  try {
    const endpoint = 'https://api.anthropic.com/v1/messages'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemInstruction,
        tools: PAYMENT_TOOLS_CLAUDE,
        messages: [{ role: 'user', content: userQuery }],
      }),
    })

    if (!response.ok) {
      console.error('[SalesAgentEngine] Claude API Error:', await response.text())
      return null
    }

    const data = await response.json()
    const contentBlocks: any[] = data.content || []

    let replyText = ''
    let toolCall: AgentToolCall | undefined

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        replyText += block.text
      }
      if (block.type === 'tool_use' && block.name === 'send_payment_qr') {
        toolCall = {
          name: 'send_payment_qr',
          args: block.input,
        }
      }
    }

    if (!replyText && !toolCall) return null
    return { text: replyText.trim(), toolCall }
  } catch (err) {
    console.error('[SalesAgentEngine] Claude Exception:', err)
    return null
  }
}

// ─── Provider: OpenAI ─────────────────────────────────────────────────────────

/**
 * Call OpenAI Chat Completions API with Function Calling support
 */
async function callOpenAiApi(
  systemInstruction: string,
  userQuery: string,
  apiKey: string
): Promise<AgentResult | null> {
  try {
    const endpoint = 'https://api.openai.com/v1/chat/completions'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userQuery },
        ],
        tools: PAYMENT_TOOLS_OPENAI,
        tool_choice: 'auto',
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      console.error('[SalesAgentEngine] OpenAI API Error:', await response.text())
      return null
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message

    if (!message) return null

    const replyText = message.content || ''
    let toolCall: AgentToolCall | undefined

    if (message.tool_calls && message.tool_calls.length > 0) {
      const tc = message.tool_calls[0]
      if (tc.function?.name === 'send_payment_qr') {
        try {
          toolCall = {
            name: 'send_payment_qr',
            args: JSON.parse(tc.function.arguments),
          }
        } catch {
          console.error('[SalesAgentEngine] OpenAI tool_call parse error')
        }
      }
    }

    if (!replyText && !toolCall) return null
    return { text: replyText.trim(), toolCall }
  } catch (err) {
    console.error('[SalesAgentEngine] OpenAI Exception:', err)
    return null
  }
}
