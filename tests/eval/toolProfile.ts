import type { ToolDeclaration } from './providers.ts'

export type EvalToolProfile = 'full' | 'read_only'

const READ_ONLY_TOOLS = new Set(['search_products', 'check_stock', 'search_knowledge_base'])

export function evalToolProfile(value: string | undefined): EvalToolProfile {
  if (!value || value === 'full') return 'full'
  if (value === 'read_only') return value
  throw new Error('EVAL_TOOL_PROFILE must be full or read_only')
}

export function selectEvalTools<Tool extends ToolDeclaration>(tools: Tool[], profile: EvalToolProfile): Tool[] {
  return profile === 'read_only' ? tools.filter((tool) => READ_ONLY_TOOLS.has(tool.name)) : tools
}

export function evalProfileInstruction(profile: EvalToolProfile): string {
  if (profile !== 'read_only') return ''
  return '\n\n[โหมดทดสอบอ่านข้อมูลเท่านั้น]\nห้ามรับออเดอร์ รับเงิน แก้ไขข้อมูล หรืออ้างว่าทำธุรกรรมสำเร็จ หากลูกค้าถามสินค้า ราคา หรือสต๊อก ต้องเรียก search_products หรือ check_stock ที่มีให้ก่อนตอบทุกครั้ง เพื่อยืนยันข้อมูลล่าสุด แม้มีข้อมูลในแคตตาล็อกแล้ว หากถามนโยบายร้านให้ใช้ search_knowledge_base ที่มีให้ ห้ามเรียกเครื่องมือที่ไม่มีในรายการ หากทำไม่ได้ให้แจ้งข้อจำกัดโดยไม่อ้างว่าส่งเรื่องหรือทำรายการแล้ว'
}
