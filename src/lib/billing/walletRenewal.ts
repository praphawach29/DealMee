import { createAdminClient } from '@/lib/supabase/admin'
import { pushToOwner } from './ownerAlerts'
import { PLAN_GRACE_DAYS } from './trial'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dealmee.app'
const BILLING_URL = `${APP_URL}/dashboard/billing`
const REMIND_DAYS_BEFORE = 3
const DAY_MS = 86_400_000

function baht(value: number) {
  return `${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
}

function thaiDate(date: Date) {
  return date.toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })
}

/**
 * Renews plans bought from the wallet and tells the owner when the balance won't
 * cover the next renewal. Run from the follow-up cron; each notice goes out once
 * per billing cycle (shop_wallets.renewal_notice_for / lapse_notice_for hold the
 * plan end date it was sent for).
 *
 * - Ending within 3 days and the balance is short (or auto-renew is off): reminder.
 * - Ended: renew from the balance; if it's short, say the plan keeps working for
 *   the grace period and then drops to Free (effectivePlanKey handles the drop).
 */
export async function processWalletRenewals(limit = 50): Promise<{ checked: number; renewed: number; notified: number }> {
  const admin = createAdminClient()
  const now = new Date()
  const from = new Date(now.getTime() - PLAN_GRACE_DAYS * DAY_MS).toISOString()
  const to = new Date(now.getTime() + REMIND_DAYS_BEFORE * DAY_MS).toISOString()

  const { data: shops } = await admin
    .from('shops')
    .select('id, plan, plan_key, plan_expires_at, line_token, owner_line_id, features')
    .eq('subscription_provider', 'wallet')
    .gte('plan_expires_at', from)
    .lte('plan_expires_at', to)
    .order('plan_expires_at', { ascending: true })
    .limit(limit)

  let renewed = 0
  let notified = 0
  for (const shop of shops || []) {
    const endsAt = new Date(shop.plan_expires_at)
    const planKey = String(shop.plan_key || shop.plan || '').toLowerCase()
    const [{ data: wallet }, { data: plan }] = await Promise.all([
      admin.from('shop_wallets').select('balance, auto_renew, renewal_notice_for, lapse_notice_for').eq('shop_id', shop.id).maybeSingle(),
      admin.from('plans').select('name, price').eq('key', planKey).maybeSingle(),
    ])
    if (!plan || Number(plan.price) <= 0) continue

    const balance = Number(wallet?.balance || 0)
    const autoRenew = wallet?.auto_renew !== false
    const price = Number(plan.price)
    const sentFor = (value: string | null | undefined) => Boolean(value) && new Date(value as string).getTime() === endsAt.getTime()

    if (endsAt.getTime() > now.getTime()) {
      // Upcoming: only a shortfall or a plan that won't renew needs a word
      if ((autoRenew && balance >= price) || sentFor(wallet?.renewal_notice_for)) continue
      const text = autoRenew
        ? `⏰ แพ็กเกจ ${plan.name} จะครบกำหนดวันที่ ${thaiDate(endsAt)}\nยอดในกระเป๋า ${baht(balance)} ไม่พอต่ออายุ (${baht(price)})\nเติมเงินอีก ${baht(price - balance)} เพื่อให้ระบบต่ออายุให้อัตโนมัติ: ${BILLING_URL}`
        : `⏰ แพ็กเกจ ${plan.name} จะครบกำหนดวันที่ ${thaiDate(endsAt)} และปิดการต่ออายุอัตโนมัติไว้\nต่ออายุได้ที่: ${BILLING_URL}`
      await pushToOwner(shop, text)
      await admin.from('shop_wallets').upsert({ shop_id: shop.id, renewal_notice_for: shop.plan_expires_at }, { onConflict: 'shop_id' })
      notified++
      continue
    }

    const { data: result, error } = await admin.rpc('wallet_renew_plan', { p_shop_id: shop.id })
    if (error) {
      console.error('[WalletRenewal] renew failed:', shop.id, error.message)
      continue
    }

    if (result?.status === 'renewed') {
      renewed++
      const until = thaiDate(new Date(result.plan_expires_at))
      await pushToOwner(shop, `✅ ต่ออายุแพ็กเกจ ${plan.name} แล้ว ใช้งานได้ถึง ${until}\nหักจากกระเป๋า ${baht(price)} ยอดคงเหลือ ${baht(Number(result.balance))}`)
      continue
    }

    if ((result?.status === 'insufficient' || result?.status === 'auto_renew_off') && !sentFor(wallet?.lapse_notice_for)) {
      const graceEnds = thaiDate(new Date(endsAt.getTime() + PLAN_GRACE_DAYS * DAY_MS))
      const reason = result.status === 'insufficient'
        ? `ยอดในกระเป๋า ${baht(balance)} ไม่พอต่ออายุ (${baht(price)})`
        : 'การต่ออายุอัตโนมัติปิดอยู่'
      await pushToOwner(
        shop,
        `⚠️ แพ็กเกจ ${plan.name} ครบกำหนดแล้ว ${reason}\nร้านยังใช้งานได้ตามปกติถึงวันที่ ${graceEnds} หลังจากนั้นจะเปลี่ยนเป็นแพ็กเกจ Free (บอทหยุดรับออเดอร์และตรวจสลิป)\nเติมเงินและต่ออายุได้ที่: ${BILLING_URL}`
      )
      await admin.from('shop_wallets').upsert({ shop_id: shop.id, lapse_notice_for: shop.plan_expires_at }, { onConflict: 'shop_id' })
      notified++
    }
  }

  return { checked: shops?.length || 0, renewed, notified }
}
