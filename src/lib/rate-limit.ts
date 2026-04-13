import { decodeSignedState, encodeSignedState } from "@/lib/signed-state";

export const GUEST_LIMIT = 1;
export const WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간

export const GUEST_COOKIE = "sd_guest_cnt";

export type LimitData = { count: number; resetAt: number };

export function parseLimitCookie(value: string | undefined): LimitData | null {
  const data = decodeSignedState<LimitData>(value);
  if (!data) return null;

  if (!Number.isFinite(data.count) || !Number.isFinite(data.resetAt)) {
    return null;
  }

  return data;
}

export function encodeLimitCookie(data: LimitData): string {
  return encodeSignedState(data);
}

export function getRemaining(cookieValue: string | undefined, limit: number): number {
  const data = parseLimitCookie(cookieValue);
  if (!data || Date.now() > data.resetAt) return limit;
  return Math.max(0, limit - data.count);
}
