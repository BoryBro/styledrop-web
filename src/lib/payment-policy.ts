export const REFUND_UNIT_PRICE = 190;
export const REFUND_WINDOW_DAYS = 7;

export const PAYMENT_PACKAGES = {
  basic: { amount: 1900, credits: 10, name: "기본 크레딧 10회" },
  plus: { amount: 4900, credits: 30, name: "플러스 크레딧 30회" },
  pro: { amount: 9900, credits: 70, name: "프로 크레딧 70회" },
} as const;

export type PaymentPackageId = keyof typeof PAYMENT_PACKAGES;
export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export function isWithinRefundWindow(createdAt: string | null | undefined, now = new Date()) {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  return now.getTime() - created.getTime() <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function computeRefundBreakdown({
  paymentAmount,
  paymentCredits,
  remainingPaymentCredits,
}: {
  paymentAmount: number;
  paymentCredits: number;
  remainingPaymentCredits: number;
}) {
  const normalizedRemaining = Math.max(0, Math.min(remainingPaymentCredits, paymentCredits));
  const creditsToRemove = normalizedRemaining;
  const usedCredits = Math.max(0, paymentCredits - creditsToRemove);
  const deduction = usedCredits * REFUND_UNIT_PRICE;
  const refundAmount = Math.max(0, paymentAmount - deduction);
  const wasPartial = usedCredits > 0;

  return {
    creditsToRemove,
    usedCredits,
    deduction,
    refundAmount,
    wasPartial,
  };
}

export function getNetRevenueAmount(payment: {
  amount?: number | null;
  status?: string | null;
  refunded_amount?: number | null;
}) {
  const amount = Math.max(0, payment.amount ?? 0);
  const refundedAmount = Math.max(0, Math.min(payment.refunded_amount ?? 0, amount));
  const status = payment.status ?? "pending";

  if (status === "refunded") {
    return Math.max(0, amount - (refundedAmount || amount));
  }

  if (status === "partially_refunded") {
    return Math.max(0, amount - refundedAmount);
  }

  if (status === "paid") {
    return Math.max(0, amount - refundedAmount);
  }

  return 0;
}
