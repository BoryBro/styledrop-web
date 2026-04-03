-- 로그인 유저 AI 오디션 히스토리 (24시간 보관)
CREATE TABLE IF NOT EXISTS audition_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_id TEXT REFERENCES audition_shares(id) ON DELETE SET NULL,
  avg_score INTEGER,
  assigned_role TEXT,
  still_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audition_history_user_id ON audition_history(user_id);
CREATE INDEX IF NOT EXISTS idx_audition_history_created_at ON audition_history(created_at);

-- 24시간 지난 히스토리 자동 삭제 (선택사항)
-- SELECT cron.schedule('cleanup-audition-history', '0 4 * * *', $$DELETE FROM audition_history WHERE created_at < NOW() - INTERVAL '1 day'$$);
