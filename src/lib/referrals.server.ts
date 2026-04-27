import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import {
  REFERRAL_GENERATION_REWARD_CREDITS,
  REFERRAL_GENERATION_THRESHOLD,
  REFERRAL_MONTHLY_REWARD_CAP_CREDITS,
  REFERRAL_PAYMENT_REWARD_CREDITS,
  REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
  getReferralRewardExpiryIso,
  normalizeReferralCode,
} from "@/lib/referral";

type ReferralAttributionRow = {
  referrer_user_id: string;
  referred_user_id: string;
  first_generation_at: string | null;
  first_payment_at: string | null;
};

type ReferralRewardRow = {
  credits_awarded: number | null;
};

function getMonthStartIso(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth(), 1).toISOString();
}

async function getMonthlyAwardedCredits(supabase: SupabaseClient, referrerUserId: string) {
  const { data, error } = await supabase
    .from("referral_rewards")
    .select("credits_awarded")
    .eq("referrer_user_id", referrerUserId)
    .eq("status", "granted")
    .in("reward_type", ["generation_milestone", "first_payment"])
    .gte("created_at", getMonthStartIso());

  if (error) throw error;

  return ((data ?? []) as ReferralRewardRow[]).reduce(
    (sum, row) => sum + Math.max(0, row.credits_awarded ?? 0),
    0,
  );
}

async function grantReferrerReward(
  supabase: SupabaseClient,
  {
    referrerUserId,
    referredUserId,
    rewardType,
    sourceId,
    milestoneCount,
    credits,
  }: {
    referrerUserId: string;
    referredUserId: string;
    rewardType: "generation_milestone" | "first_payment";
    sourceId: string;
    milestoneCount: number | null;
    credits: number;
  },
) {
  const alreadyAwarded = await supabase
    .from("referral_rewards")
    .select("id")
    .eq("source_id", sourceId)
    .maybeSingle();

  if (alreadyAwarded.error) throw alreadyAwarded.error;
  if (alreadyAwarded.data) return 0;

  const usedThisMonth = await getMonthlyAwardedCredits(supabase, referrerUserId);
  const awardCredits = Math.min(
    credits,
    Math.max(0, REFERRAL_MONTHLY_REWARD_CAP_CREDITS - usedThisMonth),
  );

  if (awardCredits <= 0) return 0;

  const rewardInsert = await supabase.from("referral_rewards").insert({
    referrer_user_id: referrerUserId,
    referred_user_id: referredUserId,
    reward_type: rewardType,
    source_id: sourceId,
    milestone_count: milestoneCount,
    credits_awarded: awardCredits,
    status: "pending",
  });

  if (rewardInsert.error) throw rewardInsert.error;

  const creditResult = await addCreditsWithPolicy(supabase, {
    userId: referrerUserId,
    credits: awardCredits,
    sourceType: "reward",
    sourceId,
    expiresAt: getReferralRewardExpiryIso(),
  });

  if (!creditResult.ok) {
    await supabase
      .from("referral_rewards")
      .update({ status: "failed" })
      .eq("source_id", sourceId);
    throw creditResult.error ?? new Error("referral reward credit grant failed");
  }

  await supabase
    .from("referral_rewards")
    .update({ status: "granted" })
    .eq("source_id", sourceId);

  await supabase.from("user_events").insert({
    user_id: referrerUserId,
    event_type: "referral_reward_granted",
    metadata: {
      reward_type: rewardType,
      referred_user_id: referredUserId,
      milestone_count: milestoneCount,
      credits: awardCredits,
    },
  });

  return awardCredits;
}

export async function recordReferralAttribution(
  supabase: SupabaseClient,
  {
    referrerCode,
    referredUserId,
  }: {
    referrerCode: string | null | undefined;
    referredUserId: string;
  },
) {
  const referrerUserId = normalizeReferralCode(referrerCode);
  if (!referrerUserId || referrerUserId === referredUserId) return false;

  try {
    const { data: referrer, error: referrerError } = await supabase
      .from("users")
      .select("id")
      .eq("id", referrerUserId)
      .maybeSingle();

    if (referrerError || !referrer) return false;

    const { data: existing, error: existingError } = await supabase
      .from("referral_attributions")
      .select("referred_user_id")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();

    if (existingError || existing) return false;

    const { error } = await supabase.from("referral_attributions").insert({
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      referral_code: referrerUserId,
    });

    if (error) return false;

    await supabase.from("user_events").insert({
      user_id: referredUserId,
      event_type: "referral_attributed",
      metadata: { referrer_user_id: referrerUserId },
    });

    return true;
  } catch (error) {
    console.error("[referrals] attribution skipped:", error);
    return false;
  }
}

