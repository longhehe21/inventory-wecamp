-- ============================================================
-- wECAMP Lễ tân (Reception) warehouse migration
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- 1. Re-allow 'Lễ tân' in products.category (for products that ONLY exist in Lễ tân)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('Bếp', 'Quầy', 'Lễ tân'));

-- 2. Add `in_letan` flag for products that ALSO appear in Lễ tân
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS in_letan BOOLEAN NOT NULL DEFAULT false;

-- 3. Re-allow 'Lễ tân' in user_profiles.category
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_category_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_category_check
  CHECK (category IN ('Bếp', 'Quầy', 'Lễ tân'));

-- 4. Add `warehouse` to inventory_daily so the same product can have separate
--    inventory tracks for Bếp/Quầy AND Lễ tân on the same day.
ALTER TABLE inventory_daily
  ADD COLUMN IF NOT EXISTS warehouse TEXT;

-- Backfill: existing rows belong to their product's category (Bếp or Quầy)
UPDATE inventory_daily d
  SET warehouse = p.category
  FROM products p
  WHERE d.product_id = p.id
    AND d.warehouse IS NULL;

ALTER TABLE inventory_daily ALTER COLUMN warehouse SET NOT NULL;

ALTER TABLE inventory_daily DROP CONSTRAINT IF EXISTS inventory_daily_warehouse_check;
ALTER TABLE inventory_daily
  ADD CONSTRAINT inventory_daily_warehouse_check
  CHECK (warehouse IN ('Bếp', 'Quầy', 'Lễ tân'));

-- 5. Replace UNIQUE(product_id, date) with UNIQUE(product_id, date, warehouse)
ALTER TABLE inventory_daily DROP CONSTRAINT IF EXISTS inventory_daily_product_id_date_key;
ALTER TABLE inventory_daily
  ADD CONSTRAINT inventory_daily_product_id_date_warehouse_key
  UNIQUE (product_id, date, warehouse);

-- 6. Helpful index
CREATE INDEX IF NOT EXISTS idx_inventory_daily_warehouse ON inventory_daily(warehouse);
