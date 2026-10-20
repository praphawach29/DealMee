'use server'

import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { effectivePlanKey } from '@/lib/billing/trial'
import { canEncrypt, testPlatformSecret } from '@/lib/platformSecrets'
import {
  clearShopAiKey,
  getShopAiKeyStatus,
  setShopAiKey,
  SHOP_AI_PROVIDERS,
  type ShopAiProvider,
  type ShopAiKeyStatus,
} from '@/lib/billing/shopAiKey'

const TEST_NAME = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', claude: 'CLAUDE_API_KEY' } as const

async function currentShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateShopForUser(supabase, user)
}

export async function getByokStatusAction(): Promise<{ onByokPlan: boolean; status: ShopAiKeyStatus | null } | { error: string }> {
  const shop = await currentShop()
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }
  try {
    return { onByokPlan: effectivePlanKey(shop) === 'byok', status: await getShopAiKeyStatus(shop.id) }
  } catch (err: any) {
    return { error: err.message }
  }
}

/** Tests the key with the provider, then saves it encrypted. */
export async function saveByokKeyAction(provider: string, key: string): Promise<{ success: string } | { error: string }> {
  const shop = await currentShop()
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }
  if (effectivePlanKey(shop) !== 'byok') return { error: 'ใช้ได้กับแพ็กเกจ BYOK เท่านั้น' }
  if (!SHOP_AI_PROVIDERS.includes(provider as ShopAiProvider)) return { error: 'ผู้ให้บริการไม่ถูกต้อง' }
  const value = key.trim()
  if (value.length < 20) return { error: 'API Key สั้นเกินไป กรุณาตรวจสอบอีกครั้ง' }
  if (!canEncrypt()) return { error: 'ระบบยังบันทึก key ไม่ได้ กรุณาติดต่อทีมงาน DealMee' }

  const test = await testPlatformSecret(TEST_NAME[provider as ShopAiProvider], value)
  if (test && !test.ok) return { error: `ทดสอบ key ไม่ผ่าน: ${test.message}` }

  try {
    await setShopAiKey(shop.id, provider as ShopAiProvider, value)
  } catch (err: any) {
    return { error: err.message }
  }
  return { success: test?.message === 'key ใช้งานได้' ? 'บันทึกแล้ว key ใช้งานได้' : `บันทึกแล้ว (${test?.message || 'ไม่ได้ทดสอบ'})` }
}

export async function clearByokKeyAction(): Promise<{ success: string } | { error: string }> {
  const shop = await currentShop()
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }
  try {
    await clearShopAiKey(shop.id)
  } catch (err: any) {
    return { error: err.message }
  }
  return { success: 'ลบ key แล้ว' }
}
