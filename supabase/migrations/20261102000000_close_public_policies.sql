-- Closes holes found in the first snapshot of production's real structure
-- (supabase/schema/production.json, 25 Oct 2026). The browser holds the anon key, so
-- anything below was reachable by anyone through the REST API, signed in or not.
--
-- 1. billing, payment_events, subscriptions had a policy "ALL ... USING (true)" for every
--    role: anyone could read, change or delete them (amounts, slip URLs, gateway ids per
--    shop). No app code reads them any more (wallet billing uses wallet_* / payments), so
--    the open policies go and only the server's service role keeps access.
-- 2. documents had "SELECT ... USING (true)" so a quotation link would open without a login.
--    That also let anyone list every shop's quotations with customer names, phones and
--    addresses. The link pages (/doc/..., /api/doc/...) read with the service role and don't
--    need it; shop owners keep their own policy.
-- 3. Server-only SECURITY DEFINER functions (wallet, credits, usage, customer memory,
--    payment approval) are revoked from anon and authenticated by name, every overload.
--    The earlier revoke in the wallet migration listed exact signatures, and production's
--    increment_usage has a different one, so it was skipped. add_ai_credits,
--    deduct_ai_credits, refill_monthly_credits, record_customer_order and the customer
--    memory functions were never on the list. Every caller in src/ uses the service role.
--    Functions RLS policies call (is_superadmin, get_user_shop_id, get_user_role) and
--    submit_manual_payment (checks auth.uid() itself) are left alone.
-- 4. broadcasts gets the columns the send action writes (see section 4).
--
-- Safe to re-run.

-- 1 ─────────────────────────────────────────────────────────────────────────────
drop policy if exists billing_all on public.billing;
drop policy if exists payment_events_all on public.payment_events;
drop policy if exists subscriptions_all on public.subscriptions;

do $$
declare t text;
begin
  foreach t in array array['billing', 'payment_events', 'subscriptions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- 2 ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "Allow public read access for document links" on public.documents;

-- 3 ─────────────────────────────────────────────────────────────────────────────
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where p.proname = any (array[
      'add_ai_credits', 'deduct_ai_credits', 'refill_monthly_credits',
      'add_customer_tag_unique', 'append_customer_note', 'record_customer_order',
      'update_customer_preference', 'upsert_customer_profile',
      'increment_usage', 'increment_provider_usage',
      'claim_slip_check', 'consume_addon_credit',
      'wallet_lock', 'wallet_apply', 'wallet_buy_plan', 'wallet_buy_addon', 'wallet_renew_plan',
      'verify_manual_payment', 'reject_manual_payment', 'next_receipt_number',
      'apply_omise_charge_once', 'apply_stripe_checkout_once', 'apply_stripe_invoice_failed_once'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- 4 ─────────────────────────────────────────────────────────────────────────────
-- Broadcast history: the send action writes these columns, but production's broadcasts
-- table never got them, so every insert failed after the messages had already gone out —
-- no history, and the monthly push quota never counted anything.
alter table public.broadcasts add column if not exists title text;
alter table public.broadcasts add column if not exists target_tag text;
alter table public.broadcasts add column if not exists target_pref_key text;
alter table public.broadcasts add column if not exists target_pref_value text;
alter table public.broadcasts add column if not exists recipient_count int not null default 0;
alter table public.broadcasts add column if not exists sent_at timestamptz;
alter table public.broadcasts add column if not exists updated_at timestamptz not null default now();

-- Check. true for anon/authenticated is expected only for: is_superadmin, get_user_shop_id,
-- get_user_role (RLS policies call them), submit_manual_payment (checks auth.uid()),
-- handle_new_user (sign-up trigger). Every other function should read false, false, true.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.prosecdef
order by 2 desc, 3 desc, 1;
