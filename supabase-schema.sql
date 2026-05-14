-- ============================================================
-- wECAMP Cafe Retreat - Supabase Schema
-- Chạy SQL này trong Supabase SQL Editor
-- ============================================================

-- 1. Bảng Đơn vị (Units) - cho phép tự thêm
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('base', 'package')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, type)
);

-- Pre-populate units mặc định
INSERT INTO units (name, type) VALUES
  ('g', 'base'), ('kg', 'base'), ('l', 'base'), ('ml', 'base'),
  ('con', 'base'), ('cái', 'base'), ('phần', 'base'),
  ('túi', 'package'), ('hộp', 'package'), ('chai', 'package'),
  ('gói', 'package'), ('lon', 'package'), ('thùng', 'package'),
  ('cái', 'package'), ('kg', 'package'), ('lít', 'package')
ON CONFLICT (name, type) DO NOTHING;

-- 2. Bảng Hàng hóa (Products) - đơn vị giờ là TEXT tự do
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Bếp', 'Quầy')),
  unit TEXT NOT NULL,
  package_unit TEXT,
  package_size NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nếu bảng đã tồn tại, thêm cột package_unit (chạy riêng nếu cần):
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS package_unit TEXT
--   CHECK (package_unit IN ('túi', 'hộp', 'chai', 'gói', 'lon', 'thùng', 'cái', 'kg', 'lít'));
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;
-- ALTER TABLE products ADD CONSTRAINT products_unit_check CHECK (unit IN ('g', 'kg', 'l', 'ml'));

-- 2. Bảng Tồn kho hàng ngày (Inventory Daily)
CREATE TABLE IF NOT EXISTS inventory_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  opening_stock NUMERIC NOT NULL DEFAULT 0,
  received NUMERIC NOT NULL DEFAULT 0,
  closing_stock NUMERIC NOT NULL DEFAULT 0,
  actual_used NUMERIC GENERATED ALWAYS AS (opening_stock + received - closing_stock) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, date)
);

-- 3. Bảng Công thức (Recipes)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Bảng Dữ liệu bán hàng Fabi
CREATE TABLE IF NOT EXISTS fabi_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Triggers: tự động cập nhật updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabi_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc/ghi public (điều chỉnh sau khi thêm auth)
CREATE POLICY "Allow all for now" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON inventory_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON fabi_sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON units FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_daily_date ON inventory_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_daily_product ON inventory_daily(product_id);
CREATE INDEX IF NOT EXISTS idx_fabi_sales_date ON fabi_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
