# DealMee tenant-isolation audit — 2026-11-14

Source: `main` at `145b4c19c7c2a6f665a69d6ba01cc2923a9a91f5` (clean worktree). Profile: deep, scoped to multi-tenant isolation. Method: Cloudflare security-audit skill (reconnaissance, source hunting, validation). Execution was source-only: this environment has no local Postgres, and production and the real Supabase project were not contacted. No prior coverage ledger exists for this repo. Validators `validate-findings.cjs` and `validate-coverage-ledger.cjs` passed on the JSON files next to this report.

## Executive summary

One signed-in shop can write an order into another shop. The `orders` row policies treat `shop_id` and `workspace_id` as alternatives, the authenticated role can insert, and the victim's order page loads every row with that `shop_id`. That is the only confirmed cross-tenant write of business data.

Two narrower confirmed issues sit behind extra conditions. A shop can set its own `facebook_page_id` to another shop's public page id, because the duplicate check lives only in server actions, and the platform Messenger webhook then drops that page's events. A signed-in shop can read another shop's live-studio session, including a PromptPay payload, when that shop has `features.live_studio` turned on. Anonymous callers do not reach that handler.

Knowledge retrieval, LINE and Messenger signature checks, session-derived `shop_id` on the shop APIs that were read, the `workspace_id` trigger, and the super-admin email allowlist held up under the paths reviewed. Two items stay leads, not findings: the evaluation action reads every shop with no check inside the function, and quotation pages render a document to anyone who already knows its id.

## Confirmed findings

Sorted by severity.

| Severity | Finding | Boundary | What the attacker gets |
| --- | --- | --- | --- |
| High | Orders RLS lets one shop insert orders into another shop | `public.orders` policies | A row that appears on the victim shop's order list |
| Medium | Claiming another shop's Facebook page id stops its Messenger webhook | `shops.facebook_page_id` | Victim's platform Messenger events are dropped. The attacker does not receive the chats |
| Medium | Signed-in shop can read another shop's live session by shop id | `GET /api/live/comment` | Products, comments, revenue, and the stored PromptPay payload, only if live studio is enabled |

### High — Orders RLS lets one shop insert orders into another shop

`supabase/migrations/20260701000000_initial_schema.sql:230` and `:236`. Corroborated by `supabase/schema/production.json:3308`, `:3296`, and `:3511`. Read path: `src/app/dashboard/orders/page.tsx:25`.

**Attacker.** Any signed-in shop member. The anon key alone is not enough: `auth.uid()` is null, so the policy does not pass.

**Request.** PostgREST insert into `public.orders` with the attacker's JWT:

```json
{"shop_id":"<shop-b-uuid>","workspace_id":"<shop-a-uuid>","customer_name":"injected","total_amount":1,"status":"pending"}
```

**Why it is allowed.** The INSERT check is true when `shop_id` is the caller's shop **or** `workspace_id` is the caller's shop. The snapshot of production on 2026-10-24 shows the same OR on SELECT and UPDATE, `orders.workspace_id` as a real column with a foreign key to `shops`, and INSERT/SELECT/UPDATE granted to `authenticated`. The UPDATE policy's check expression is null, so PostgreSQL reuses the USING expression for the new row: a caller who already matches `workspace_id` can also change `shop_id` to another existing shop. No later migration in this folder replaces these policies.

**What they get.** Shop B's dashboard selects `.eq('shop_id', shop.id)` and includes the injected row. Staff can treat it as a real order. The same predicate does not let shop A select shop B's existing orders, because those rows have shop B's `shop_id` and not shop A's `workspace_id`.

**Proof.** Predicate on a dummy pair of shops:

| shop_id | workspace_id | Matches caller on shop_id | Matches caller on workspace_id | Policy |
| --- | --- | --- | --- | --- |
| shop B | shop A | no | yes | allowed |
| shop A | shop A | yes | yes | allowed, own order |
| shop B | shop B | no | no | denied |

Published demo shop ids in `supabase/migrations/20261101000000_live_demo.sql:77` (`d3300000-0000-4000-8000-000000000001` and the two siblings) need no leak. Any other shop UUID the attacker has learned, including the id in a LINE webhook URL, works the same way. This was not inserted into a database: there is no local Postgres here, and production was not used.

