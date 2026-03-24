-- Migration: 020_add_wishlist_items_to_user_profiles.sql
-- Description: Add wishlist_items column to user_profiles for wishlist persistence

-- Add wishlist_items if missing (stored as JSONB array of { itemId: string })
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS wishlist_items JSONB;

-- Default to empty array for existing rows where null
UPDATE public.user_profiles
  SET wishlist_items = '[]'::jsonb
  WHERE wishlist_items IS NULL;

-- Optional: prevent nulls moving forward
ALTER TABLE public.user_profiles
  ALTER COLUMN wishlist_items SET DEFAULT '[]'::jsonb;

