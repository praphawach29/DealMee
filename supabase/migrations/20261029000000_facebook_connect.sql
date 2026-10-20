-- "เชื่อมเพจด้วย Facebook": pages connected through DealMee's own Meta app.
-- facebook_connected_via: 'oauth' (the platform webhook /api/webhook/facebook serves it)
-- or null for the older per-shop Meta app (its own webhook /api/webhook/facebook/[shop_id]).
-- facebook_user_id: the Facebook user who connected, so Meta's data deletion and
-- deauthorize callbacks can find the shops to disconnect.
alter table public.shops add column if not exists facebook_page_name text;
alter table public.shops add column if not exists facebook_connected_via text;
alter table public.shops add column if not exists facebook_user_id text;
create index if not exists shops_facebook_page_id_idx on public.shops (facebook_page_id) where facebook_page_id is not null;
