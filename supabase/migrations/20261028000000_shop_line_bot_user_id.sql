-- The LINE bot's own user ID (from /v2/bot/info), saved with the shop's channel settings.
-- One LINE OA can serve only one shop: its webhook URL points at one shop, so a second
-- shop using the same OA sends messages its customers' replies never come back to.
-- The app refuses a channel another shop already uses; this column lets it recognise the
-- same OA even when the two shops pasted different access tokens.
alter table public.shops add column if not exists line_bot_user_id text;
create index if not exists shops_line_bot_user_id_idx on public.shops (line_bot_user_id) where line_bot_user_id is not null;
