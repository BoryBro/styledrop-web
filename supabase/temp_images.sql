-- 워터마크 제거용 clean 이미지 임시 저장 테이블
CREATE TABLE IF NOT EXISTS temp_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  clean_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE temp_images ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS deduct_credit(TEXT);

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
