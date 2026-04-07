export const CREDIT_VALIDITY_DAYS = 365;
export const CREDIT_VALIDITY_TEXT = "충전일로부터 1년";

export function getCreditExpiryDate(base = new Date()) {
  const expiresAt = new Date(base);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return expiresAt;
}

export function getCreditExpiryIso(base = new Date()) {
  return getCreditExpiryDate(base).toISOString();
}
