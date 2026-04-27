-- Referral rewards
-- Apply this in Supabase SQL Editor before testing the referral reward flow.

CREATE TABLE IF NOT EXISTS referral_attributions (
  referred_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_generation_at TIMESTAMPTZ,
  first_payment_at TIMESTAMPTZ,
  CHECK (referred_user_id <> referrer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer
  ON referral_attributions (referrer_user_id, attributed_at);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_generation
  ON referral_attributions (referrer_user_id, first_generation_at)
  WHERE first_generation_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  source_id TEXT UNIQUE,
  milestone_count INTEGER,
  credits_awarded INTEGER NOT NULL CHECK (credits_awarded >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_created
  ON referral_rewards (referrer_user_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_referred_type
  ON referral_rewards (referred_user_id, reward_type);

ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_only_referral_attributions ON referral_attributions;
CREATE POLICY service_only_referral_attributions ON referral_attributions
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS service_only_referral_rewards ON referral_rewards;
CREATE POLICY service_only_referral_rewards ON referral_rewards
  USING (false) WITH CHECK (false);
