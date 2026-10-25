/**
 * The sales stage, as the model judged it from the whole conversation.
 *
 * The keyword rules in salesWorkflow.ts can't read meaning ("โอเค จัดมาเลย" has no order keyword,
 * "ยังไม่เอาเลย" has one). The model already reads every message to answer it, so it also ends its
 * reply with a tag such as [[stage:closing]]. The server takes the tag off before anything is sent
 * and uses it as the stage; without a usable tag the keyword rules decide, as before.
 *
 * Dependency-free (type imports are erased) so tests/ can import it directly.
 */
import type { SalesStage } from './salesWorkflow'

const MODEL_STAGES = new Set<SalesStage>(['greeting', 'discovery', 'showcase', 'closing', 'post_sale'])

/** Any stage tag, well-formed or not, so a malformed one never reaches the customer */
const TAG = /\[\[\s*stage\b[^\]\n]*\]?\]?/gi

/** Shown to the model in the dynamic system prompt. The tag must stay on its last line. */
export const STAGE_TAG_INSTRUCTION = `
[รายงานขั้นการขาย — ระบบอ่านเอง ลูกค้าไม่เห็น]
- บรรทัดสุดท้ายของทุกคำตอบ ให้ใส่ป้าย [[stage:ค่า]] หนึ่งป้าย บอกขั้นของลูกค้าหลังข้อความล่าสุด ค่าเป็นหนึ่งใน:
  greeting = แค่ทักทาย ยังไม่บอกว่าต้องการอะไร
  discovery = เล่าความต้องการหรือขอให้แนะนำ ยังไม่เจาะจงสินค้า
  showcase = ถามหรือพิจารณาสินค้า ราคา ต่อรอง หรือยังลังเล
  closing = ตกลงจะซื้อหรือจอง ยืนยันออเดอร์ หรือถามวิธีจ่ายเงิน
- ตัดสินจากความหมายทั้งบทสนทนา ไม่ใช่คำใดคำหนึ่ง เช่น "ยังไม่เอาเลยค่ะ" ไม่ใช่ closing แต่ "โอเค จัดมาเลย" หลังสรุปออเดอร์คือ closing`

/** Removes every stage tag from `text` and returns the last valid stage it named, if any. */
export function extractStageTag(text: string): { text: string; stage: SalesStage | null } {
  let stage: SalesStage | null = null
  for (const match of text.matchAll(TAG)) {
    const value = /stage\s*[:：=]\s*([a-z_]+)/i.exec(match[0])?.[1]?.toLowerCase() as SalesStage | undefined
    if (value && MODEL_STAGES.has(value)) stage = value
  }
  const cleaned = text
    .replace(TAG, '')
    .replace(/\[\[[a-z_\s:]*$/i, '') // a tag cut off mid-way at the end of a truncated reply
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: cleaned, stage }
}
