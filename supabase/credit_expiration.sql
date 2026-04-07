-- 크레딧 유효기간 1년 정책
-- 결제/보상/수동 지급 크레딧을 lot 단위로 관리하고,
-- 만료되지 않은 lot만 합산해서 사용합니다.

CREATE TABLE IF NOT EXISTS credit_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  total_credits INTEGER NOT NULL CHECK (total_credits >= 0),
  remaining_credits INTEGER NOT NULL CHECK (remaining_credits >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_lots_user_expires
  ON credit_lots (user_id, expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_credit_lots_source
  ON credit_lots (source_type, source_id);

ALTER TABLE credit_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_only_credit_lots ON credit_lots;
CREATE POLICY service_only_credit_lots ON credit_lots
  USING (false) WITH CHECK (false);

DROP FUNCTION IF EXISTS add_credits(TEXT, INTEGER);
DROP FUNCTION IF EXISTS deduct_credit(TEXT);
DROP FUNCTION IF EXISTS refresh_user_credit_balance(TEXT);
DROP FUNCTION IF EXISTS get_available_credits(TEXT);
DROP FUNCTION IF EXISTS set_credit_balance(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION refresh_user_credit_balance(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  available_credits INTEGER;
BEGIN
  SELECT COALESCE(SUM(remaining_credits), 0)::INTEGER
    INTO available_credits
  FROM credit_lots
  WHERE user_id = p_user_id
    AND remaining_credits > 0
    AND expires_at > NOW();

  INSERT INTO user_credits (user_id, credits, updated_at)
  VALUES (p_user_id, available_credits, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    credits = EXCLUDED.credits,
    updated_at = NOW();

  RETURN available_credits;
END;
$$;

CREATE OR REPLACE FUNCTION get_available_credits(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN refresh_user_credit_balance(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION add_credits(
  p_user_id TEXT,
  p_credits INTEGER,
  p_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 year',
  p_source_type TEXT DEFAULT 'manual',
  p_source_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE(p_credits, 0) <= 0 THEN
    RETURN refresh_user_credit_balance(p_user_id);
  END IF;

  INSERT INTO credit_lots (
    user_id,
    source_type,
    source_id,
    total_credits,
    remaining_credits,
    expires_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(p_source_type, 'manual'),
    p_source_id,
    p_credits,
    p_credits,
    COALESCE(p_expires_at, NOW() + INTERVAL '1 year'),
    NOW(),
    NOW()
  );

  RETURN refresh_user_credit_balance(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION deduct_credit(
  p_user_id TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_to_deduct INTEGER := GREATEST(COALESCE(p_amount, 1), 1);
  lot_row RECORD;
  deduct_from_lot INTEGER;
BEGIN
  PERFORM refresh_user_credit_balance(p_user_id);

  FOR lot_row IN
    SELECT id, remaining_credits
    FROM credit_lots
    WHERE user_id = p_user_id
      AND remaining_credits > 0
      AND expires_at > NOW()
    ORDER BY expires_at ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining_to_deduct <= 0;

    deduct_from_lot := LEAST(lot_row.remaining_credits, remaining_to_deduct);

    UPDATE credit_lots
    SET remaining_credits = remaining_credits - deduct_from_lot,
        updated_at = NOW()
    WHERE id = lot_row.id;

    remaining_to_deduct := remaining_to_deduct - deduct_from_lot;
  END LOOP;

  IF remaining_to_deduct > 0 THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  RETURN refresh_user_credit_balance(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION set_credit_balance(
  p_user_id TEXT,
  p_credits INTEGER,
  p_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 year'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE credit_lots
  SET remaining_credits = 0,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND remaining_credits > 0;

  IF COALESCE(p_credits, 0) > 0 THEN
    INSERT INTO credit_lots (
      user_id,
      source_type,
      source_id,
      total_credits,
      remaining_credits,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      'manual',
      NULL,
      p_credits,
      p_credits,
      COALESCE(p_expires_at, NOW() + INTERVAL '1 year'),
      NOW(),
      NOW()
    );
  END IF;

  RETURN refresh_user_credit_balance(p_user_id);
END;
$$;
