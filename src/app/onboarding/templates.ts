// Business templates offered at onboarding. `type` becomes shops.business_type.
export const TEMPLATES = [
  { id: 'beauty', emoji: '💄', label: 'ความงาม & เครื่องสำอาง', type: 'retail', description: 'ร้านขายสกินแคร์, เครื่องสำอาง, เวชสำอาง' },
  { id: 'food', emoji: '🍜', label: 'อาหาร & เครื่องดื่ม', type: 'restaurant', description: 'ร้านอาหาร, ร้านเครื่องดื่ม, เดลิเวอรี่' },
  { id: 'fashion', emoji: '👕', label: 'เสื้อผ้า & แฟชั่น', type: 'retail', description: 'ร้านเสื้อผ้า, แบรนด์แฟชั่น, อุปกรณ์เสริม' },
  { id: 'clinic', emoji: '🏥', label: 'คลินิก & สุขภาพ', type: 'booking', description: 'คลินิกความงาม, คลินิกทั่วไป, ทันตกรรม' },
  { id: 'spa', emoji: '💆', label: 'สปา & นวด', type: 'booking', description: 'สปา, ร้านนวด, ร้านอโรมา' },
  { id: 'it', emoji: '💻', label: 'ไอที & อิเล็กทรอนิกส์', type: 'retail', description: 'ร้านคอมพิวเตอร์, มือถือ, อุปกรณ์ IT' },
  { id: 'fitness', emoji: '💪', label: 'ฟิตเนส & คลาสเรียน', type: 'booking', description: 'ฟิตเนส, โยคะ, มวย, คลาสเรียนต่างๆ' },
  { id: 'auto', emoji: '🔧', label: 'อู่ซ่อมรถ & ยานยนต์', type: 'booking', description: 'อู่ซ่อมรถ, เปลี่ยนยาง, ล้างรถ' },
  { id: 'retail', emoji: '📦', label: 'ร้านค้าทั่วไป', type: 'retail', description: 'ร้านค้าออนไลน์, ขายสินค้าทั่วไป' },
]

export function businessTypeForTemplate(templateId: string | null | undefined): string {
  return TEMPLATES.find((t) => t.id === templateId)?.type || 'retail'
}
