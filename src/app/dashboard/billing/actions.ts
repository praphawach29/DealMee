'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { effectivePlanKey } from '@/lib/billing/trial'

export type WalletActionResult =
  | { success: true; message: string; balance: number }
  | { success: false; error: string; needed?: number }

async function currentShop() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, shop: null }
  return { user, shop: await getOrCreateShopForUser(supabase, user) }
}

function formatBaht(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function insufficient(data: any): WalletActionResult {
  const needed = Math.max(0, Number(data?.needed || 0))
  return {
    success: false,
    error: `ยอดเงินในกระเป๋าไม่พอ ต้องเติมอีก ${formatBaht(needed)}`,
    needed: Math.ceil(needed),
  }
}

/** Buys (or switches to) a monthly plan with the wallet balance. */
export async function buyPlanWithWallet(planKey: string): Promise<WalletActionResult> {
  const { user, shop } = await currentShop()
  if (!user || !shop?.id) return { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('wallet_buy_plan', {
    p_shop_id: shop.id,
    p_plan_key: planKey,
    p_actor: user.id,
  })
  if (error) {
    console.error('[Wallet] buy plan failed:', error.message)
    return { success: false, error: 'ซื้อแพ็กเกจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }
  }
  if (!data?.success) {
    if (data?.error === 'insufficient_balance') return insufficient(data)
    return { success: false, error: 'แพ็กเกจนี้ซื้อไม่ได้' }
  }

  revalidatePath('/dashboard', 'layout')
  const until = new Date(data.plan_expires_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })
  const credit = Number(data.credit || 0)
  return {
    success: true,
    balance: Number(data.balance),
    message: `เปิดใช้แพ็กเกจ ${String(data.plan_key).toUpperCase()} แล้ว ใช้งานได้ถึง ${until}${credit > 0 ? ` (คืนมูลค่าวันที่เหลือของแพ็กเกจเดิม ${formatBaht(credit)})` : ''}`,
  }
}

/** Buys a message or slip-check add-on pack with the wallet balance. */
export async function buyAddonWithWallet(addonKey: string): Promise<WalletActionResult> {
  const { user, shop } = await currentShop()
  if (!user || !shop?.id) return { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }

  const admin = createAdminClient()
  const { data: pack } = await admin.from('addon_packs').select('kind').eq('key', addonKey).maybeSingle()
  // Free shops don't get automatic slip checks, so a slip pack would never be used
  if (pack?.kind === 'slips' && effectivePlanKey(shop) === 'free') {
    return { success: false, error: 'แพ็กตรวจสลิปใช้ได้กับแพ็กเกจแบบชำระเงินเท่านั้น กรุณาซื้อแพ็กเกจก่อน' }
  }

  const { data, error } = await admin.rpc('wallet_buy_addon', {
    p_shop_id: shop.id,
    p_addon_key: addonKey,
    p_actor: user.id,
  })
  if (error) {
    console.error('[Wallet] buy add-on failed:', error.message)
    return { success: false, error: 'ซื้อแพ็กเสริมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }
  }
  if (!data?.success) {
    if (data?.error === 'insufficient_balance') return insufficient(data)
    return { success: false, error: 'แพ็กเสริมนี้ซื้อไม่ได้' }
  }

  revalidatePath('/dashboard/billing')
  const until = new Date(data.expires_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })
  const unit = data.kind === 'slips' ? 'ครั้ง' : 'ข้อความ'
  return {
    success: true,
    balance: Number(data.balance),
    message: `เพิ่ม ${Number(data.quantity).toLocaleString('th-TH')} ${unit} แล้ว ใช้ได้ถึง ${until}`,
  }
}

/** Turns automatic renewal from the wallet on or off. */
export async function setWalletAutoRenew(autoRenew: boolean): Promise<{ success: boolean; error?: string }> {
  const { user, shop } = await currentShop()
  if (!user || !shop?.id) return { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('shop_wallets')
    .upsert({ shop_id: shop.id, auto_renew: autoRenew, updated_at: new Date().toISOString() }, { onConflict: 'shop_id' })
  if (error) {
    console.error('[Wallet] auto-renew update failed:', error.message)
    return { success: false, error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }
  }
  revalidatePath('/dashboard/billing')
  return { success: true }
}
