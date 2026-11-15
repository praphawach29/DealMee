/**
 * Masks customer personal data before text is stored or sent to a model.
 * Shop catalog prices and short counts are left alone. This cannot reliably
 * detect a person's name in free text.
 */
export function redactPii(text: string): string {
  if (!text) return ''
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[อีเมล]')
    .replace(/\bU[0-9a-f]{32}\b/gi, '[LINE ID]')
    .replace(/\+66(?:[\s.-]?\d){8,9}\b/g, '[เบอร์โทร]')
    .replace(/\b0\d{1,2}[\s.-]\d{3}[\s.-]\d{4}\b/g, '[เบอร์โทร]')
    .replace(/\b0\d{8,9}\b/g, '[เบอร์โทร]')
    .replace(/\b\d-\d{4}-\d{5}-\d{2}-\d\b/g, '[เลขบัตรประชาชน]')
    .replace(/\b\d{13}\b/g, '[เลขบัตรประชาชน]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[เลขบัตร]')
    .replace(/\b\d{15,16}\b/g, '[รหัสผู้ใช้]')
    .replace(/\b\d{10,12}\b/g, '[เลขบัญชี]')
    .replace(/\b(?:ORD|BK|QT|INV|SO)-\d+\b/gi, '[เลขที่เอกสาร]')
}
