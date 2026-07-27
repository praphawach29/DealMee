import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  })
}
