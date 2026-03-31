CREATE TABLE IF NOT EXISTS notices (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- 초기 공지 데이터
INSERT INTO notices (text, active, sort_order) VALUES
  ('v2.0  이제 1크레딧 = AI 변환 1회. 워터마크 없음.', true, 0),
  ('신규 가입 시 3크레딧 무료 지급. 지금 바로 시작해보세요.', true, 1)
ON CONFLICT DO NOTHING;
