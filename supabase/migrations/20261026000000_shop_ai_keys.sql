-- A BYOK shop's own AI key. Kept out of public.shops (which the shop owner's
-- browser can read) and stored encrypted by the app (AES-256-GCM with
-- SETTINGS_ENCRYPTION_KEY); only the server reads it, through the service role.
create table if not exists public.shop_ai_keys (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'claude')),
  key_ciphertext text not null,
  key_hint text not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_ai_keys enable row level security;

revoke all on table public.shop_ai_keys from anon, authenticated;
grant select, insert, update, delete on table public.shop_ai_keys to service_role;