**Fix.** Authorize every command with `shop_id` equal to the caller's `users.workspace_id` only, and use that expression for both USING and WITH CHECK. Reject updates that change `shop_id`. Add a regression that inserts `shop_id = other` with `workspace_id = self` and expects a policy error.

### Medium — A shop can claim another shop's Facebook page id and stop its Messenger webhook

`supabase/migrations/20260701000000_initial_schema.sql:46`, `src/app/dashboard/settings/actions.ts:129`, `src/lib/shop/channelOwnership.ts:46`, `supabase/migrations/20261029000000_facebook_connect.sql:9`, `src/app/api/webhook/facebook/route.ts:54`.

**Attacker.** A signed-in merchant, updating their own `shops` row through the Data API. They do not need the victim's page token. Facebook page ids are public.

**Request.** Update the attacker's own shop:

```json
{"facebook_page_id":"<victim-page-id>","facebook_connected_via":"oauth"}
```

**Why the app check does not stop it.** `facebookPageUsedByOtherShop` runs inside the settings action and inside `connectFacebookPage` (`src/app/dashboard/settings/facebookActions.ts:65`). The shops UPDATE policy still lets the owner change `facebook_page_id`. The billing-column trigger does not cover it. `shops_facebook_page_id_idx` is not unique.

**What they get.** The platform webhook loads one oauth shop with `.eq('facebook_page_id', pageId).maybeSingle()`. Two rows make that lookup return no shop, and the handler skips the entry at `route.ts:60`. Shop B's Messenger events on the platform app are dropped. Shop A does not receive shop B's token or messages, because the lookup fails closed rather than picking a row. The same gap exists for `line_bot_user_id` and `line_token`, but copying a LINE token requires a secret the attacker cannot read through RLS. The page id does not.

**Fix.** Partial unique indexes on `facebook_page_id` and `line_bot_user_id` where the value is present. Keep the action checks so the UI can show a clear error.

### Medium — A signed-in shop can read another shop's live session by shop id

`src/app/api/live/comment/route.ts:11` (GET) and `:33` (POST, which does check the session). Guard: `src/lib/live/liveStudioAccess.ts:16`. Data: `src/lib/live/liveStudioEngine.ts:84` and `:312`. Middleware: `src/utils/supabase/middleware.ts:65` and `:80`.

**Attacker.** Any other signed-in shop. A caller with no session is redirected to `/login`. `/api/live` is not on the anonymous allowlist, so the comment in the route that calls this GET public is not what the middleware does today.

**Request.** `GET /api/live/comment?shop_id=<shop-b-uuid>` with shop A's session cookie.

**What they get.** If shop B has `features.live_studio = true`, the JSON is shop B's products (name, price, stock) plus the stored `live_session_<shopId>` document. After a CF order, that document includes recent comments, `total_cf_revenue`, and `latest_cf_order.promptpay_payload`. Shops without the flag get 404. POST, pitch, and TTS on the live routes bind `shop_id` with `requireShop`.

**Fix.** On GET, ignore the query shop id and use `requireShop`, or require a per-shop overlay secret. Do not return comments, revenue, orders, or PromptPay payloads on an unauthenticated or cross-shop response.

## Leads

These are not confirmed vulnerabilities. No severity.

### Evaluation metrics read every shop and do not check the super-admin allowlist

`src/app/admin/evaluation/actions.ts:22` calls `createAdminClient()` and selects conversations, orders, feedback, and token totals with no shop filter and no `verifySuperAdmin()`. The returned object is counts and rates, not row contents. `src/app/admin/layout.tsx:27` shows a lock screen instead of the page for other emails. The page is a server component (`src/app/admin/evaluation/page.tsx:5`). Whether Next.js 16 exposes this `use server` export as a POST a non-admin can invoke is not settled by the repo.

**Local check.** Build locally and see if `getEvaluationMetrics` has an action id. If it does, call it with no session and with a non-admin session against two dummy shops. **Do not send that call to production.**

### Quotation view and download render a document to anyone who knows the id

