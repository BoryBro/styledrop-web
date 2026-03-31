-- 유저 크레딧 잔액
CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결제 내역
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,           -- PortOne payment_id
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,       -- 결제 금액 (원)
  credits INTEGER NOT NULL,      -- 지급 크레딧 수
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | cancelled
  pg_provider TEXT,              -- kakaopay | tosspay | naverpay
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Service role만 접근 (서버에서만 처리)
CREATE POLICY "service_only_credits" ON user_credits
  USING (false) WITH CHECK (false);

CREATE POLICY "service_only_payments" ON payments
  USING (false) WITH CHECK (false);
