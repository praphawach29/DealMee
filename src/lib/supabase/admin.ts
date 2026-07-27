import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

/** Service-role Supabase client — bypasses RLS. Use only in server contexts with no user session (webhooks, cron). */
export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}
