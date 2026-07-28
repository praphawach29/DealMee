# Supabase SQL — Organization

This folder exists to stop SQL files from scattering loose at the repo root (that pattern — dozens of ad hoc `fix_*.sql`/`check_*.sql` files with no order — is exactly the technical-debt symptom documented as a warning sign in `ROADMAP_AI_AGENT.md` §1, found in a sibling project this team audited).

**No Supabase CLI project is set up here** — everything in `migrations/` is applied **manually**, in order, via the Supabase Dashboard's SQL Editor. The folder is still named `migrations/` and files are still timestamp-prefixed so that if this project ever does adopt the Supabase CLI (`supabase link`, `supabase db push`), the naming already matches its convention with no renaming needed.

## `migrations/` — apply once, in filename order, never re-run out of order

| File | What it does |
|---|---|
| `20260701000000_initial_schema.sql` | Original full schema + RLS (⚠ known to have drifted from the real production DB — see the warning comment at the top of the file, and `PROJECT_STATUS.md` "Known Issues") |
| `20260728010000_phase1_reliability.sql` | Phase 1 (Core Reliability): orders table columns, promotions/leads tables |
| `20260728020000_phase2_billing.sql` | Phase 2 (Billing): usage_logs, billing_payments, shops/plans billing columns, increment_usage() |
| `20260728030000_phase3_customer_memory.sql` | Customer Memory Graph: customer_profiles table + RPCs |
| `20260728040000_phase4_provider_usage.sql` | Prompt caching cost tracking: ai_provider_usage table + RPC |

**Before writing a new migration file**, always run `tools/check_schema.sql` first and compare its output against what you're about to assume — this codebase has hit real schema-drift bugs multiple times from trusting `20260701000000_initial_schema.sql` instead of the live database.

## `tools/` — not migrations, run ad hoc as needed

| File | Purpose |
|---|---|
| `check_schema.sql` | Introspection query (`information_schema.columns`) — paste the real column list back before writing new SQL |
| `seed_test_products.sql` | One-off sample-product seeder for Chat Playground testing (edit the shop name inside before running) |

## Adding a new migration

1. Run `tools/check_schema.sql` first if the migration touches an existing table.
2. Name it `supabase/migrations/YYYYMMDDHHMMSS_short_description.sql` with a timestamp after the last existing file.
3. Follow the existing style: `CREATE TABLE IF NOT EXISTS`, RLS enabled + a `_select` policy scoped to `shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())`, writes via the service-role client only (no INSERT/UPDATE policy for `authenticated`) unless the table is genuinely meant to be dashboard-editable.
4. Record it in `PROJECT_STATUS.md`'s Database Schema table and Git History section once applied, per this project's existing convention.
