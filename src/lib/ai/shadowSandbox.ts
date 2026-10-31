import type { AgentToolName } from './salesAgentEngine'
import type { ToolExecutionContext, ToolExecutionResult, ToolExecutor } from './toolDispatcher'
import { redactPii } from './redactPii'

/**
 * Tools that only read this shop's catalog, knowledge, bookings, or orders.
 * Everything else is refused. Read tools can still update the sales stage in
 * the live dispatcher, so callers must pass dryRun.
 */
export const SHADOW_READ_TOOLS = new Set<AgentToolName>([
  'search_products',
  'check_stock',
  'check_order_status',
  'check_available_slots',
  'check_booking',
  'calculate_shipping',
  'get_customer_history',
  'check_loyalty_points',
  'search_knowledge_base',
  'get_active_promotions',
])

export function shadowBlockedToolMessage(toolName: string): string {
  return `โหมดทดสอบ: ไม่ได้ดำเนินการ ${toolName} ไม่ได้ส่งข้อความให้ลูกค้า ไม่ได้สร้างออเดอร์หรือการจอง และไม่ได้แก้ข้อมูลร้าน`
}

export function redactShadowToolText(text: string): string {
  return redactPii(text || '')
    .replace(/ลูกค้า:\s*[^\n(]+/g, 'ลูกค้า: [ชื่อ] ')
}

/**
 * Wraps tool execution for a shadow replay. Write tools never reach the real
 * dispatcher. Read tools run with dryRun. Nothing is returned for the channel
 * to send.
 */
export function createShadowExecutor(real: ToolExecutor): ToolExecutor {
  return async (toolName, args, ctx) => {
    if (!SHADOW_READ_TOOLS.has(toolName)) {
      return { resultForAi: shadowBlockedToolMessage(toolName), immediateMessages: [] }
    }
    const next: ToolExecutionContext = { ...ctx, dryRun: true }
    const result = await real(toolName, args, next)
    const safe: ToolExecutionResult = {
      resultForAi: redactShadowToolText(result.resultForAi || ''),
      immediateMessages: [],
    }
    if (result.productsData && result.productsData.length > 0) safe.productsData = result.productsData
    return safe
  }
}
