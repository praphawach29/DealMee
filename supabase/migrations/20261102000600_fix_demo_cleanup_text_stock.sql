-- The demo cleanup (cleanup_demo_shops, every 5 minutes from the follow-up cron) has failed on
-- every run since it shipped: "operator does not exist: text < integer". Production's
-- products.stock is text, not the int the migrations declare, so `stock < 50` raised, and the
-- error rolled back the whole function. Old demo chats were never deleted.
--
-- Same function, with the stock reset written so it works on either column type: it sets every
-- sample product back to 50 (all are seeded with 50) instead of comparing numbers.
--
-- Safe to re-run.

create or replace function public.cleanup_demo_shops(p_hours int default 6)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shops uuid[] := array[
    'd3300000-0000-4000-8000-000000000001'::uuid,
    'd3300000-0000-4000-8000-000000000002'::uuid,
    'd3300000-0000-4000-8000-000000000003'::uuid
  ];
  v_cutoff timestamptz := now() - make_interval(hours => p_hours);
  v_stale uuid[];
  v_table text;
  v_count int;
  v_total int := 0;
begin
  -- A conversation is stale once nobody has written in it for p_hours
  select coalesce(array_agg(id), '{}') into v_stale
  from public.conversations
  where shop_id = any(v_shops) and coalesce(last_message_at, created_at) < v_cutoff;

  -- Children first. Each delete runs in its own block: a table this install doesn't have,
  -- or a foreign key nobody expected, skips that one table instead of the whole cleanup.
  foreach v_table in array array[
    'chat_messages', 'payment_slips', 'follow_up_tasks', 'orders', 'bookings',
    'leads', 'customer_profiles', 'sales_trajectories'
  ] loop
    begin
      if to_regclass('public.' || v_table) is null then continue; end if;
      if exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = v_table and column_name = 'conversation_id') then
        execute format('delete from public.%I where conversation_id = any($1)', v_table) using v_stale;
        get diagnostics v_count = row_count;
        v_total := v_total + v_count;
      end if;
      if exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = v_table and column_name = 'shop_id')
         and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = v_table and column_name = 'created_at') then
        execute format('delete from public.%I where shop_id = any($1) and created_at < $2', v_table)
          using v_shops, v_cutoff;
        get diagnostics v_count = row_count;
        v_total := v_total + v_count;
      end if;
    exception when others then
      raise warning '[cleanup_demo_shops] skipped %: %', v_table, sqlerrm;
    end;
  end loop;

  begin
    delete from public.conversations where id = any(v_stale);
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
  exception when others then
    raise warning '[cleanup_demo_shops] skipped conversations: %', sqlerrm;
  end;

  -- products.stock is text in production but int in a fresh install: compare against a literal
  -- both accept, so the reset never aborts the whole cleanup again
  update public.products set stock = '50' where shop_id = any(v_shops) and stock is distinct from '50';
  delete from public.demo_usage where day < (now() at time zone 'Asia/Bangkok')::date - 7;

  return v_total;
end;
$$;

revoke execute on function public.cleanup_demo_shops(int) from public, anon, authenticated;
grant execute on function public.cleanup_demo_shops(int) to service_role;

-- Check: should return a number (rows cleaned), not an error
select public.cleanup_demo_shops(6);
