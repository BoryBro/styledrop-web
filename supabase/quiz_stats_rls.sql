BEGIN;

ALTER TABLE IF EXISTS public.quiz_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only_quiz_stats" ON public.quiz_stats;

CREATE POLICY "service_only_quiz_stats" ON public.quiz_stats
  USING (false)
  WITH CHECK (false);

COMMIT;
