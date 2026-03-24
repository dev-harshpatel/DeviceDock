-- Migration: 044_backfill_purchase_price.sql
-- Fixes historical inventory rows where purchase_price was not scaled
-- proportionally when units were sold (before the proportional-scaling fix
-- was deployed). Two distinct cases are handled:
--
-- Case 1 — quantity = 0 (fully sold out):
--   purchase_price must be 0. Nothing is left in stock so there is no
--   remaining cost to track.
--
-- Case 2 — quantity > 0 (partially sold out, stale purchase_price):
--   purchase_price is derived from price_per_unit (the stable truth):
--     purchase_price = ROUND( (price_per_unit / (1 + hst/100)) * quantity, 2 )
--   price_per_unit is used as the source of truth because it is set once at
--   add/restock time and is never modified during a sale, so it survived the
--   broken period intact.
--
-- Both updates are idempotent — running this migration more than once
-- produces the same result.

-- ── Case 1: qty = 0 ───────────────────────────────────────────────────────
UPDATE inventory
SET
  purchase_price = 0,
  updated_at     = NOW()
WHERE quantity        = 0
  AND purchase_price IS NOT NULL
  AND purchase_price <> 0;

-- ── Case 2: qty > 0 with stale purchase_price ────────────────────────────
-- Only runs for rows that have all three values needed for the inverse formula.
-- Rows where price_per_unit = 0 or is NULL are skipped intentionally (they
-- either have no cost data or were never properly initialised).
UPDATE inventory
SET
  purchase_price = ROUND(
    ( price_per_unit / NULLIF(1.0 + COALESCE(hst, 0) / 100.0, 0) )
    * quantity,
    2
  ),
  updated_at = NOW()
WHERE quantity         > 0
  AND purchase_price  IS NOT NULL
  AND price_per_unit  IS NOT NULL
  AND price_per_unit   > 0
  AND hst             IS NOT NULL;
