-- Response cache for AI answers (reduce repeated AI calls)
create table if not exists public.ai_response_cache (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  query_hash text not null,
  query_text text not null,
  response_text text not null,
  hit_count integer default 1,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  unique(shop_id, query_hash)
);

create index if not exists idx_ai_cache_shop_hash on public.ai_response_cache (shop_id, query_hash);
create index if not exists idx_ai_cache_expires on public.ai_response_cache (expires_at);

alter table public.ai_response_cache enable row level security;
drop policy if exists "Users read their shop ai cache" on public.ai_response_cache;
create policy "Users read their shop ai cache" on public.ai_response_cache
  for select using (shop_id in (select workspace_id from public.users where id = auth.uid()));
drop policy if exists "Service role manages ai cache" on public.ai_response_cache;
create policy "Service role manages ai cache" on public.ai_response_cache
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

revoke all on public.ai_response_cache from anon, public;
grant select on public.ai_response_cache to authenticated;
grant all on public.ai_response_cache to service_role;
