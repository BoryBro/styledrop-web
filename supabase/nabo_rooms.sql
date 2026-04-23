BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.nabo_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  owner_user_id TEXT,
  owner_name TEXT NOT NULL,
  owner_token_hash TEXT NOT NULL,
  respondent_token TEXT NOT NULL,
  respondent_token_hash TEXT NOT NULL,
  response_target INTEGER NOT NULL DEFAULT 5 CHECK (response_target BETWEEN 1 AND 20),
  result_available_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  premium_access_at TIMESTAMPTZ,
  premium_access_by_user_id TEXT,
  premium_access_credits_cost INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

ALTER TABLE public.nabo_rooms
  ADD COLUMN IF NOT EXISTS respondent_token TEXT;

UPDATE public.nabo_rooms
SET respondent_token = encode(gen_random_bytes(24), 'base64')
WHERE respondent_token IS NULL;

ALTER TABLE public.nabo_rooms
  ALTER COLUMN respondent_token SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.nabo_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.nabo_rooms(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  client_fingerprint_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nabo_rooms_room_code_idx ON public.nabo_rooms (room_code);
CREATE INDEX IF NOT EXISTS nabo_rooms_owner_user_id_idx ON public.nabo_rooms (owner_user_id);
CREATE INDEX IF NOT EXISTS nabo_rooms_created_at_idx ON public.nabo_rooms (created_at DESC);
CREATE INDEX IF NOT EXISTS nabo_responses_room_id_created_at_idx ON public.nabo_responses (room_id, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS nabo_responses_room_fingerprint_unique_idx
  ON public.nabo_responses (room_id, client_fingerprint_hash)
  WHERE client_fingerprint_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_nabo_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_nabo_room_updated_at_trigger ON public.nabo_rooms;
CREATE TRIGGER set_nabo_room_updated_at_trigger
BEFORE UPDATE ON public.nabo_rooms
FOR EACH ROW
EXECUTE FUNCTION public.set_nabo_room_updated_at();

ALTER TABLE public.nabo_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nabo_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only_nabo_rooms" ON public.nabo_rooms;
CREATE POLICY "service_only_nabo_rooms" ON public.nabo_rooms
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_only_nabo_responses" ON public.nabo_responses;
CREATE POLICY "service_only_nabo_responses" ON public.nabo_responses
  USING (false) WITH CHECK (false);

COMMIT;
