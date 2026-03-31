-- 크레딧 적립 함수 (upsert)
CREATE OR REPLACE FUNCTION add_credits(p_user_id TEXT, p_credits INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits, updated_at)
  VALUES (p_user_id, p_credits, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    credits = user_credits.credits + EXCLUDED.credits,
    updated_at = NOW();
END;
$$;
