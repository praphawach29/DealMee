-- 20260802000000_ai_evaluation_customer_user_id.sql
-- Add customer_user_id column to orders and bookings tables to enable cross-channel customer attribution
-- and provide input for the upcoming AI Evaluation Framework (ROADMAP_AI_AGENT.md Section 11).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_user_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_user_id VARCHAR(255);

-- Create performance indexes for evaluation queries and customer-scoped analytics
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id ON orders (shop_id, customer_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user_id ON bookings (shop_id, customer_user_id);

COMMENT ON COLUMN orders.customer_user_id IS 'Unique customer identifier across channels (e.g. LINE userId, web sessionId) for AI evaluation';
COMMENT ON COLUMN bookings.customer_user_id IS 'Unique customer identifier across channels (e.g. LINE userId, web sessionId) for AI evaluation';
