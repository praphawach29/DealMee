-- Flexible booking model shared by restaurants, services, classes, clinics, queues, and appointments.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'service';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS resource_label TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS capacity_per_slot INT DEFAULT 1;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS required_fields TEXT[] DEFAULT ARRAY['name','phone','date','time'];
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS booking_metadata JSONB DEFAULT '{}'::jsonb;

-- Some production databases were created before the bookings migration included these fields.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_no TEXT DEFAULT 'BK-000';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_time TIME DEFAULT '10:00:00';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'service';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS resource_label TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guest_count INT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_services_shop_booking_type ON public.services(shop_id, booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_shop_service_date_time ON public.bookings(shop_id, service_id, booking_date, booking_time);
