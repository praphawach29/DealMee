'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSampleBooking() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile?.workspace_id) return { error: 'No workspace' }

  const sampleBkNo = `BK-${Math.floor(1000 + Math.random() * 9000)}`

  const { error } = await supabase
    .from('bookings')
    .insert({
      shop_id: profile.workspace_id,
      booking_no: sampleBkNo,
      customer_name: 'คุณกิตติ (LINE)',
      phone: '089-123-4567',
      service_name: 'นวดอโรมาผ่อนคลาย (60 นาที)',
      booking_date: new Date().toISOString().split('T')[0],
      booking_time: '14:00:00',
      status: 'confirmed',
      note: 'ขอนวดเน้นช่วงบ่าและไหล่ค่ะ',
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/bookings')
  return { success: true }
}

export async function updateBookingStatus(bookingId: string, newStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/bookings')
  return { success: true }
}
