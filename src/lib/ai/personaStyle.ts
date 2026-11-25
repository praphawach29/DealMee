/**
 * Turns the "บุคลิกและน้ำเสียงการพูด" dropdown (shops.personality) into rules
 * the model can follow.
 *
 * The prompt used to carry only the raw value ("บุคลิกภาพ: ชาย-สุภาพ"). The
 * hints a merchant sees in the dropdown ("ลงท้ายครับ", "มีอีโมจิ") never reached
 * the model, every example in the sales prompt ends in คะ, so a shop that
 * picked a male voice still got ค่ะ/คะ. Q&A-only shops got no voice at all.
 *
 * Dependency-free so tests/ can import it directly.
 */

const PERSONAS: Record<string, string> = {
  'หญิง-สุภาพ':
    'ผู้หญิง สุภาพ เรียบร้อย มืออาชีพ แทนตัวเองว่า "เรา" หรือชื่อบอท ลงท้ายประโยคบอกเล่าด้วย "ค่ะ" ประโยคคำถามด้วย "คะ" หรือ "นะคะ" ใช้อีโมจิไม่เกิน 1 ตัวต่อข้อความ',
  'หญิง-น่ารัก':
    'ผู้หญิง น่ารัก สดใส เป็นกันเอง ลงท้ายด้วย "ค่ะ" "คะ" "นะคะ" ใช้คำอย่าง "เลยค่า" ได้บ้าง ใช้อีโมจิ 1-2 ตัวต่อข้อความ',
  'ชาย-สุภาพ':
    'ผู้ชาย สุภาพ มืออาชีพ แทนตัวเองว่า "ผม" หรือชื่อบอท ลงท้ายทุกประโยคด้วย "ครับ" ห้ามใช้ "ค่ะ" "คะ" "นะคะ" ไม่ใช้อีโมจิ',
  'ชาย-เป็นกันเอง':
    'ผู้ชาย เป็นกันเอง สนิทสนมแต่ยังสุภาพ แทนตัวเองว่า "ผม" ลงท้ายด้วย "ครับ" หรือ "นะครับ" ห้ามใช้ "ค่ะ" "คะ" "นะคะ" ใช้อีโมจิได้ไม่เกิน 1 ตัวต่อข้อความ',
}

const DEFAULT_PERSONA = 'สุภาพ เรียบร้อย มืออาชีพ เป็นมิตรและมีไหวพริบในการขายสูง'

/** True when this persona is a male voice, so the female examples in the prompt must be rewritten. */
export function isMalePersona(personality: unknown): boolean {
  return typeof personality === 'string' && personality.trim().startsWith('ชาย')
}

/**
 * The persona block for the prompt. A dropdown value becomes explicit rules;
 * anything else (an old free-text value) is passed through as written.
 */
export function formatPersona(personality: unknown): string {
  const raw = typeof personality === 'string' ? personality.trim() : ''
  const rules = PERSONAS[raw] || raw || DEFAULT_PERSONA
  const lines = [`บุคลิกภาพและน้ำเสียง: ${rules}`]
  if (isMalePersona(raw)) {
    lines.push('ตัวอย่างประโยคในคำสั่งด้านล่างเขียนลงท้ายแบบผู้หญิง (ค่ะ/คะ) ให้เปลี่ยนเป็น "ครับ" ทุกครั้งเวลาใช้จริง')
  }
  lines.push('ใช้น้ำเสียงนี้ทุกข้อความ เว้นแต่คำสั่งเฉพาะจากเจ้าของร้านกำหนดไว้ต่างออกไป')
  return lines.join('\n')
}
