import { CREDIT_VALIDITY_DAYS, getCreditExpiryIso } from "@/lib/credits";

export const REFERRAL_QUERY_PARAM = "ref";
export const REFERRAL_STORAGE_KEY = "sd_referral_code";
export const REFERRAL_GENERATION_THRESHOLD = 3;
export const REFERRAL_GENERATION_REWARD_CREDITS = 1;
export const REFERRAL_PAYMENT_REWARD_CREDITS = 2;
export const REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS = 1;
export const REFERRAL_MONTHLY_REWARD_CAP_CREDITS = 10;
export const REFERRAL_REWARD_VALID_DAYS = CREDIT_VALIDITY_DAYS;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeReferralCode(value: string | null | undefined) {
  const code = value?.trim();
  if (!code || !UUID_PATTERN.test(code)) return null;
  return code.toLowerCase();
}

export function getStoredReferralCode() {
  if (typeof window === "undefined") return null;
  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeReferralCode(code: string | null | undefined) {
  if (typeof window === "undefined") return null;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
  } catch {
    return null;
  }

  return normalized;
}

export function storeReferralCodeFromCurrentUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return storeReferralCode(params.get(REFERRAL_QUERY_PARAM));
}

export function buildKakaoLoginUrlWithReferral() {
  const code = getStoredReferralCode();
  if (!code) return "/api/auth/kakao";

  const params = new URLSearchParams({ [REFERRAL_QUERY_PARAM]: code });
  return `/api/auth/kakao?${params.toString()}`;
}

export function buildReferralShareUrl(link: string, referrerCode: string | null | undefined) {
  const code = normalizeReferralCode(referrerCode);
  if (!code) return link;

  try {
    const url = new URL(link, typeof window === "undefined" ? "https://www.styledrop.cloud" : window.location.origin);
    url.searchParams.set(REFERRAL_QUERY_PARAM, code);
    return url.toString();
  } catch {
    const joiner = link.includes("?") ? "&" : "?";
    return `${link}${joiner}${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`;
  }
}

export function getReferralRewardExpiryIso(base = new Date()) {
  return getCreditExpiryIso(base);
}
