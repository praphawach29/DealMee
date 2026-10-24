// Mirrors the `plans` table (keys, prices, monthly allowances)
export type PlanKey = 'starter' | 'pro' | 'agency' | 'byok'

export type PackageTier = {
  key: PlanKey
  name: string
  price: number // THB per 30 days, paid from the prepaid wallet
  msgLimit: number // -1 = unlimited (BYOK uses the shop's own Gemini key)
  slipLimit: number // automatic slip checks per month
  description: string
  featured?: boolean
  badge?: string
  features: {
    order_taking: boolean
    quotation_b2b: boolean
    booking_system: boolean
    own_api_key: boolean
    priority_support: boolean
  }
}

export type AddonPack = {
  kind: 'messages' | 'slips'
  quantity: number
  price: number
}

export type FeatureRow = {
  category: string
  label: string
  description?: string
  starter: string | boolean
  pro: string | boolean
  agency: string | boolean
  byok: string | boolean
}
