-- Realtime UPDATE payloads include `old` row only when REPLICA IDENTITY is FULL.
-- Needed for user-side notifications (status transitions) on orders, stock_requests, wishes.

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.stock_requests REPLICA IDENTITY FULL;
ALTER TABLE public.wishes REPLICA IDENTITY FULL;
