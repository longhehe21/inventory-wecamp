-- ============================================================
-- wECAMP Auth Schema - Chạy trong Supabase SQL Editor
-- ============================================================

-- Bảng hồ sơ người dùng
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'manager', 'employee')),
  category TEXT CHECK (category IN ('Bếp', 'Quầy', 'Lễ tân')), -- chỉ dành cho nhân viên
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Người dùng đọc được profile của mình
CREATE POLICY "read_own_profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin đọc/ghi tất cả profile
CREATE POLICY "admin_all" ON user_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- Tạo tài khoản Admin đầu tiên
-- Bước 1: Tạo user trong Supabase Auth > Users > Add User
--         (điền email + password, bật "Auto Confirm User")
-- Bước 2: Copy UUID của user vừa tạo, chạy lệnh INSERT bên dưới:
-- ============================================================

-- INSERT INTO user_profiles (id, email, full_name, role)
-- VALUES ('UUID-CUA-ADMIN', 'admin@wecamp.com', 'Admin wECAMP', 'admin');

-- ============================================================
-- Cấu hình biến môi trường trên Vercel / .env.local
-- ============================================================
-- NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
-- SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   ← lấy từ Supabase > Settings > API > service_role
