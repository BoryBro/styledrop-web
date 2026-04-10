BEGIN;

-- public read로 잘못 열릴 수 있는 민감 테이블 잠금
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transform_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.style_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audition_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audition_shares ENABLE ROW LEVEL SECURITY;

-- 잘못 추가된 공개 정책 제거
DROP POLICY IF EXISTS "users: public read" ON public.users;
DROP POLICY IF EXISTS "user_events: public read" ON public.user_events;

-- 임시 정책/이전 정책 정리
DROP POLICY IF EXISTS "transform_history: deny anon" ON public.transform_history;
DROP POLICY IF EXISTS "style_usage: deny anon" ON public.style_usage;
DROP POLICY IF EXISTS "audition_history: deny anon" ON public.audition_history;
DROP POLICY IF EXISTS "audition_shares: deny anon" ON public.audition_shares;

DROP POLICY IF EXISTS "service_only_users" ON public.users;
DROP POLICY IF EXISTS "service_only_user_events" ON public.user_events;
DROP POLICY IF EXISTS "service_only_transform_history" ON public.transform_history;
DROP POLICY IF EXISTS "service_only_style_usage" ON public.style_usage;
DROP POLICY IF EXISTS "service_only_audition_history" ON public.audition_history;
DROP POLICY IF EXISTS "service_only_audition_shares" ON public.audition_shares;

-- 서버 API(service role) 이외 접근 차단
CREATE POLICY "service_only_users" ON public.users
  USING (false) WITH CHECK (false);

CREATE POLICY "service_only_user_events" ON public.user_events
  USING (false) WITH CHECK (false);

CREATE POLICY "service_only_transform_history" ON public.transform_history
  USING (false) WITH CHECK (false);

CREATE POLICY "service_only_style_usage" ON public.style_usage
  USING (false) WITH CHECK (false);

CREATE POLICY "service_only_audition_history" ON public.audition_history
  USING (false) WITH CHECK (false);

CREATE POLICY "service_only_audition_shares" ON public.audition_shares
  USING (false) WITH CHECK (false);

COMMIT;
