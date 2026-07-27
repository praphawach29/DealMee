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

export async function processSalesAgentChat({
  shop,
  userQuery,
  userId,
  conversationId,
}: SalesAgentRequest): Promise<string> {
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
  if (shop.promptpay_number || shop.bank_account_number) {
    paymentInfo = `\n\n[ข้อมูลชำระเงินของร้านค้า]
- พร้อมเพย์: ${shop.promptpay_number || 'ไม่ระบุ'} (${shop.promptpay_name || shop.name})
- ธนาคาร: ${shop.bank_name || 'ไม่ระบุ'} เลขที่บัญชี: ${shop.bank_account_number || 'ไม่ระบุ'} ชื่อบัญชี: ${shop.bank_account_name || shop.name}`
  }

  // 5. Construct System Instruction for AI Sales Employee
  const systemInstruction = `คุณคือ "${shop.bot_name || 'น้อง Botify'}" พนักงานขาย AI อัจฉริยะประจำร้าน "${shop.name}".
ลักษณะบุคลิกภาพ: ${shop.personality || 'สุภาพ เรียบร้อย มืออาชีพ และมุ่งมั่นให้บริการ'}
คำอธิบายร้านค้า: ${shop.description || 'ร้านค้าออนไลน์คุณภาพสูง'}

คู่มือและขั้นตอนการทำงานของพนักงานขาย (AI Sales Employee Pipeline):
1. [Stage 1: Discovery & Greeting] ทักทายลูกค้าอย่างอบอุ่น ถามความต้องการ แนะนำสินค้าให้ตรงจุด
2. [Stage 2: Product Showcase & Stock] ให้ข้อมูลสินค้า ราคา และจุดเด่นอย่างถูกต้องตามรายการสินค้าพร้อมส่งด้านล่าง
3. [Stage 3: Closing & Payment] ตอบข้อสงสัย อำนวยความสะดวกเรื่องราคารวม และแจ้งช่องทางโอนเงินเมื่อลูกค้าพร้อมซื้อ
4. [Stage 4: Post-Sales] ขอบคุณลูกค้า และแนะนำให้ส่งรูปสลิปโอนเงินเมื่อชำระเสร็จสิ้น

กฎเหล็กสำคัญ:
- ตอบด้วยภาษาไทยที่สุภาพ กระชับ เป็นกันเอง และน่าซื้อ
- หากลูกค้าสนใจซื้อ ให้สรุปยอดและส่งข้อมูลชำระเงินให้อย่างชัดเจน
- หากเป็นเรื่องที่ไม่มีข้อมูลในระบบ ให้ตอบอย่างสุภาพว่า "เดี๋ยวแจ้งให้แอดมินเข้ามาช่วยดูแลรายละเอียดเพิ่มเติมให้นะคะ"

${knowledgeContext}
${productsContext}
${paymentInfo}
${historyContext}`

  // 6. Botify Brain Engine™: Invisible Routing Decision
  const routing = classifyMessageComplexity(userQuery)
  console.log(`[Botify Brain Engine™] Query: "${userQuery}" | Complexity: ${routing.complexity} | Target Provider: ${routing.targetProvider.toUpperCase()} (${routing.reason})`)

  // Dispatch to Target Provider with Fallbacks
  if (routing.targetProvider === 'claude' && claudeKey) {
    const claudeResult = await callClaudeApi(systemInstruction, userQuery, claudeKey)
    if (claudeResult) return claudeResult
  } else if (routing.targetProvider === 'openai' && openAiKey) {
    const openAiResult = await callOpenAiApi(systemInstruction, userQuery, openAiKey)
    if (openAiResult) return openAiResult
  }

  // Primary Default Provider: Gemini 3.6 Flash
  if (!geminiKey) {
    console.warn('[SalesAgentEngine] Warning: No GEMINI_API_KEY set. Falling back to default greeting.')
    return `${shop.greeting_message || 'สวัสดีค่ะ ยินดีต้อนรับสู่ร้านค้าค่ะ'} (มีอะไรให้พนักงานช่วยแนะนำเพิ่มเติมไหมคะ?)`
  }

  const geminiResult = await callGeminiApi(systemInstruction, userQuery, modelName, geminiKey)
  if (geminiResult) return geminiResult

  return `สวัสดีค่ะ ยินดีต้อนรับสู่ร้าน "${shop.name}" มีอะไรให้ช่วยแนะนำไหมคะ?`
}

/**
 * Call Google Gemini REST API (Gemini 3.6 Flash)
 */
async function callGeminiApi(
  systemInstruction: string,
  userQuery: string,
  modelName: string,
  apiKey: string
): Promise<string | null> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userQuery }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    })

    if (!response.ok) {
      console.error('[SalesAgentEngine] Gemini API Error:', await response.text())
      return null
    }

    const data = await response.json()
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text
    return replyText?.trim() || null
  } catch (err) {
    console.error('[SalesAgentEngine] Gemini Exception:', err)
    return null
  }
}

/**
 * Call Anthropic Claude Messages API (Claude 3.5 Sonnet)
 */
async function callClaudeApi(
  systemInstruction: string,
  userQuery: string,
  apiKey: string
): Promise<string | null> {
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
        messages: [{ role: 'user', content: userQuery }],
      }),
    })

    if (!response.ok) {
      console.error('[SalesAgentEngine] Claude API Error:', await response.text())
      return null
    }

    const data = await response.json()
    const replyText = data.content?.[0]?.text
    return replyText?.trim() || null
  } catch (err) {
    console.error('[SalesAgentEngine] Claude Exception:', err)
    return null
  }
}

/**
 * Call OpenAI Chat Completions API (ChatGPT 5.6 / GPT-4o)
 */
async function callOpenAiApi(
  systemInstruction: string,
  userQuery: string,
  apiKey: string
): Promise<string | null> {
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
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      console.error('[SalesAgentEngine] OpenAI API Error:', await response.text())
      return null
    }

    const data = await response.json()
    const replyText = data.choices?.[0]?.message?.content
    return replyText?.trim() || null
  } catch (err) {
    console.error('[SalesAgentEngine] OpenAI Exception:', err)
    return null
  }
}
