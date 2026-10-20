'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/superAdmin'
import {
  SECRET_DEFS,
  clearPlatformSecret,
  setPlatformSecret,
  testPlatformSecret,
  type SecretName,
} from '@/lib/platformSecrets'

async function assertSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isSuperAdminEmail(user.email)) throw new Error('สิทธิ์การเข้าถึงถูกปฏิเสธ (Super Admin Only)')
  return user
}

function checkName(name: string): SecretName {
  if (!SECRET_DEFS.some((d) => d.name === name)) throw new Error('ไม่รู้จักค่านี้')
  return name as SecretName
}

export async function testSecretAction(name: string, value: string) {
  try {
    await assertSuperAdmin()
    const result = await testPlatformSecret(checkName(name), value)
    return result || { ok: true, message: 'ค่านี้ไม่มีปุ่มทดสอบ' }
  } catch (err: any) {
    return { ok: false, message: err.message }
  }
}

export async function saveSecretAction(name: string, value: string) {
  try {
    const user = await assertSuperAdmin()
    await setPlatformSecret(checkName(name), value, user.email || user.id)
    revalidatePath('/admin/system-settings')
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message as string }
  }
}

export async function clearSecretAction(name: string) {
  try {
    const user = await assertSuperAdmin()
    await clearPlatformSecret(checkName(name), user.email || user.id)
    revalidatePath('/admin/system-settings')
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message as string }
  }
}
