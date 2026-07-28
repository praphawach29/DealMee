export type GreetingTemplateSummary = {
  name: string
  booking_type?: string | null
  resource_label?: string | null
  staff_name?: string | null
}

type GreetingProfile = {
  tone: string
  primaryAction: string
  prompt: string
}

const DEFAULT_GREETING_TH = 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?'

const PROFILE_BY_BOOKING_TYPE: Record<string, GreetingProfile> = {
  table: {
    tone: 'ร้านอาหาร/จองโต๊ะ',
    primaryAction: 'จองโต๊ะ',
    prompt: 'ต้องการจองโต๊ะ สอบถามเวลา หรือแจ้งจำนวนท่านได้เลยนะคะ',
  },
  class: {
    tone: 'คลาส/กิจกรรม',
    primaryAction: 'จองคลาส',
    prompt: 'ต้องการดูรอบคลาส เช็กที่นั่งว่าง หรือจองคลาสได้เลยนะคะ',
  },
  queue: {
    tone: 'จองคิวทั่วไป',
    primaryAction: 'จองคิว',
    prompt: 'ต้องการจองคิว เช็กคิวว่าง หรือเลื่อนคิวแจ้งได้เลยนะคะ',
  },
  consultation: {
    tone: 'นัดปรึกษา',
    primaryAction: 'นัดปรึกษา',
    prompt: 'ต้องการนัดปรึกษา แจ้งวันเวลาและรายละเอียดเบื้องต้นได้เลยนะคะ',
  },
  service: {
    tone: 'ธุรกิจบริการ',
    primaryAction: 'จองบริการ',
    prompt: 'ต้องการสอบถามรายละเอียดหรือจองบริการ แจ้งบริการและเวลาที่สะดวกได้เลยนะคะ',
  },
}

const PROFILE_BY_TEMPLATE: Record<string, GreetingProfile> = {
  food: PROFILE_BY_BOOKING_TYPE.table,
  clinic: {
    tone: 'คลินิก/สุขภาพ',
    primaryAction: 'นัดหมาย',
    prompt: 'ต้องการนัดหมาย สอบถามบริการ หรือแจ้งวันเวลาที่สะดวกได้เลยนะคะ',
  },
  spa: {
    tone: 'สปา/นวด',
    primaryAction: 'จองคิวสปา',
    prompt: 'ต้องการจองคิว สอบถามแพ็กเกจ หรือเลือกช่วงเวลาที่สะดวกได้เลยนะคะ',
  },
  fitness: PROFILE_BY_BOOKING_TYPE.class,
  auto: {
    tone: 'อู่/ยานยนต์',
    primaryAction: 'นัดเข้ารับบริการ',
    prompt: 'ต้องการนัดเข้ารับบริการ แจ้งประเภทรถ อาการเบื้องต้น และเวลาที่สะดวกได้เลยนะคะ',
  },
  beauty: {
    tone: 'ความงาม/สินค้า',
    primaryAction: 'สอบถามสินค้า',
    prompt: 'ต้องการสอบถามสินค้า แนะนำสกินแคร์ หรือดูโปรโมชัน แจ้งได้เลยนะคะ',
  },
  fashion: {
    tone: 'แฟชัน/สินค้า',
    primaryAction: 'สอบถามสินค้า',
    prompt: 'ต้องการดูสินค้า ไซซ์ สี หรือโปรโมชัน แจ้งได้เลยนะคะ',
  },
  it: {
    tone: 'ไอที/อุปกรณ์',
    primaryAction: 'สอบถามสินค้า',
    prompt: 'ต้องการสอบถามรุ่น ราคา สเปก หรือสินค้าแนะนำ แจ้งได้เลยนะคะ',
  },
  retail: {
    tone: 'ร้านค้าออนไลน์',
    primaryAction: 'สอบถามสินค้า',
    prompt: 'ต้องการสอบถามสินค้า ราคา โปรโมชัน หรือช่องทางชำระเงิน แจ้งได้เลยนะคะ',
  },
}

const PROFILE_BY_BUSINESS_TYPE: Record<string, GreetingProfile> = {
  restaurant: PROFILE_BY_BOOKING_TYPE.table,
  booking: PROFILE_BY_BOOKING_TYPE.service,
  retail: PROFILE_BY_TEMPLATE.retail,
}

const BOOKING_PRIORITY = ['table', 'class', 'queue', 'consultation', 'service']

export function isDefaultGreeting(value?: string | null) {
  const text = (value || '').trim()
  return !text || text === DEFAULT_GREETING_TH || text.includes('มีอะไรให้ช่วยไหม')
}

export function getGreetingProfile(shop: any, templates: GreetingTemplateSummary[] = []) {
  const templateTypes = new Set(templates.map((item) => item.booking_type).filter(Boolean) as string[])
  const bookingType = BOOKING_PRIORITY.find((type) => templateTypes.has(type))
  if (bookingType) return PROFILE_BY_BOOKING_TYPE[bookingType]

  const aiTemplate = String(shop?.ai_template || '').trim()
  if (aiTemplate && PROFILE_BY_TEMPLATE[aiTemplate]) return PROFILE_BY_TEMPLATE[aiTemplate]

  const businessType = String(shop?.business_type || '').trim()
  if (businessType && PROFILE_BY_BUSINESS_TYPE[businessType]) return PROFILE_BY_BUSINESS_TYPE[businessType]

  return PROFILE_BY_TEMPLATE.retail
}

export function buildAutoGreeting(shop: any, templates: GreetingTemplateSummary[] = []) {
  const botName = shop?.bot_name || 'น้อง Botify'
  const shopName = shop?.name || 'ร้านของเรา'
  const profile = getGreetingProfile(shop, templates)
  const activeNames = templates.slice(0, 3).map((item) => item.name).filter(Boolean)
  const serviceLine = activeNames.length > 0 ? ` ตอนนี้มีบริการ ${activeNames.join(', ')} ให้เลือกค่ะ` : ''

  return `สวัสดีค่ะ ${botName} จากร้าน ${shopName} ยินดีให้บริการค่ะ${serviceLine} ${profile.prompt}`
}

export function buildBusinessPromptContext(shop: any, templates: GreetingTemplateSummary[] = []) {
  const profile = getGreetingProfile(shop, templates)
  return `[บริบทคำทักทายของร้าน]
ประเภทธุรกิจ/บริการหลัก: ${profile.tone}
เป้าหมายหลักของบทสนทนาแรก: ${profile.primaryAction}
แนวทักทาย: ${profile.prompt}`
}

export function getBusinessTypeForTemplate(templateId: string) {
  const map: Record<string, string> = {
    food: 'restaurant',
    clinic: 'booking',
    spa: 'booking',
    fitness: 'booking',
    auto: 'booking',
    beauty: 'retail',
    fashion: 'retail',
    it: 'retail',
    retail: 'retail',
  }
  return map[templateId] || 'retail'
}
