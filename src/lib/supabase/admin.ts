import { createClient } from '@supabase/supabase-js'

const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0dHN4aXp3anh2dHN1c2tqdGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc3MjI0OCwiZXhwIjoyMDkyMzQ4MjQ4fQ.PNFAuQhyJAIeSH_V1rRYZ3u8lQWfniAeWwkCWF1Ajek'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ittsxizwjxvtsuskjtft.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  DEFAULT_SERVICE_ROLE_KEY

/** Service-role Supabase client — bypasses RLS. Use only in server contexts with no user session (webhooks, cron, public docs). */
export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}
