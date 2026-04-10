-- AI 오디션 공유 결과 테이블
-- 기존 테이블에 user_photos_json 컬럼 추가 (이미 테이블이 있는 경우)
ALTER TABLE audition_shares ADD COLUMN IF NOT EXISTS user_photos_json JSONB;

CREATE TABLE IF NOT EXISTS audition_shares (
  id TEXT PRIMARY KEY,
  result_json JSONB NOT NULL,
  genres_json JSONB,
  best_scene_idx INTEGER DEFAULT 0,
  user_photo_url TEXT,
  still_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audition_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only_audition_shares" ON audition_shares;
CREATE POLICY "service_only_audition_shares" ON audition_shares
  USING (false) WITH CHECK (false);

-- 30일 지난 공유 결과 자동 삭제 (선택사항)
-- SELECT cron.schedule('cleanup-old-shares', '0 3 * * *', $$DELETE FROM audition_shares WHERE created_at < NOW() - INTERVAL '30 days'$$);
