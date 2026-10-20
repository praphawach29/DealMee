'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getOrCreateShopForUser } from '@/lib/shopHelper'
import { createAdminClient } from '@/lib/supabase/admin'
import { facebookPageUsedByOtherShop } from '@/lib/shop/channelOwnership'
import { FB_PAGES_COOKIE, facebookAppConfig, listPages, openCookie, subscribePage, unsubscribePage } from '@/lib/facebook/connect'

type PendingPages = { shopId: string; fbUserId: string; userToken: string }

async function currentShop() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateShopForUser(supabase, user)
}

async function pending(shopId: string): Promise<PendingPages | null> {
  const value = openCookie<PendingPages>((await cookies()).get(FB_PAGES_COOKIE)?.value)
  return value && value.shopId === shopId ? value : null
}

export interface FacebookConnectState {
  appConfigured: boolean
  connected: { pageId: string; pageName: string; via: string | null } | null
  choices: { id: string; name: string }[]
}

export async function getFacebookConnectState(): Promise<FacebookConnectState | { error: string }> {
  const shop = await currentShop()
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }
  const appConfigured = Boolean(await facebookAppConfig())
  const connected = shop.facebook_page_id
    ? { pageId: shop.facebook_page_id, pageName: shop.facebook_page_name || shop.facebook_page_id, via: shop.facebook_connected_via || null }
    : null

  let choices: { id: string; name: string }[] = []
  const waiting = await pending(shop.id)
  if (waiting) {
    try {
      choices = (await listPages(waiting.userToken)).map(({ id, name }) => ({ id, name }))
    } catch (err) {
      console.error('[Facebook connect] listing pages failed:', err)
    }
  }
  return { appConfigured, connected, choices }
}

/** Connects the chosen page: subscribes DealMee's app to its messages and saves its token */
export async function connectFacebookPage(pageId: string): Promise<{ success: string } | { error: string }> {
  const shop = await currentShop()
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }
  const waiting = await pending(shop.id)
  if (!waiting) return { error: 'หมดเวลาเลือกเพจแล้ว กรุณากด "เชื่อมเพจด้วย Facebook" อีกครั้ง' }

  let page
  try {
    page = (await listPages(waiting.userToken)).find((p) => p.id === pageId)
  } catch (err: any) {
    return { error: `อ่านรายการเพจไม่ได้: ${err.message}` }
  }
  if (!page) return { error: 'ไม่พบเพจนี้ในบัญชี Facebook ที่ล็อกอิน' }
  if (await facebookPageUsedByOtherShop(shop.id, page.id)) {
    return { error: 'เพจนี้เชื่อมกับร้านอื่นใน DealMee อยู่แล้ว 1 เพจใช้ได้กับ 1 ร้านเท่านั้น' }
  }

  try {
    await subscribePage(page.id, page.token)
  } catch (err: any) {
    return { error: `เชื่อมเพจไม่สำเร็จ: ${err.message}` }
  }

  // The per-shop app's verify token and secret no longer apply: the platform webhook serves this page
  const { error } = await createAdminClient()
    .from('shops')
    .update({
      facebook_page_id: page.id,
      facebook_page_name: page.name,
      facebook_page_token: page.token,
      facebook_app_secret: null,
      facebook_verify_token: null,
      facebook_connected_via: 'oauth',
      facebook_user_id: waiting.fbUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)
  if (error) return { error: `บันทึกไม่สำเร็จ: ${error.message}` }

  ;(await cookies()).delete(FB_PAGES_COOKIE)
  revalidatePath('/dashboard/settings')
  return { success: `เชื่อมเพจ "${page.name}" แล้ว ลองทักเพจจากอีกบัญชีเพื่อทดสอบได้เลย` }
}

export async function disconnectFacebookPage(): Promise<{ success: string } | { error: string }> {
  const shop = await currentShop()
  if (!shop) return { error: 'ไม่พบข้อมูลร้านค้า' }
  if (shop.facebook_page_id && shop.facebook_page_token && shop.facebook_connected_via === 'oauth') {
    await unsubscribePage(shop.facebook_page_id, shop.facebook_page_token)
  }
  const { error } = await createAdminClient()
    .from('shops')
    .update({
      facebook_page_id: null,
      facebook_page_name: null,
      facebook_page_token: null,
      facebook_connected_via: null,
      facebook_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id)
  if (error) return { error: error.message }
  await createAdminClient().from('channel_accounts').update({ is_active: false }).eq('shop_id', shop.id).eq('platform', 'facebook')
  revalidatePath('/dashboard/settings')
  return { success: 'ตัดการเชื่อมเพจแล้ว' }
}

export async function cancelFacebookChoice(): Promise<void> {
  ;(await cookies()).delete(FB_PAGES_COOKIE)
}
