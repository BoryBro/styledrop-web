CREATE TABLE IF NOT EXISTS admin_style_controls (
  style_id TEXT PRIMARY KEY,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  disabled_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_style_controls ENABLE ROW LEVEL SECURITY;
