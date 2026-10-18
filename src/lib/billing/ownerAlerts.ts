import { createAdminClient } from '@/lib/supabase/admin'
import { TRIAL_DAYS, trialStatus } from './trial'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'
const UPGRADE_URL = `${APP_URL}/dashboard/billing`

type Shop = Record<string, any>

function adminLineId(shop: Shop): string | null {
  return shop.admin_line_user_id || shop.owner_line_id || shop.features?.admin_line_user_id || shop.features?.admin_notify_user_id || null
}

/** LINE push to the shop owner through the shop's own OA; silently skipped when not set up. */
async function pushToOwner(shop: Shop, text: string): Promise<boolean> {
  const token = shop.line_token ? String(shop.line_token).trim() : ''
  const to = adminLineId(shop)
  if (!token || !to) return false
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    })
    if (!res.ok) console.error('[OwnerAlerts] LINE push failed:', await res.text())
    return res.ok
  } catch (err) {
    console.error('[OwnerAlerts] LINE push exception:', err)
    return false
  }
}

/** Order/slip alerts to the shop admin; skipped when the shop turned admin notifications off. */
export async function notifyShopAdmin(shop: Shop, text: string): Promise<void> {
  if (shop?.features?.admin_notify === false) return
  await pushToOwner(shop, text)
}

async function setFeatureFlag(shopId: string, key: string, value: unknown) {
  const admin = createAdminClient()
  // Re-read so a settings save made in between isn't overwritten with a stale copy
  const { data } = await admin.from('shops').select('features').eq('id', shopId).single()
  await admin.from('shops').update({ features: { ...((data?.features as Record<string, any>) || {}), [key]: value } }).eq('id', shopId)
}

/** Orders and paid revenue since the trial began, for the reminder messages. */
async function trialResults(shopId: string, since: Date) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('orders')
    .select('total_amount, payment_status')
    .eq('shop_id', shopId)
    .gte('created_at', since.toISOString())
  const orders = data?.length || 0
  const revenue = (data || [])
    .filter((o: any) => o.payment_status === 'paid')
    .reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0)
  return { orders, revenue }
}

function resultsLine({ orders, revenue }: { orders: number; revenue: number }) {
  if (orders === 0) return ''
  return `\n\nช่วงทดลองที่ผ่านมา บอทรับออเดอร์ให้แล้ว ${orders} รายการ${revenue > 0 ? ` ยอดชำระแล้ว ${revenue.toLocaleString('th-TH')} บาท` : ''} 🎉`
}

type ReminderKey = 'd3' | 'd1' | 'ended'

function reminderText(key: ReminderKey, results: { orders: number; revenue: number }) {
  const stats = resultsLine(results)
  if (key === 'd3') {
    return `⏰ ช่วงทดลอง DealMee เหลืออีก 3 วัน${stats}\n\nหลังหมดช่วงทดลอง บอทยังตอบคำถามลูกค้าได้ แต่การรับออเดอร์ ส่ง QR และตรวจสลิปอัตโนมัติจะหยุด\nอัปเกรดเพื่อใช้งานต่อเนื่อง: ${UPGRADE_URL}`
  }
  if (key === 'd1') {
    return `⏰ ช่วงทดลอง DealMee จะหมดพรุ่งนี้${stats}\n\nอัปเกรดวันนี้ บอทจะรับออเดอร์และตรวจสลิปให้ต่อได้ทันที: ${UPGRADE_URL}`
  }
  return `ช่วงทดลอง DealMee หมดแล้ว ร้านของคุณย้ายมาใช้แพ็กเกจ Free${stats}\n\nข้อมูลทั้งหมดยังอยู่ครบ บอทยังตอบคำถามลูกค้าได้ (100 ข้อความ/เดือน) ส่วนออเดอร์และสลิปจะส่งให้แอดมินดูแลเอง\nอัปเกรดเมื่อไหร่ ทุกอย่างกลับมาทำงานทันที: ${UPGRADE_URL}`
}

/**
 * Sends the "3 days left", "1 day left" and "trial ended" messages, each once per
 * shop (tracked in features.trial_reminders_sent). Run from the follow-up cron.
 */
export async function sendTrialReminders(limit = 50): Promise<{ checked: number; sent: number }> {
  const admin = createAdminClient()
  const now = new Date()
  // Only trials ending within 3 days or ended in the last 7 (older ones were handled or predate this)
  const from = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const to = new Date(now.getTime() + 3 * 86_400_000).toISOString()

  const { data: shops } = await admin
    .from('shops')
    .select('id, plan, plan_key, trial_expires_at, line_token, owner_line_id, features')
    .or('plan.eq.trial,plan_key.eq.trial')
    .gte('trial_expires_at', from)
    .lte('trial_expires_at', to)
    .limit(limit)

  let sent = 0
  for (const shop of shops || []) {
    const trial = trialStatus(shop, now)
    if (!trial.isTrial || !trial.endsAt) continue
    const key: ReminderKey = trial.expired ? 'ended' : trial.daysLeft <= 1 ? 'd1' : 'd3'
    const already: string[] = Array.isArray(shop.features?.trial_reminders_sent) ? shop.features.trial_reminders_sent : []
    if (already.includes(key)) continue

    const since = new Date(trial.endsAt.getTime() - TRIAL_DAYS * 86_400_000)
    await pushToOwner(shop, reminderText(key, await trialResults(shop.id, since)))
    // Recorded even when LINE isn't linked, so the dashboard banner carries the message instead
    // of retrying every 5 minutes; a skipped 'd3' is also implied once 'd1' goes out.
    await setFeatureFlag(shop.id, 'trial_reminders_sent', [...already, key])
    sent++
  }
  return { checked: shops?.length || 0, sent }
}

/**
 * Tells the owner once per month that the AI quota ran out and customers are getting
 * a holding reply until someone answers or the shop upgrades.
 */
export async function notifyQuotaExhausted(shop: Shop): Promise<void> {
  const period = new Date().toISOString().slice(0, 7)
  if (shop.features?.quota_alert_period === period) return
  await pushToOwner(
    shop,
    `⚠️ ข้อความ AI ของร้านเดือนนี้ใช้ครบแล้ว\nตอนนี้ลูกค้าที่ทักมาจะได้รับข้อความว่าแอดมินจะตอบกลับ กรุณาตอบลูกค้าใน Inbox\n\nอัปเกรดเพื่อให้บอทตอบต่อทันที: ${UPGRADE_URL}`
  )
  await setFeatureFlag(shop.id, 'quota_alert_period', period)
}
