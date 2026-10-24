export type SupportedPlatform =
  | 'line'
  | 'facebook'
  | 'tiktok'
  | 'shopee'
  | 'lazada'
  | 'instagram'
  | 'web'

export type AiMode = 'auto' | 'copilot' | 'manual'

export interface ChannelAccount {
  id: string
  shop_id: string
  platform: SupportedPlatform
  account_name: string
  account_id: string
  avatar_url?: string | null
  is_active: boolean
  ai_mode_default: AiMode
  credentials?: Record<string, any>
  webhook_secret?: string | null
  settings?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ConversationOmnichannel {
  id: string
  shop_id: string
  user_id: string
  customer_name: string
  customer_avatar: string | null
  platform: string
  last_message: string | null
  last_message_at: string
  unread_count: number
  status: 'ai' | 'human' | 'closed'
  ai_mode?: AiMode
  /** While the admin is on the chat: when the bot takes it back by itself */
  paused_until?: string | null
  platform_sender_id?: string | null
  channel_account_id?: string | null
  metadata?: Record<string, any>
  sales_stage?: string | null
  created_at: string
}

export interface ChatMessageOmnichannel {
  id: string
  conversation_id: string
  shop_id: string
  sender_type: 'user' | 'bot' | 'agent' | 'system'
  sender_name: string | null
  message: string
  platform?: string
  platform_message_id?: string | null
  ai_suggested_reply?: string | null
  attachments?: any[]
  metadata?: Record<string, any>
  created_at: string
}

/**
 * Metadata and UI config for each supported platform
 */
export const PLATFORM_CONFIG: Record<
  SupportedPlatform,
  {
    name: string
    color: string
    bgColor: string
    borderColor: string
    badgeClass: string
    shortLabel: string
  }
> = {
  line: {
    name: 'LINE OA',
    color: '#06C755',
    bgColor: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-emerald-200',
    badgeClass: 'bg-[#06C755]/10 text-[#06C755] border-[#06C755]/20',
    shortLabel: 'LINE',
  },
  facebook: {
    name: 'Facebook Page',
    color: '#1877F2',
    bgColor: 'bg-blue-50 text-blue-700',
    borderColor: 'border-blue-200',
    badgeClass: 'bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/20',
    shortLabel: 'FB',
  },
  tiktok: {
    name: 'TikTok Shop',
    color: '#000000',
    bgColor: 'bg-slate-100 text-slate-800',
    borderColor: 'border-slate-300',
    badgeClass: 'bg-black/10 text-slate-900 border-black/20',
    shortLabel: 'TikTok',
  },
  shopee: {
    name: 'Shopee',
    color: '#EE4D2D',
    bgColor: 'bg-orange-50 text-orange-700',
    borderColor: 'border-orange-200',
    badgeClass: 'bg-[#EE4D2D]/10 text-[#EE4D2D] border-[#EE4D2D]/20',
    shortLabel: 'Shopee',
  },
  lazada: {
    name: 'Lazada',
    color: '#0F146D',
    bgColor: 'bg-indigo-50 text-indigo-700',
    borderColor: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    shortLabel: 'Lazada',
  },
  instagram: {
    name: 'Instagram',
    color: '#E4405F',
    bgColor: 'bg-rose-50 text-rose-700',
    borderColor: 'border-rose-200',
    badgeClass: 'bg-[#E4405F]/10 text-[#E4405F] border-[#E4405F]/20',
    shortLabel: 'IG',
  },
  web: {
    name: 'Web Chat',
    color: '#2E5BFF',
    bgColor: 'bg-blue-50 text-blue-700',
    borderColor: 'border-blue-200',
    badgeClass: 'bg-[#2E5BFF]/10 text-[#2E5BFF] border-[#2E5BFF]/20',
    shortLabel: 'Web',
  },
}

/**
 * Standardizes raw platform strings into clean SupportedPlatform key
 */
export function normalizePlatform(rawPlatform?: string | null): SupportedPlatform {
  if (!rawPlatform) return 'line'
  const lower = rawPlatform.toLowerCase().trim()
  if (lower === 'line') return 'line'
  if (lower === 'facebook' || lower === 'fb' || lower === 'messenger') return 'facebook'
  if (lower === 'tiktok') return 'tiktok'
  if (lower === 'shopee') return 'shopee'
  if (lower === 'lazada') return 'lazada'
  if (lower === 'instagram' || lower === 'ig') return 'instagram'
  if (lower === 'web') return 'web'
  return 'line'
}

/**
 * AI Mode labels and badges
 */
export const AI_MODE_CONFIG: Record<
  AiMode,
  {
    label: string
    badgeClass: string
    description: string
  }
> = {
  auto: {
    label: '🤖 Auto (AI ปิดดีล 24/7)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'AI ตอบลูกค้าและปิดการขายอัตโนมัติ',
  },
  copilot: {
    label: '💡 Copilot (AI ร่าง แอดมินกดส่ง)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'AI ช่วยคิดคำตอบให้แอดมินคลิกส่ง',
  },
  manual: {
    label: '👤 Manual (แอดมินตอบเอง)',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'แอดมินตอบข้อความด้วยตนเอง 100%',
  },
}
