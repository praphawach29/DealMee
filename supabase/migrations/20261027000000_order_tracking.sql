-- Parcel tracking, step 1: the shop enters the carrier and tracking number (tracking_no
-- already exists) and the customer is told in their chat. No carrier API.
alter table public.orders add column if not exists tracking_carrier text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists shipped_at timestamptz;
