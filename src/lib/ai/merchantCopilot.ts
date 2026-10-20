import { createAdminClient } from '@/lib/supabase/admin'
import { getCompetitors } from '@/lib/competitors/competitorStore'

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CopilotToolCall {
  name: string
  args: Record<string, any>
}

// ─────────────────────────────────────────────────────────────────────────────
// Copilot Tools Definition (Gemini Schema)
// ─────────────────────────────────────────────────────────────────────────────
const COPILOT_TOOLS = [
  {
    name: 'get_sales_analytics',
    description: 'ดึงข้อมูลวิเคราะห์ยอดขาย ออเดอร์ รายได้รวม ค่าเฉลี่ยต่อบิล และสถานะการชำระเงินของร้านค้าตามจำนวนวันที่ระบุ',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: {
          type: 'INTEGER',
          description: 'จำนวนวันย้อนหลังที่ต้องการดูข้อมูล เช่น 1, 7, 30 (ค่าเริ่มต้นคือ 7)',
        },
      },
    },
  },
  {
    name: 'get_top_products',
    description: 'ดึงรายการสินค้าที่ขายดีที่สุด และสต็อกคงเหลือปัจจุบัน',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'INTEGER',
          description: 'จำนวนอันดับสินค้าที่ต้องการดู เช่น 5 หรือ 10 (ค่าเริ่มต้นคือ 5)',
        },
      },
    },
  },
  {
    name: 'get_low_stock_alerts',
    description: 'ตรวจสอบสินค้าที่สต็อกเหลือน้อยกว่าเกณฑ์ที่กำหนด เพื่อเตือนให้ร้านค้าเติมสต็อก',
    parameters: {
      type: 'OBJECT',
      properties: {
        threshold: {
          type: 'INTEGER',
          description: 'เกณฑ์จำนวนสต็อกขั้นต่ำ เช่น 5 หรือ 10 (ค่าเริ่มต้นคือ 5)',
        },
      },
    },
  },
  {
    name: 'get_pending_payments',
    description: 'ดึงรายการออเดอร์ที่ยังค้างชำระเงิน (pending) เพื่อดูว่ามีลูกค้าคนไหนที่ยังไม่โอนเงินสลิป',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'INTEGER',
          description: 'จำนวนรายการสูงสุดที่ต้องการดู (ค่าเริ่มต้นคือ 10)',
        },
      },
    },
  },
  {
    name: 'get_booking_overview',
    description: 'ดึงภาพรวมรายการจองคิว นัดหมาย หรือบริการของร้านค้า ทั้งที่เสร็จสิ้นแล้วและที่กำลังจะมาถึง',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: {
          type: 'INTEGER',
          description: 'จำนวนวันข้างหน้า/ย้อนหลังที่ต้องการดู (ค่าเริ่มต้นคือ 7)',
        },
      },
    },
  },
  {
    name: 'get_customer_insights',
    description: 'ค้นหาประวัติข้อมูลลูกค้า พฤติกรรมการซื้อ หรือค้นหาลูกค้าเฉพาะเจาะจงตามชื่อ/เบอร์โทร',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'ชื่อ เบอร์โทร หรือคำค้นหาลูกค้า (ถ้าไม่ระบุจะดึงสถิติภาพรวมลูกค้า)',
        },
        limit: {
          type: 'INTEGER',
          description: 'จำนวนรายการลูกค้าสูงสุด (ค่าเริ่มต้นคือ 5)',
        },
      },
    },
  },
  {
    name: 'get_follow_up_engine_stats',
    description: 'ตรวจสอบสถานะระบบ AI ติดตามลูกค้าอัตโนมัติ (Proactive Follow-up) ว่าทวง QR ไปกี่คน และดึงยอดขายกลับมาได้เท่าไหร่',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_competitor_insights',
    description: 'ดึงข้อมูลร้านคู่แข่งที่ส่องไว้ในระบบ (Competitor Intelligence) เช่น ยอดผู้ติดตาม ช่องราคา เรตการมีส่วนร่วม แคปชั่นไวรัล และกลยุทธ์แก้ข้อโต้แย้ง',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'ชื่อร้านคู่แข่ง หรือคำค้นหา เช่น พิมรี่พาย หรือ EVEANDBOY (ถ้าไม่ระบุจะดึงคู่แข่งทั้งหมด)',
        },
      },
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Copilot Tools Executors
// ─────────────────────────────────────────────────────────────────────────────
async function executeCopilotTool(name: string, args: Record<string, any>, shopId: string): Promise<any> {
  const supabase = createAdminClient()

  try {
    if (name === 'get_sales_analytics') {
      const days = Number(args.days) || 7
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, total_amount, status, created_at, customer_name')
        .eq('shop_id', shopId)
        .gte('created_at', sinceDate)

      if (error) return { error: error.message }

      const totalOrders = orders?.length || 0
      const paidOrders = orders?.filter((o) => (o.status || '').toLowerCase() === 'paid') || []
      const pendingOrders = orders?.filter((o) => (o.status || '').toLowerCase() === 'pending') || []
      const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || Number(o.total) || 0), 0)
      const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0

      return {
        period_days: days,
        total_orders: totalOrders,
        paid_orders_count: paidOrders.length,
        pending_orders_count: pendingOrders.length,
        total_revenue_baht: totalRevenue,
        average_order_value_baht: Math.round(avgOrderValue),
        paid_conversion_rate: totalOrders > 0 ? `${Math.round((paidOrders.length / totalOrders) * 100)}%` : '0%',
      }
    }

    if (name === 'get_top_products') {
      const limit = Number(args.limit) || 5
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, stock, is_active')
        .eq('shop_id', shopId)
        .order('price', { ascending: false })
        .limit(limit)

      if (error) return { error: error.message }
      return { products: products || [] }
    }

    if (name === 'get_low_stock_alerts') {
      const threshold = Number(args.threshold) || 5
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, stock')
        .eq('shop_id', shopId)
        .lte('stock', threshold)
        .order('stock', { ascending: true })

      if (error) return { error: error.message }
      return {
        threshold,
        low_stock_count: products?.length || 0,
        products: products || [],
      }
    }

    if (name === 'get_pending_payments') {
      const limit = Number(args.limit) || 10
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_no, customer_name, customer_phone, total, total_amount, product_name, status, created_at')
        .eq('shop_id', shopId)
        .ilike('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return { error: error.message }
      return {
        pending_count: orders?.length || 0,
        orders: orders?.map((o) => ({
          ...o,
          amount: Number(o.total_amount) || Number(o.total) || 0,
        })) || [],
      }
    }

    if (name === 'get_booking_overview') {
      const days = Number(args.days) || 7
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, booking_no, customer_name, customer_phone, booking_date, booking_time, party_size, status, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', sinceDate)
        .order('booking_date', { ascending: true })

      if (error) return { error: error.message }
      const confirmed = bookings?.filter((b) => b.status === 'confirmed' || b.status === 'completed') || []
      return {
        period_days: days,
        total_bookings: bookings?.length || 0,
        confirmed_bookings: confirmed.length,
        bookings: bookings?.slice(0, 10) || [],
      }
    }

    if (name === 'get_customer_insights') {
      const query = (args.query || '').trim().toLowerCase()
      const limit = Number(args.limit) || 5

      let dbQuery = supabase.from('customer_profiles').select('*').eq('shop_id', shopId).limit(limit)

      if (query) {
        dbQuery = dbQuery.or(`display_name.ilike.%${query}%,phone.ilike.%${query}%,notes.ilike.%${query}%`)
      } else {
        dbQuery = dbQuery.order('total_spent', { ascending: false })
      }

      const { data: customers, error } = await dbQuery
      if (error) return { error: error.message }

      return {
        matched_customers_count: customers?.length || 0,
        customers: customers || [],
      }
    }

    if (name === 'get_follow_up_engine_stats') {
      const { data: tasks, error } = await supabase
        .from('follow_up_tasks')
        .select('id, task_type, status, scheduled_at, completed_at')
        .eq('shop_id', shopId)

      if (error) return { error: error.message }

      const pending = tasks?.filter((t) => t.status === 'pending').length || 0
      const sent = tasks?.filter((t) => t.status === 'sent').length || 0
      const cancelled = tasks?.filter((t) => t.status === 'cancelled').length || 0

      return {
        total_follow_ups: tasks?.length || 0,
        pending_follow_ups: pending,
        sent_follow_ups: sent,
        cancelled_recovered_slips: cancelled,
      }
    }

    if (name === 'get_competitor_insights') {
      const comps = await getCompetitors(shopId)
      const q = (args.query || '').trim().toLowerCase()
      const filtered = q
        ? comps.filter((c: any) => c.name?.toLowerCase().includes(q) || c.handle?.toLowerCase().includes(q))
        : comps

      return {
        total_competitors: filtered.length,
        competitors: filtered.slice(0, 5).map((c: any) => ({
          name: c.name,
          platform: c.platform,
          followers: c.follower_count,
          engagement_rate: `${c.avg_engagement_rate}%`,
          price_range: c.price_range_max > 0 ? `${c.price_range_min} - ${c.price_range_max} บาท` : 'ไม่มีข้อมูล',
          pricing_verdict: c.profile_data?.aiPlaybook?.pricingStrategyVerdict || 'ไม่มีข้อมูล',
          winning_caption: c.profile_data?.aiPlaybook?.winningCaptionTemplate || 'ไม่มีข้อมูล',
          objections: c.profile_data?.aiPlaybook?.priceAdvantageBullets || [],
        })),
      }
    }

    return { error: `Unknown tool: ${name}` }
  } catch (err: any) {
    console.error(`[MerchantCopilot] Tool execution error for ${name}:`, err)
    return { error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Copilot Chat Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function runMerchantCopilotChat({
  shopId,
  userMessage,
  history = [],
}: {
  shopId: string
  userMessage: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<{ responseText: string; toolCallsExecuted: string[] }> {
  try {
    const supabase = createAdminClient()
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shopId).single()

    let apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    if (!apiKey) {
      const { data: setting } = await supabase.from('settings').select('value').eq('key', 'gemini_key').maybeSingle()
      if (setting?.value) {
        apiKey = setting.value
      }
    }

    if (!apiKey) {
      return {
        responseText: 'ขออภัยครับ ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ หรือในตารางการตั้งค่า',
        toolCallsExecuted: [],
      }
    }

    const model = shop?.custom_ai_model || shop?.ai_model || process.env.GEMINI_MODEL || 'gemini-3.8-flash'

    const systemPrompt = `คุณคือ "DealMee Copilot" ผู้ช่วย AI อัจฉริยะประจำตัวเจ้าของร้าน (Merchant Copilot) ของร้าน "${shop?.name || 'ร้านค้า'}"
หน้าที่ของคุณ:
1. วิเคราะห์ข้อมูลธุรกิจ ยอดขาย รายได้ ออเดอร์ ลูกค้า สต็อกสินค้า และคิวการจองของร้าน
2. ตอบคำถามเจ้าของร้านอย่างมืออาชีพ กระชับ ชัดเจน มีตัวเลขและสถิติอ้างอิง
3. ใช้เครื่องมือ (Tools) ที่มีเพื่อดึงข้อมูลจริงจากระบบ ห้ามเดาตัวเลขหรือแต่งข้อมูลขึ้นเอง
4. จัดรูปแบบคำตอบให้อ่านง่าย สวยงาม ใช้ Bullet point, ตาราง Markdown หรือ Emoji ประกอบ
5. ให้คำแนะนำเชิงกลยุทธ์ (Actionable Recommendations) ที่เจ้าของร้านสามารถนำไปปรับใช้เพิ่มยอดขายได้ทันที`

    const turns: any[] = []

    // Add recent history
    if (history && history.length > 0) {
      for (const h of history.slice(-6)) {
        turns.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        })
      }
    }

    // Add current user prompt
    turns.push({
      role: 'user',
      parts: [{ text: userMessage }],
    })

    const toolsPayload = [
      {
        functionDeclarations: COPILOT_TOOLS,
      },
    ]

    const toolCallsExecuted: string[] = []
    const maxSteps = 4
    let currentStep = 0
    let finalAnswer = ''

    while (currentStep < maxSteps) {
      currentStep++

      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: turns,
            tools: toolsPayload,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
            },
          }),
        }
      )

      if (!response.ok && model !== 'gemini-2.5-flash') {
        console.warn(`[MerchantCopilot] ${model} failed, falling back to gemini-2.5-flash...`)
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: turns,
              tools: toolsPayload,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
              },
            }),
          }
        )
      }

      if (!response.ok) {
        console.error('[MerchantCopilot] Gemini API error:', await response.text())
        return {
          responseText: 'ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI กรุณาลองใหม่อีกครั้ง',
          toolCallsExecuted,
        }
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const parts = candidate?.content?.parts || []

      const functionCalls = parts
        .filter((p: any) => !!p.functionCall)
        .map((p: any) => p.functionCall)

      const textParts = parts
        .filter((p: any) => !!p.text)
        .map((p: any) => p.text)
        .join('')

      if (functionCalls.length === 0) {
        finalAnswer = textParts
        break
      }

      // Record model turn with parts as returned by Gemini
      turns.push({
        role: 'model',
        parts: parts,
      })

      // Execute all tools requested by the model in this turn
      const functionResponseParts: any[] = []
      for (const fc of functionCalls) {
        const toolName = fc.name
        const toolArgs = fc.args || {}
        toolCallsExecuted.push(toolName)

        const toolResult = await executeCopilotTool(toolName, toolArgs, shopId)
        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: { result: toolResult },
          },
        })
      }

      turns.push({
        role: 'user',
        parts: functionResponseParts,
      })
    }

    return {
      responseText: finalAnswer || 'ได้รับข้อมูลเรียบร้อยแล้วครับ',
      toolCallsExecuted,
    }
  } catch (err: any) {
    console.error('[MerchantCopilot] Exception:', err)
    return {
      responseText: `เกิดข้อผิดพลาดในการประมวลผล: ${err.message}`,
      toolCallsExecuted: [],
    }
  }
}
