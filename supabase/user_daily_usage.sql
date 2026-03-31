-- 회원 일별 사용량 서버 사이드 제한 테이블
CREATE TABLE IF NOT EXISTS user_daily_usage (
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE user_daily_usage ENABLE ROW LEVEL SECURITY;

-- 원자적 사용량 체크 + 증가 함수
-- 허용되면 TRUE, 한도 초과면 FALSE 반환
CREATE OR REPLACE FUNCTION check_and_increment_usage(p_user_id TEXT, p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO user_daily_usage (user_id, date, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = CASE
    WHEN user_daily_usage.count < p_limit THEN user_daily_usage.count + 1
    ELSE user_daily_usage.count
  END
  RETURNING count INTO new_count;

  RETURN new_count <= p_limit;
END;
$$;

-- 오늘 사용량 조회 함수
CREATE OR REPLACE FUNCTION get_daily_usage(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT count INTO current_count
  FROM user_daily_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  RETURN COALESCE(current_count, 0);
END;
$$;
