-- Enable Supabase Realtime for inventory, orders, and user_profiles tables
-- Required for postgres_changes to work - without this, Realtime subscriptions won't receive events
--
-- If migration fails with "relation already in publication", tables are already enabled - skip.
-- Or add manually via Dashboard: Database > Publications > supabase_realtime

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
EXCEPTION WHEN OTHERS THEN NULL; -- Ignore if already in publication
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
