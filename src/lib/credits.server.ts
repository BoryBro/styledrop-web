import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreditExpiryIso } from "@/lib/credits";

type CreditSourceType =
  | "payment"
  | "reward"
  | "signup_bonus"
  | "referral_reward"
  | "reviewer"
  | "manual";

export async function getAvailableCredits(supabase: SupabaseClient, userId: string) {
  const rpcRes = await supabase.rpc("get_available_credits", { p_user_id: userId });

  if (!rpcRes.error && typeof rpcRes.data === "number") {
    return rpcRes.data;
  }

  const fallbackRes = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .single();

  return fallbackRes.data?.credits ?? 0;
}

export async function addCreditsWithPolicy(
  supabase: SupabaseClient,
  {
    userId,
    credits,
    sourceType = "manual",
    sourceId = null,
    expiresAt = getCreditExpiryIso(),
  }: {
    userId: string;
    credits: number;
    sourceType?: CreditSourceType;
    sourceId?: string | null;
    expiresAt?: string;
  }
) {
  const nextRes = await supabase.rpc("add_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_expires_at: expiresAt,
    p_source_type: sourceType,
    p_source_id: sourceId,
  });

  if (!nextRes.error) {
    return { ok: true, usedLegacy: false as const };
  }

  const legacyRes = await supabase.rpc("add_credits", {
    p_user_id: userId,
    p_credits: credits,
  });

  return {
    ok: !legacyRes.error,
    usedLegacy: true as const,
    error: legacyRes.error ?? nextRes.error,
  };
}

export async function setCreditBalanceWithPolicy(
  supabase: SupabaseClient,
  {
    userId,
    credits,
    expiresAt = getCreditExpiryIso(),
  }: {
    userId: string;
    credits: number;
    expiresAt?: string;
  }
) {
  const nextRes = await supabase.rpc("set_credit_balance", {
    p_user_id: userId,
    p_credits: credits,
    p_expires_at: expiresAt,
  });

  if (!nextRes.error) {
    return { ok: true, usedLegacy: false as const };
  }

  const legacyRes = await supabase
    .from("user_credits")
    .upsert({ user_id: userId, credits }, { onConflict: "user_id" });

  return {
    ok: !legacyRes.error,
    usedLegacy: true as const,
    error: legacyRes.error ?? nextRes.error,
  };
}

export async function getPaymentLotRemainingCredits(supabase: SupabaseClient, paymentId: string) {
  const lotRes = await supabase
    .from("credit_lots")
    .select("id, remaining_credits")
    .eq("source_type", "payment")
    .eq("source_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lotRes.error || !lotRes.data) {
    return null;
  }

  return {
    lotId: lotRes.data.id,
    remainingCredits: lotRes.data.remaining_credits ?? 0,
  };
}
