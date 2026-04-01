-- 유저 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kakao_id BIGINT UNIQUE NOT NULL,
  nickname TEXT,
  profile_image TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- 변환 히스토리 (로그인 유저만, 3일 보관)
CREATE TABLE IF NOT EXISTS transform_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  style_id TEXT NOT NULL,
  result_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transform_history_created_at ON transform_history(created_at);

-- 유저 활동 추적 (login, transform, share_kakao, share_link_copy, revisit)
CREATE TABLE IF NOT EXISTS user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- style_usage에 user_id 추가 (nullable — 비로그인 호환)
ALTER TABLE style_usage ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 24시간 지난 히스토리 자동 삭제 (Supabase cron 또는 pg_cron 사용)
-- SELECT cron.schedule('cleanup-old-history', '0 4 * * *', $$DELETE FROM transform_history WHERE created_at < NOW() - INTERVAL '1 day'$$);
