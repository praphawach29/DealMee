-- Drops tables left from the earlier version of the app that nothing uses any more: no code in
-- src/ or supabase/functions reads them and no live function writes them (checked against
-- supabase/schema/production.json). The owner agreed to drop them on 25 Oct 2026.
--
-- Each table is dropped only if it is really empty right now (an exact check, not the
-- statistics estimate); one that holds even a single row is skipped with a notice. No CASCADE:
-- anything still depending on a table makes that drop fail and it is reported, not forced.
-- payment_events goes before billing because of its foreign key.
--
-- Kept, because they hold data: credit_transactions, bot_templates, packages, customers,
-- shop_booking_configs. Kept, because they are used: profiles, billing_webhook_events,
-- demo_usage, live_sessions, live_baskets, live_comments.
--
-- Safe to re-run.

do $$
declare
  t text;
  has_rows boolean;
  dropped text[] := '{}';
  skipped text[] := '{}';
begin
  foreach t in array array[
    'payment_events', 'billing', 'payments', 'payment_ledger', 'subscriptions',
    'webhook_events', 'slip_checks', 'ai_usage_ledger',
    'chat_logs', 'chat_sessions', 'chat_history', 'inquiries', 'knowledge_gaps',
    'shop_knowledge', 'botify_knowledge_base', 'booking_slots'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('select exists (select 1 from public.%I)', t) into has_rows;
    if has_rows then
      skipped := skipped || (t || ' (has rows)');
      continue;
    end if;
    begin
      execute format('drop table public.%I', t);
      dropped := dropped || t;
    exception when others then
      skipped := skipped || (t || ' (' || sqlerrm || ')');
    end;
  end loop;
  raise notice 'dropped: %', dropped;
  raise notice 'skipped: %', skipped;
end $$;

-- The search functions over the two dropped knowledge tables. Nothing calls them (the bot uses
-- match_knowledge_chunks); they go only once their table is gone.
do $$
declare fn regprocedure;
begin
  if to_regclass('public.botify_knowledge_base') is null then
    for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'match_botify_knowledge' loop
      execute format('drop function %s', fn);
    end loop;
  end if;
  if to_regclass('public.shop_knowledge') is null then
    for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'match_shop_knowledge' loop
      execute format('drop function %s', fn);
    end loop;
  end if;
end $$;

-- Check: every name below should read "dropped"; any "still here" was skipped (see the notices)
select t as table_name, case when to_regclass('public.' || t) is null then 'dropped' else 'still here' end as status
from unnest(array[
  'payment_events', 'billing', 'payments', 'payment_ledger', 'subscriptions',
  'webhook_events', 'slip_checks', 'ai_usage_ledger',
  'chat_logs', 'chat_sessions', 'chat_history', 'inquiries', 'knowledge_gaps',
  'shop_knowledge', 'botify_knowledge_base', 'booking_slots'
]) as t
order by 2 desc, 1;
