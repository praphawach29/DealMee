-- The platform's own LINE OA for owner alerts (wallet top-ups). Holds the channel
-- credentials, so unlike platform_billing_settings it is NOT readable by signed-in
-- users: RLS is on with no policies, and only the service role (server code) uses it.
-- Single row (id = 1). Safe to run more than once.
CREATE TABLE IF NOT EXISTS public.platform_line_alerts (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  channel_access_token TEXT,
  channel_secret TEXT,
  bot_basic_id TEXT,
  admin_line_user_id TEXT,
  admin_line_name TEXT,
  link_code TEXT,
  link_code_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_line_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_line_alerts FROM anon, authenticated;
GRANT ALL ON public.platform_line_alerts TO service_role;
