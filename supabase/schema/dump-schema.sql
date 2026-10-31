-- Reads the live database's structure as one JSON value. Run it in the Supabase SQL Editor
-- of the DealMee project, then Export → CSV (or copy the single cell) and save the JSON as
-- supabase/schema/production.json. See supabase/schema/README.md.
--
-- Read-only: it only selects from the system catalogs. No data rows from any app table.
with
cols as (
  select c.relname as tbl,
         jsonb_agg(jsonb_build_object(
           'name', a.attname,
           'type', format_type(a.atttypid, a.atttypmod),
           'nullable', not a.attnotnull,
           'default', pg_get_expr(d.adbin, d.adrelid)
         ) order by a.attnum) as columns
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where c.relkind in ('r', 'p')
  group by c.relname
),
cons as (
  select c.relname as tbl,
         jsonb_agg(jsonb_build_object('name', k.conname, 'def', pg_get_constraintdef(k.oid)) order by k.conname) as constraints
  from pg_constraint k
  join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  group by c.relname
),
idx as (
  select tablename as tbl, jsonb_agg(indexdef order by indexname) as indexes
  from pg_indexes where schemaname = 'public'
  group by tablename
),
pol as (
  select tablename as tbl,
         jsonb_agg(jsonb_build_object(
           'name', policyname, 'cmd', cmd, 'roles', roles,
           'using', qual, 'check', with_check
         ) order by policyname) as policies
  from pg_policies where schemaname = 'public'
  group by tablename
),
grants as (
  select table_name as tbl,
         jsonb_object_agg(grantee, privs) as grants
  from (
    select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
    group by table_name, grantee
  ) g
  group by table_name
),
tables as (
  select jsonb_agg(jsonb_build_object(
           'name', c.relname,
           'rls', c.relrowsecurity,
           'columns', cols.columns,
           'constraints', coalesce(cons.constraints, '[]'),
           'indexes', coalesce(idx.indexes, '[]'),
           'policies', coalesce(pol.policies, '[]'),
           'grants', coalesce(grants.grants, '{}')
         ) order by c.relname) as v
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join cols on cols.tbl = c.relname
  left join cons on cons.tbl = c.relname
  left join idx on idx.tbl = c.relname
  left join pol on pol.tbl = c.relname
  left join grants on grants.tbl = c.relname
  where c.relkind in ('r', 'p')
),
views as (
  select coalesce(jsonb_agg(jsonb_build_object('name', viewname, 'def', definition) order by viewname), '[]') as v
  from pg_views where schemaname = 'public'
),
funcs as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.proname,
           'args', pg_get_function_identity_arguments(p.oid),
           'returns', pg_get_function_result(p.oid),
           'security_definer', p.prosecdef,
           'def', pg_get_functiondef(p.oid)
         ) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]') as v
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f', 'p')
    -- functions an extension installed into public are the extension's, not ours
    and not exists (select 1 from pg_depend dep where dep.objid = p.oid and dep.deptype = 'e')
),
trigs as (
  select coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'name', t.tgname, 'def', pg_get_triggerdef(t.oid)) order by c.relname, t.tgname), '[]') as v
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not t.tgisinternal
),
exts as (
  select coalesce(jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion, 'schema', n.nspname) order by e.extname), '[]') as v
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
),
buckets as (
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'public', public) order by id), '[]') as v
  from storage.buckets
)
select jsonb_build_object(
  'captured_at', now(),
  'postgres', current_setting('server_version'),
  'tables', (select v from tables),
  'views', (select v from views),
  'functions', (select v from funcs),
  'triggers', (select v from trigs),
  'extensions', (select v from exts),
  'storage_buckets', (select v from buckets)
)::text as schema_json;
