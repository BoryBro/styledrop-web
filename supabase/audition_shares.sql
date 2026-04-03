-- AI 오디션 공유 결과 테이블
CREATE TABLE IF NOT EXISTS audition_shares (
  id TEXT PRIMARY KEY,
  result_json JSONB NOT NULL,
  genres_json JSONB,
  best_scene_idx INTEGER DEFAULT 0,
  user_photo_url TEXT,
  still_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30일 지난 공유 결과 자동 삭제 (선택사항)
-- SELECT cron.schedule('cleanup-old-shares', '0 3 * * *', $$DELETE FROM audition_shares WHERE created_at < NOW() - INTERVAL '30 days'$$);
