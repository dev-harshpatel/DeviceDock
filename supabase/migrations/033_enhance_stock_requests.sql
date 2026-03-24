-- Enhance stock_requests with admin messaging and fulfillment tracking

-- Add admin_message column so admins can notify users with a custom message
ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS admin_message TEXT;

-- Add fulfilled_at timestamp for when the item was restocked
ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

-- Enable realtime publication for stock_requests
-- so users receive instant in-app notifications when their requests are fulfilled
ALTER PUBLICATION supabase_realtime ADD TABLE stock_requests;
