export type ProductFlexData = {
  title: string
  price: string
  stock: string
  desc: string
  tag: string
}

export type QuotationFlexData = {
  docNo: string
  company: string
  items: string
  subtotal: string
  vat: string
  total: string
  validDays: string
}

export type ChatMessage = {
  type: 'user' | 'bot'
  text: string
  time: string
  options?: string[]
  tool?: string
  flexType?: 'product_carousel' | 'quotation'
  flexData?: ProductFlexData | QuotationFlexData
}

export type Scenario = {
  key: string
  label: string
  subtitle: string
  botName: string
  botEmoji: string
  messages: ChatMessage[]
}

export type PackageTier = {
  id: string
  key: 'starter' | 'standard' | 'elite' | 'enterprise'
  name: string
  price: number
  msgLimit: number // -1 = unlimited
  productLimit: number // -1 = unlimited
  aiCredits: number
  description: string
  featured?: boolean
  badge?: string
  features: {
    ai_chat: boolean
    line_oa: boolean
    order_taking: boolean
    shipping_calc: boolean
    slip_check: boolean
    quotation_b2b: boolean
    customer_memory: boolean
    booking_system: boolean
    proactive_followup: boolean
    broadcast: boolean
    analytics: boolean
    custom_prompt: boolean
    priority_support: boolean
    api_erp: boolean
  }
}

export type FeatureRow = {
  category: string
  label: string
  description?: string
  starter: string | boolean
  standard: string | boolean
  elite: string | boolean
  enterprise: string | boolean
}
