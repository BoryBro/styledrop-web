CREATE TABLE IF NOT EXISTS generation_errors (
  id BIGSERIAL PRIMARY KEY,
  style_id TEXT NOT NULL,
  variant TEXT,
  user_id UUID,
  error_type TEXT NOT NULL,
  message TEXT,
  finish_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generation_errors_created_at_idx
  ON generation_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS generation_errors_style_id_idx
  ON generation_errors (style_id, created_at DESC);

ALTER TABLE generation_errors ENABLE ROW LEVEL SECURITY;