export async function rewardReferralForFirstGeneration(
  supabase: SupabaseClient,
  referredUserId: string,
) {
  try {
    const updateRes = await supabase
      .from("referral_attributions")
      .update({ first_generation_at: new Date().toISOString() })
      .eq("referred_user_id", referredUserId)
      .is("first_generation_at", null)
      .select("referrer_user_id, referred_user_id, first_generation_at, first_payment_at")
      .maybeSingle();

    if (updateRes.error || !updateRes.data) return { awardedCredits: 0, qualifiedCount: null };

    const attribution = updateRes.data as ReferralAttributionRow;
    const countRes = await supabase
      .from("referral_attributions")
      .select("referred_user_id", { count: "exact", head: true })
      .eq("referrer_user_id", attribution.referrer_user_id)
      .not("first_generation_at", "is", null);

    if (countRes.error) throw countRes.error;

    const qualifiedCount = countRes.count ?? 0;
    if (qualifiedCount < REFERRAL_GENERATION_THRESHOLD || qualifiedCount % REFERRAL_GENERATION_THRESHOLD !== 0) {
      return { awardedCredits: 0, qualifiedCount };
    }

    const awardedCredits = await grantReferrerReward(supabase, {
      referrerUserId: attribution.referrer_user_id,
      referredUserId: attribution.referred_user_id,
      rewardType: "generation_milestone",
      sourceId: `referral:generation:${attribution.referrer_user_id}:${qualifiedCount}`,
      milestoneCount: qualifiedCount,
      credits: REFERRAL_GENERATION_REWARD_CREDITS,
    });

    return { awardedCredits, qualifiedCount };
  } catch (error) {
    console.error("[referrals] first generation reward skipped:", error);
    return { awardedCredits: 0, qualifiedCount: null };
  }
}

export async function rewardReferralForFirstPayment(
  supabase: SupabaseClient,
  {
    referredUserId,
    paymentId,
  }: {
    referredUserId: string;
    paymentId: string;
  },
) {
  try {
    const updateRes = await supabase
      .from("referral_attributions")
      .update({ first_payment_at: new Date().toISOString() })
      .eq("referred_user_id", referredUserId)
      .is("first_payment_at", null)
      .select("referrer_user_id, referred_user_id, first_generation_at, first_payment_at")
      .maybeSingle();

    if (updateRes.error || !updateRes.data) {
      return { referrerCredits: 0, referredBonusCredits: 0 };
    }

    const attribution = updateRes.data as ReferralAttributionRow;
    const referrerCredits = await grantReferrerReward(supabase, {
      referrerUserId: attribution.referrer_user_id,
      referredUserId: attribution.referred_user_id,
      rewardType: "first_payment",
      sourceId: `referral:first_payment:${attribution.referred_user_id}:${paymentId}`,
      milestoneCount: null,
      credits: REFERRAL_PAYMENT_REWARD_CREDITS,
    });

    const referredBonusSourceId = `referral:referred_payment_bonus:${attribution.referred_user_id}:${paymentId}`;
    const bonusExists = await supabase
      .from("referral_rewards")
      .select("id")
      .eq("source_id", referredBonusSourceId)
      .maybeSingle();

    if (bonusExists.error) throw bonusExists.error;

    let referredBonusCredits = 0;
    if (!bonusExists.data) {
      const insertBonus = await supabase.from("referral_rewards").insert({
        referrer_user_id: attribution.referrer_user_id,
        referred_user_id: attribution.referred_user_id,
        reward_type: "referred_first_payment_bonus",
        source_id: referredBonusSourceId,
        milestone_count: null,
        credits_awarded: REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
        status: "pending",
      });

      if (insertBonus.error) throw insertBonus.error;

      const creditResult = await addCreditsWithPolicy(supabase, {
        userId: attribution.referred_user_id,
        credits: REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
        sourceType: "reward",
        sourceId: referredBonusSourceId,
        expiresAt: getReferralRewardExpiryIso(),
      });

      if (!creditResult.ok) {
        await supabase
          .from("referral_rewards")
          .update({ status: "failed" })
          .eq("source_id", referredBonusSourceId);
        throw creditResult.error ?? new Error("referred referral bonus credit grant failed");
      }

      await supabase
        .from("referral_rewards")
        .update({ status: "granted" })
        .eq("source_id", referredBonusSourceId);

      referredBonusCredits = REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS;
    }

    return { referrerCredits, referredBonusCredits };
  } catch (error) {
    console.error("[referrals] first payment reward skipped:", error);
    return { referrerCredits: 0, referredBonusCredits: 0 };
  }
}

export async function getReferralSummary(supabase: SupabaseClient, userId: string) {
  const [qualifiedRes, monthlyRewardsRes] = await Promise.all([
    supabase
      .from("referral_attributions")
      .select("referred_user_id", { count: "exact", head: true })
      .eq("referrer_user_id", userId)
      .not("first_generation_at", "is", null),
    supabase
      .from("referral_rewards")
      .select("credits_awarded")
      .eq("referrer_user_id", userId)
      .eq("status", "granted")
      .in("reward_type", ["generation_milestone", "first_payment"])
      .gte("created_at", getMonthStartIso()),
  ]);

  if (qualifiedRes.error || monthlyRewardsRes.error) {
    throw qualifiedRes.error ?? monthlyRewardsRes.error;
  }

  const monthlyRewardCredits = ((monthlyRewardsRes.data ?? []) as ReferralRewardRow[]).reduce(
    (sum, row) => sum + Math.max(0, row.credits_awarded ?? 0),
    0,
  );

  const qualifiedCount = qualifiedRes.count ?? 0;
  const remainder = qualifiedCount % REFERRAL_GENERATION_THRESHOLD;
  const remainingForNextReward = remainder === 0
    ? REFERRAL_GENERATION_THRESHOLD
    : REFERRAL_GENERATION_THRESHOLD - remainder;

  return {
    referralCode: userId,
    qualifiedCount,
    remainingForNextReward,
    monthlyRewardCredits,
    monthlyRewardCap: REFERRAL_MONTHLY_REWARD_CAP_CREDITS,
    generationThreshold: REFERRAL_GENERATION_THRESHOLD,
    generationRewardCredits: REFERRAL_GENERATION_REWARD_CREDITS,
    paymentRewardCredits: REFERRAL_PAYMENT_REWARD_CREDITS,
    referredPaymentBonusCredits: REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
  };
}