`src/utils/supabase/middleware.ts:81` leaves `/doc` and `/api/doc` logged out. `src/app/doc/quotation/[id]/route.ts:16` loads the document with the service role. The accept token at line 99 only controls the approve button. `src/app/api/doc/[id]/download/route.ts:21` has no token at all. `src/app/api/doc/[id]/accept/route.ts:26` does require a token. `supabase/migrations/20261102000000_close_public_policies.sql:9` dropped the public PostgREST SELECT that had listed every shop's documents, and says the link pages are supposed to use the service role.

No reviewed route lists another tenant's document ids. This is a bearer link for one document, which matches the comment in that migration. It becomes a cross-tenant read only if a UUID leaks outside the customer who was sent the link. Confirm locally that PostgREST no longer lists another shop's documents, and decide whether view and download should require the same token as accept.

## What held

- `requireShop` (`src/lib/auth/requireShop.ts:6`) takes the shop from the session. Skill routes, shadow eval, and copilot ignore a body `shop_id`. `authorizeSimulationShop` rejects another shop's id unless the email is on the super-admin allowlist (`src/lib/test/authorizeSimulation.ts:28`).
- LINE rejects a missing or bad `x-line-signature` against that shop's channel secret (`src/app/api/webhook/[shop_id]/route.ts:86`). Per-shop Facebook, Shopee, and TikTok do the same with that shop's secret before creating conversations. The platform Facebook webhook verifies the platform app secret, then maps `entry.id` to `facebook_page_id`.
- `guard_user_privilege_columns` (`supabase/migrations/20261020000000_wallet_billing.sql:61`) blocks `users.role` and `users.workspace_id` changes from `anon` and `authenticated`. Super admin is the email list in `src/lib/auth/superAdmin.ts:6`, not `users.role`. Profile writes are revoked (`supabase/migrations/20261102000400_profiles_no_self_update.sql:15`). The admin mutations that were read call `verifySuperAdmin` or `assertSuperAdmin`.
- Knowledge RPCs are `SECURITY INVOKER`, filter `shop_id`, and `mergeHybridResults` drops a hit from another shop (`src/lib/knowledge/hybrid.ts:164`). The sales tools take `shopId` from server context, not from the model. `ai_response_cache` is keyed by `shop_id` and query hash. BYOK ciphertext is read with the service role by `shop_id`; the shop API returns a hint, not the key.
- `/api/cron/follow-up` returns 503 when `CRON_SECRET` is unset and 401 otherwise (`src/app/api/cron/follow-up/route.ts:27`). There is no `/api/cron/skill-review` route in this tree.
- The open `USING (true)` policies on competitors, live-studio tables, plans writes, and `platform_billing_settings` updates are replaced or dropped by later migrations (`20261017000000`, `20261020000000`, `20261024000000`).

A claimed cross-tenant read through `match_knowledge_chunks` was rejected. The function accepts a shop id, but invoker RLS and the shop filter still apply.

## Coverage

| State | Count | What |
| --- | --- | --- |
| Covered | 6 | Webhook signatures and shop mapping, `requireShop` service-role routes, privilege columns and super admin, BYOK and response cache, follow-up cron, knowledge retrieval |
| Candidate | 5 | The three confirmed findings plus the two leads |
| Deferred | 1 | Storage bucket ACLs after the payment-slips migration. The Oct 24 snapshot shows `payment-slips` private and `qr-codes` and `botify_audio` public. QR objects are written under `<shopId>/<timestamp>_…png` in a public bucket (`src/lib/ai/toolDispatcher.ts:1788`) |
| Out of scope | 1 | Native memory safety. This is a TypeScript and SQL application |

Not checked deeply enough to close: every dashboard server action line by line beyond orders, bookings, products, documents, inbox, broadcast, and billing; storage object policies against a live project; the full body of every `SECURITY DEFINER` function that later migrations revoke from `authenticated`; client-side XSS; dependency CVEs. A fresh database built only from `supabase/migrations` may fail the orders policy if `orders.workspace_id` was never created by a migration. The finding applies to the schema the snapshot records, which is the database these migrations are applied to by hand. The snapshot is dated 2026-10-24 and does not include tables added in November. Those November tables were reviewed from the migration files, not from the snapshot.

Hardening that is not a finding: cron bearer compare is not timing-safe; several handlers return `err.message` to the client; the Gemini prompt-cache map key omits the API key but includes the full system text, so two shops do not share a cache unless that text is identical.
