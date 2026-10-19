-- ==============================================================================
-- Only praphawach@gmail.com is a Super Admin
-- ==============================================================================
-- The app now decides Super Admin by email alone (src/lib/auth/superAdmin.ts).
-- This clears the leftovers that still granted it elsewhere:
--   1. users.role = 'superadmin' on other accounts (set by the old self-grant
--      button). The app no longer reads it, but reset it so nothing does.
--   2. The platform_billing_settings UPDATE policy, which let role = 'superadmin'
--      or a list of extra emails edit the payee account from the browser. Every
--      write to that table goes through the service role, so no policy is needed.
--
-- Safe to run more than once.
-- ==============================================================================

UPDATE public.users
SET role = 'admin'
WHERE role = 'superadmin'
  AND lower(email) <> 'praphawach@gmail.com';

DROP POLICY IF EXISTS "platform_billing_settings_update" ON public.platform_billing_settings;

-- Check: should list only praphawach@gmail.com (or nothing)
SELECT id, email, role FROM public.users WHERE role = 'superadmin';
