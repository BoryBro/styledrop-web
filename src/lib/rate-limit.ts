export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
export const GUEST_LIMIT = 3;
export const USER_LIMIT = 10;
export const WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간

export function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function getRemainingCount(key: string, limit: number): number {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) return limit;
  return Math.max(0, limit - entry.count);
}
