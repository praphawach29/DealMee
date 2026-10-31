/** Shop-level cash-on-delivery gate. The settings checkbox is the source of truth. */

export function shopCodEnabled(shop: { cod_enabled?: boolean | null } | null | undefined): boolean {
  return shop?.cod_enabled === true
}

export function isCodPaymentMethod(method: unknown): boolean {
  return /ปลายทาง|\bcod\b/i.test(String(method || ''))
}

/** Returned to the model when it tries to save a COD order the shop has not enabled. */
export function codOrderRefusal(shop: { cod_enabled?: boolean | null } | null | undefined, method: unknown): string | null {
  if (!isCodPaymentMethod(method) || shopCodEnabled(shop)) return null
  return 'ร้านนี้ไม่ได้เปิดเก็บเงินปลายทาง ห้ามสร้างออเดอร์แบบ COD และห้ามเสนอเก็บปลายทางให้ลูกค้า ให้ถามช่องทางโอนหรือพร้อมเพย์ที่ร้านเปิดอยู่แทน'
}

export function codObjectionLine(codEnabled: boolean): string {
  if (codEnabled) {
    return '- [กังวลเรื่องการจัดส่ง / ความปลอดภัย]: แจ้งรอบจัดส่งด่วน มีเลขพัสดุติดตาม และมีช่องทางชำระเงินที่สบายใจ (เช่น โอนสแกน QR หรือ เก็บเงินปลายทาง)'
  }
  return '- [กังวลเรื่องการจัดส่ง / ความปลอดภัย]: แจ้งรอบจัดส่งด่วน มีเลขพัสดุติดตาม และมีช่องทางชำระเงินที่สบายใจ (เช่น โอนสแกน QR) ห้ามเสนอเก็บเงินปลายทาง'
}

export function codCloseExample(codEnabled: boolean): string {
  if (codEnabled) return '  - "สะดวกชำระเป็น โอนสแกน QR พร้อมเพย์ หรือ เก็บเงินปลายทาง ดีคะ?"'
  return '  - "สะดวกชำระเป็น โอนสแกน QR พร้อมเพย์ หรือ โอนบัญชีธนาคาร ดีคะ?"'
}

export function codPaymentRule(codEnabled: boolean): string {
  if (codEnabled) {
    return '- ถ้ายังขาดวิธีชำระเงิน ให้เสนอทางเลือกจากข้อมูลร้าน เช่น พร้อมเพย์/โอนธนาคาร/เก็บปลายทาง แล้วถามให้ลูกค้าเลือก ก่อนเรียก take_order'
  }
  return '- ร้านนี้ไม่เปิดเก็บเงินปลายทาง ห้ามเสนอหรือรับออเดอร์แบบเก็บเงินปลายทาง/COD ถ้าลูกค้าขอ ให้บอกว่าตอนนี้รับโอนหรือพร้อมเพย์เท่านั้น'
}
