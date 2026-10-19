'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  PlatformBillingSettings,
  getPlatformBillingSettings,
} from '@/lib/billing/manualBilling'
import { SUPER_ADMIN_EMAILS } from '@/app/admin/layout'
import { canCarryAlerts, notifyPlatformOwner } from '@/lib/billing/platformAlerts'

async function assertSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('กรุณาเข้าสู่ระบบ')
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSuperAdmin =
    dbUser?.role === 'superadmin' ||
    SUPER_ADMIN_EMAILS.includes(user.email || '') ||
    user.email === 'admin@dealmee.app' ||
    user.email === 'admin@botify.ai' ||
    user.email === 'jack291625@gmail.com'

  if (!isSuperAdmin) {
    throw new Error('สิทธิ์การเข้าถึงถูกปฏิเสธ (Super Admin Only)')
  }

  return user
}

export async function getPaymentsList(statusFilter?: string) {
  await assertSuperAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('billing_payments')
    .select(
      `
      id,
      shop_id,
      plan_key,
      amount,
      billed_amount,
      withheld_amount,
      transferred_amount,
      currency,
      status,
      slip_url,
      slip_reference,
      receipt_number,
      verified_at,
      verified_by,
      rejected_reason,
      customer_notes,
      created_at,
      shops:shop_id (
        name,
        bot_name
      )
    `
    )
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('[AdminPayments] Error fetching payments:', error)
    return []
  }

  return (data || []).map((p: any) => ({
    ...p,
    shop_name: p.shops?.name || 'ไม่ระบุชื่อร้าน',
    shop_bot_name: p.shops?.bot_name,
  }))
}

export async function verifyPaymentAction(paymentId: string) {
  const adminUser = await assertSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('verify_manual_payment', {
    p_payment_id: paymentId,
    p_admin_id: adminUser.id,
  })

  if (error) {
    console.error('[AdminPayments] Verify error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/payments')
  revalidatePath('/dashboard/billing')
  return { success: true, data }
}

export async function rejectPaymentAction(paymentId: string, reason: string) {
  const adminUser = await assertSuperAdmin()
  const admin = createAdminClient()

  if (!reason.trim()) {
    return { success: false, error: 'กรุณาระบุเหตุผลการปฏิเสธ' }
  }

  const { data, error } = await admin.rpc('reject_manual_payment', {
    p_payment_id: paymentId,
    p_reason: reason.trim(),
    p_admin_id: adminUser.id,
  })

  if (error) {
    console.error('[AdminPayments] Reject error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/payments')
  revalidatePath('/dashboard/billing')
  return { success: true, data }
}

export async function getPlatformSettingsAction() {
  await assertSuperAdmin()
  return await getPlatformBillingSettings()
}

export async function updatePlatformSettingsAction(
  settings: Partial<PlatformBillingSettings>
) {
  await assertSuperAdmin()
  const admin = createAdminClient()

  // Find existing row or insert
  const { data: existing } = await admin
    .from('platform_billing_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  const payload = {
    account_name: settings.account_name,
    promptpay_id: settings.promptpay_id,
    bank_name: settings.bank_name,
    bank_account_number: settings.bank_account_number,
    is_vat_registered: Boolean(settings.is_vat_registered),
    payee_tax_id: settings.payee_tax_id,
    company_address: settings.company_address,
    company_phone: settings.company_phone,
    company_email: settings.company_email,
    updated_at: new Date().toISOString(),
  }

  let error = null
  if (existing?.id) {
    const res = await admin
      .from('platform_billing_settings')
      .update(payload)
      .eq('id', existing.id)
    error = res.error
  } else {
    const res = await admin.from('platform_billing_settings').insert(payload)
    error = res.error
  }

  if (error) {
    console.error('[AdminPayments] Update settings error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/payments')
  revalidatePath('/admin/payment-settings')
  revalidatePath('/dashboard/billing')
  return { success: true }
}

export interface AlertShopOption {
  id: string
  name: string
  ready: boolean
}

/** Shops with a LINE OA, for choosing which one sends top-up alerts; ready = admin LINE linked */
export async function listAlertShopsAction(): Promise<AlertShopOption[]> {
  await assertSuperAdmin()
  const { data } = await createAdminClient()
    .from('shops')
    .select('*')
    .not('line_token', 'is', null)
    .order('created_at', { ascending: true })
    .limit(200)
  return (data || [])
    .filter((s: any) => String(s.line_token || '').trim())
    .map((s: any) => ({ id: s.id, name: s.name || 'ไม่ระบุชื่อร้าน', ready: canCarryAlerts(s) }))
}

/** Saves which shop's LINE OA carries top-up alerts (null turns them off) */
export async function updatePlatformAlertShopAction(shopId: string | null) {
  await assertSuperAdmin()
  const admin = createAdminClient()
  const { data: existing } = await admin.from('platform_billing_settings').select('id').limit(1).maybeSingle()
  if (!existing?.id) {
    return { success: false, error: 'บันทึกข้อมูลบัญชีรับเงินก่อน แล้วค่อยตั้งค่าการแจ้งเตือน' }
  }
  const { error } = await admin
    .from('platform_billing_settings')
    .update({ notify_shop_id: shopId || null, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
  if (error) {
    const missingColumn = /notify_shop_id/.test(error.message)
    return {
      success: false,
      error: missingColumn ? 'ยังไม่ได้รัน SQL สำหรับการแจ้งเตือน (migration 20261022000000_platform_alert_shop.sql)' : error.message,
    }
  }
  revalidatePath('/admin/payment-settings')
  return { success: true }
}

export async function sendTestPlatformAlertAction(shopId: string) {
  await assertSuperAdmin()
  const sent = await notifyPlatformOwner(
    '🔔 ทดสอบการแจ้งเตือน DealMee\nเมื่อร้านค้าเติมเงินเข้ากระเป๋า คุณจะได้รับข้อความแบบนี้ที่ LINE นี้',
    shopId
  )
  return sent
    ? { success: true }
    : { success: false, error: 'ส่งไม่สำเร็จ ตรวจว่าร้านนี้เชื่อม LINE OA และผูก LINE แอดมินไว้แล้ว' }
}
