-- 워터마크 제거용 clean 이미지 임시 저장 테이블
CREATE TABLE IF NOT EXISTS temp_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  clean_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE temp_images ENABLE ROW LEVEL SECURITY;

-- 크레딧 차감 함수 (원자적)
CREATE OR REPLACE FUNCTION deduct_credit(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  UPDATE user_credits
  SET credits = credits - 1, updated_at = NOW()
  WHERE user_id = p_user_id AND credits > 0
  RETURNING credits INTO new_credits;

  IF new_credits IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  RETURN new_credits;
END;
$$;
