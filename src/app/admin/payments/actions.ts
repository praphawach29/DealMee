'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  PlatformBillingSettings,
  getPlatformBillingSettings,
} from '@/lib/billing/manualBilling'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import { signSlipUrls } from '@/lib/billing/slipStorage'
import qrcode from 'qrcode'
import { notifyPlatformOwner } from '@/lib/billing/platformAlerts'
import {
  ensureLinkCode,
  fetchBotBasicId,
  getPlatformLineConfig,
  savePlatformLineConfig,
} from '@/lib/billing/platformLineAlerts'

async function assertSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('กรุณาเข้าสู่ระบบ')
  }

  if (!isSuperAdminEmail(user.email)) {
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

  const signed = await signSlipUrls(admin, (data || []).map((p: any) => p.slip_url))

  return (data || []).map((p: any) => ({
    ...p,
    slip_url: p.slip_url ? signed.get(p.slip_url) || '' : '',
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

export interface PlatformLineStatus {
  /** False until migration 20261023000000_platform_line_alerts.sql has run */
  ready: boolean
  connected: boolean
  basicId: string | null
  linked: boolean
  adminName: string | null
  linkCode: string | null
  deepLink: string | null
  qrDataUrl: string | null
}

/** State of the platform's LINE OA for owner alerts; never returns the credentials */
export async function getPlatformLineStatusAction(): Promise<PlatformLineStatus> {
  await assertSuperAdmin()
  const empty = { connected: false, basicId: null, linked: false, adminName: null, linkCode: null, deepLink: null, qrDataUrl: null }
  let config
  try {
    config = await getPlatformLineConfig()
  } catch {
    return { ready: false, ...empty }
  }

  const connected = Boolean(config?.channel_access_token && config?.channel_secret)
  const linked = Boolean(connected && config?.admin_line_user_id)
  if (!connected || linked) {
    return { ready: true, ...empty, connected, basicId: config?.bot_basic_id || null, linked, adminName: config?.admin_line_name || null }
  }

  const linkCode = await ensureLinkCode(config)
  const deepLink = config?.bot_basic_id
    ? `https://line.me/R/oaMessage/@${config.bot_basic_id}/?${encodeURIComponent('/admin-link ' + linkCode)}`
    : null
  let qrDataUrl: string | null = null
  if (deepLink) {
    try {
      qrDataUrl = await qrcode.toDataURL(deepLink, { width: 280, margin: 2, color: { dark: '#0F172A', light: '#FFFFFF' } })
    } catch {}
  }
  return { ready: true, connected, basicId: config?.bot_basic_id || null, linked, adminName: null, linkCode, deepLink, qrDataUrl }
}

/** Saves the OA's channel credentials after checking the token with LINE; a new channel needs linking again */
export async function savePlatformLineChannelAction(input: { accessToken: string; channelSecret: string }) {
  await assertSuperAdmin()
  const accessToken = (input.accessToken || '').trim()
  const channelSecret = (input.channelSecret || '').trim()
  if (!accessToken || !channelSecret) {
    return { success: false, error: 'กรอกทั้ง Channel Access Token และ Channel Secret' }
  }

  const basicId = await fetchBotBasicId(accessToken)
  if (!basicId) {
    return { success: false, error: 'LINE ไม่ยอมรับ Channel Access Token นี้ ตรวจว่าคัดลอกมาครบ (Messaging API → Channel access token)' }
  }

  try {
    const current = await getPlatformLineConfig()
    const sameChannel = current?.bot_basic_id === basicId
    await savePlatformLineConfig({
      channel_access_token: accessToken,
      channel_secret: channelSecret,
      bot_basic_id: basicId,
      ...(sameChannel ? {} : { admin_line_user_id: null, admin_line_name: null, link_code: null, link_code_expires_at: null }),
    })
  } catch (err: any) {
    const missingTable = /platform_line_alerts/.test(err.message || '')
    return { success: false, error: missingTable ? 'ยังไม่ได้รัน SQL สำหรับ LINE แจ้งเตือน (migration 20261023000000_platform_line_alerts.sql)' : err.message }
  }

  revalidatePath('/admin/payment-settings')
  return { success: true, basicId }
}

export async function unlinkPlatformLineAdminAction() {
  await assertSuperAdmin()
  await savePlatformLineConfig({ admin_line_user_id: null, admin_line_name: null })
  revalidatePath('/admin/payment-settings')
  return { success: true }
}

export async function sendTestPlatformAlertAction() {
  await assertSuperAdmin()
  const sent = await notifyPlatformOwner(
    '🔔 ทดสอบการแจ้งเตือน DealMee\nเมื่อร้านค้าเติมเงินเข้ากระเป๋า คุณจะได้รับข้อความแบบนี้ที่ LINE นี้'
  )
  return sent ? { success: true } : { success: false, error: 'ส่งไม่สำเร็จ ตรวจว่าบันทึก Channel Access Token และผูก LINE ของคุณแล้ว' }
}
