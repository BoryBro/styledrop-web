-- style_usage 테이블에 variant 컬럼 추가
ALTER TABLE style_usage ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'default';
