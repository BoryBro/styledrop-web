export const GUEST_LIMIT = 1;
export const WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간

export const GUEST_COOKIE = "sd_guest_cnt";

export type LimitData = { count: number; resetAt: number };

export function parseLimitCookie(value: string | undefined): LimitData | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString());
  } catch { return null; }
}

export function encodeLimitCookie(data: LimitData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function getRemaining(cookieValue: string | undefined, limit: number): number {
  const data = parseLimitCookie(cookieValue);
  if (!data || Date.now() > data.resetAt) return limit;
  return Math.max(0, limit - data.count);
}
