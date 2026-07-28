'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function getServicePayload(formData: FormData) {
  const name = getText(formData, 'name')
  const staffName = getText(formData, 'staff_name')
  const duration = Math.max(parseInt(getText(formData, 'duration') || '60', 10), 5)
  const price = Math.max(parseFloat(getText(formData, 'price') || '0'), 0)
  const bufferMinutes = Math.max(parseInt(getText(formData, 'buffer_minutes') || '0', 10), 0)
  const description = getText(formData, 'description')
  const startTime = getText(formData, 'start_time') || '09:00'
  const endTime = getText(formData, 'end_time') || '18:00'
  const status = getText(formData, 'status') || 'active'
  const availableDays = DAY_KEYS.filter((day) => formData.getAll('available_days').includes(day))

  if (!name) return { error: 'กรุณากรอกชื่อบริการ' }
  if (availableDays.length === 0) return { error: 'กรุณาเลือกวันที่ให้บริการอย่างน้อย 1 วัน' }
  if (startTime >= endTime) return { error: 'เวลาเริ่มต้องน้อยกว่าเวลาปิดให้บริการ' }

  return {
    data: {
      name,
      staff_name: staffName || null,
      duration_minutes: duration,
      price,
      description: description || null,
      available_days: availableDays,
      start_time: startTime,
      end_time: endTime,
      buffer_minutes: bufferMinutes,
      status,
      updated_at: new Date().toISOString(),
    },
  }
}

async function getWorkspaceId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Unauthenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) return { supabase, error: 'No workspace' }
  return { supabase, workspaceId: profile.workspace_id as string }
}

export async function createService(formData: FormData) {
  const ctx = await getWorkspaceId()
  if ('error' in ctx) return { error: ctx.error }

  const payload = getServicePayload(formData)
  if ('error' in payload) return { error: payload.error }

  const { error } = await ctx.supabase
    .from('services')
    .insert({
      shop_id: ctx.workspaceId,
      ...payload.data,
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/services')
  return { success: true }
}

export async function updateService(id: string, formData: FormData) {
  const ctx = await getWorkspaceId()
  if ('error' in ctx) return { error: ctx.error }

  const payload = getServicePayload(formData)
  if ('error' in payload) return { error: payload.error }

  const { error } = await ctx.supabase
    .from('services')
    .update(payload.data)
    .eq('id', id)
    .eq('shop_id', ctx.workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/services')
  return { success: true }
}

export async function deleteService(id: string) {
  const ctx = await getWorkspaceId()
  if ('error' in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('shop_id', ctx.workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/services')
  return { success: true }
}
