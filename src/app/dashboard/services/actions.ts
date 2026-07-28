'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const REQUIRED_FIELD_KEYS = ['name', 'phone', 'date', 'time', 'guest_count', 'resource', 'note', 'deposit_slip']
const BOOKING_TYPES = ['service', 'table', 'queue', 'class', 'consultation']

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function getNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(getText(formData, key))
  return Number.isFinite(value) ? value : fallback
}

function getCheckedValues(formData: FormData, key: string, allowed: string[]) {
  const values = formData.getAll(key).map(String)
  return allowed.filter((value) => values.includes(value))
}

function getServicePayload(formData: FormData) {
  const name = getText(formData, 'name')
  const bookingTypeRaw = getText(formData, 'booking_type') || 'service'
  const bookingType = BOOKING_TYPES.includes(bookingTypeRaw) ? bookingTypeRaw : 'service'
  const resourceLabel = getText(formData, 'resource_label') || getText(formData, 'staff_name')
  const duration = Math.max(getNumber(formData, 'duration', 60), 5)
  const price = Math.max(getNumber(formData, 'price', 0), 0)
  const depositAmount = Math.max(getNumber(formData, 'deposit_amount', 0), 0)
  const capacityPerSlot = Math.max(Math.floor(getNumber(formData, 'capacity_per_slot', 1)), 1)
  const bufferMinutes = Math.max(Math.floor(getNumber(formData, 'buffer_minutes', 0)), 0)
  const description = getText(formData, 'description')
  const startTime = getText(formData, 'start_time') || '09:00'
  const endTime = getText(formData, 'end_time') || '18:00'
  const status = getText(formData, 'status') || 'active'
  const availableDays = getCheckedValues(formData, 'available_days', DAY_KEYS)
  const requiredFields = getCheckedValues(formData, 'required_fields', REQUIRED_FIELD_KEYS)

  if (!name) return { error: 'กรุณากรอกชื่อบริการหรือชื่อรายการจอง' }
  if (availableDays.length === 0) return { error: 'กรุณาเลือกวันที่ให้บริการอย่างน้อย 1 วัน' }
  if (requiredFields.length === 0) return { error: 'กรุณาเลือกข้อมูลที่บอทต้องถามอย่างน้อย 1 รายการ' }
  if (startTime >= endTime) return { error: 'เวลาเริ่มต้องน้อยกว่าเวลาปิดรับจอง' }

  return {
    data: {
      name,
      booking_type: bookingType,
      staff_name: resourceLabel || null,
      resource_label: resourceLabel || null,
      duration_minutes: duration,
      price,
      deposit_amount: depositAmount,
      capacity_per_slot: capacityPerSlot,
      description: description || null,
      available_days: availableDays,
      required_fields: requiredFields,
      start_time: startTime,
      end_time: endTime,
      buffer_minutes: bufferMinutes,
      status,
      updated_at: new Date().toISOString(),
      booking_metadata: {
        form_version: 2,
        notes_label: getText(formData, 'notes_label') || null,
      },
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
