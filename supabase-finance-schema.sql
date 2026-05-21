-- ============================================================
-- wECAMP Finance Schema - Chạy trong Supabase SQL Editor
-- ============================================================

-- 1. Thu (theo ngày, có nguồn: bar = quầy bar, ticket = vé vào)
CREATE TABLE IF NOT EXISTS daily_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('bar', 'ticket')),
  cash NUMERIC NOT NULL DEFAULT 0,
  transfer NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, source)
);

-- 2. Chi (nhiều bản ghi/ngày, track ai nhập)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'transfer')),
  amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Nộp tiền mặt vào ngân hàng
CREATE TABLE IF NOT EXISTS cash_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_revenue_date ON daily_revenue(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_type ON expenses(payment_type);
CREATE INDEX IF NOT EXISTS idx_cash_deposits_date ON cash_deposits(date DESC);

-- Trigger update updated_at
CREATE TRIGGER trg_daily_revenue_updated_at
  BEFORE UPDATE ON daily_revenue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE daily_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON daily_revenue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON cash_deposits FOR ALL USING (true) WITH CHECK (true);
