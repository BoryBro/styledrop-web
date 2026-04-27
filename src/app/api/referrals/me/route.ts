import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  REFERRAL_GENERATION_REWARD_CREDITS,
  REFERRAL_GENERATION_THRESHOLD,
  REFERRAL_MONTHLY_REWARD_CAP_CREDITS,
  REFERRAL_PAYMENT_REWARD_CREDITS,
  REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
} from "@/lib/referral";
import { getReferralSummary } from "@/lib/referrals.server";

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fallback = {
    referralCode: session.id,
    qualifiedCount: 0,
    remainingForNextReward: REFERRAL_GENERATION_THRESHOLD,
    monthlyRewardCredits: 0,
    monthlyRewardCap: REFERRAL_MONTHLY_REWARD_CAP_CREDITS,
    generationThreshold: REFERRAL_GENERATION_THRESHOLD,
    generationRewardCredits: REFERRAL_GENERATION_REWARD_CREDITS,
    paymentRewardCredits: REFERRAL_PAYMENT_REWARD_CREDITS,
    referredPaymentBonusCredits: REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    const summary = await getReferralSummary(supabase, session.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[referrals/me] summary fallback:", error);
    return NextResponse.json(fallback);
  }
}
