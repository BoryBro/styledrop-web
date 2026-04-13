import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailableCredits, getPaymentLotRemainingCredits } from "@/lib/credits.server";
import {
  computeRefundBreakdown,
  isWithinRefundWindow,
  REFUND_UNIT_PRICE,
  REFUND_WINDOW_DAYS,
} from "@/lib/payment-policy";

export async function POST(request: NextRequest) {
  const { password, paymentId, dryRun } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 결제 정보 조회
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();

  if (payErr || !payment) {
    return NextResponse.json({ error: "결제 정보를 찾을 수 없습니다." }, { status: 404 });
  }
  const hasRefundSchema = Object.prototype.hasOwnProperty.call(payment, "refunded_amount");
  if (!hasRefundSchema) {
    return NextResponse.json(
      { error: "환불 스키마가 아직 적용되지 않았습니다. DB에 payment_refunds.sql을 먼저 반영해야 합니다." },
      { status: 503 }
    );
  }
  if (payment.status === "refunded" || payment.status === "partially_refunded") {
    return NextResponse.json({ error: "이미 환불된 결제입니다." }, { status: 409 });
  }
  if (payment.status !== "paid") {
    return NextResponse.json({ error: "환불 가능한 paid 결제가 아닙니다." }, { status: 409 });
  }
  if (!isWithinRefundWindow(payment.created_at)) {
    return NextResponse.json(
      { error: `결제 후 ${REFUND_WINDOW_DAYS}일이 지나 자동 환불 가능 기간이 만료되었습니다.` },
      { status: 400 }
    );
  }

  const paymentLot = await getPaymentLotRemainingCredits(supabase, payment.id);
  if (!paymentLot) {
    return NextResponse.json(
      { error: "이 결제의 크레딧 lot를 찾지 못했습니다. 수동 확인이 필요합니다." },
      { status: 409 }
    );
  }

  const { creditsToRemove, usedCredits, deduction, refundAmount, wasPartial } = computeRefundBreakdown({
    paymentAmount: payment.amount ?? 0,
    paymentCredits: payment.credits ?? 0,
    remainingPaymentCredits: paymentLot.remainingCredits,
  });

  // dryRun: 환불 금액 미리보기만 반환
  if (dryRun) {
    return NextResponse.json({
      refundAmount,
      usedCredits,
      creditsToRemove,
      wasPartial,
      canRefund: refundAmount > 0,
    });
  }

  // 환불 불가 케이스
  if (refundAmount <= 0) {
    return NextResponse.json(
      { error: `사용 크레딧(${usedCredits}회 × ${REFUND_UNIT_PRICE}원 = ${deduction.toLocaleString()}원) 공제 후 환불 가능 금액이 없습니다.` },
      { status: 400 }
    );
  }

  // ── PortOne v2 결제 취소 (부분/전액) ──────────────────────────────────
  const refundStatus = wasPartial ? "partially_refunded" : "refunded";
  const refundReason = wasPartial
    ? `부분환불: 사용 ${usedCredits}회 × ${REFUND_UNIT_PRICE}원 공제`
    : "관리자 전액 환불 처리";
  const refundedAt = new Date().toISOString();
  const cancelBody: Record<string, unknown> = {
    reason: refundReason,
  };
  // 부분 환불 시 amount 전달
  if (wasPartial) {
    cancelBody.amount = refundAmount;
  }

  const cancelRes = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cancelBody),
    }
  );

  if (!cancelRes.ok) {
    const err = await cancelRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: `PortOne 취소 실패: ${err?.message ?? cancelRes.status}` },
      { status: 400 }
    );
  }

  const finalizeRefund = await supabase.rpc("apply_payment_refund", {
    p_payment_id: paymentId,
    p_refund_amount: refundAmount,
    p_credits_to_remove: creditsToRemove,
    p_payment_lot_id: paymentLot.lotId,
    p_refund_type: refundStatus,
    p_refund_reason: refundReason,
    p_refunded_at: refundedAt,
  });

  if (finalizeRefund.error) {
    const paymentsUpdate = await supabase
      .from("payments")
      .update({
        status: refundStatus,
        refunded_amount: refundAmount,
        refunded_at: refundedAt,
        refund_type: refundStatus,
        refund_reason: refundReason,
      })
      .eq("id", paymentId)
      .eq("status", payment.status)
      .select("id")
      .maybeSingle();

    if (paymentsUpdate.error || !paymentsUpdate.data) {
      return NextResponse.json(
        { error: "PortOne 환불은 완료됐지만 내부 결제 상태 반영에 실패했습니다. 즉시 확인이 필요합니다." },
        { status: 500 }
      );
    }

    const lotUpdate = await supabase
      .from("credit_lots")
      .update({
        remaining_credits: Math.max(0, paymentLot.remainingCredits - creditsToRemove),
        updated_at: refundedAt,
      })
      .eq("id", paymentLot.lotId)
      .eq("remaining_credits", paymentLot.remainingCredits)
      .select("id")
      .maybeSingle();

    if (lotUpdate.error || !lotUpdate.data) {
      return NextResponse.json(
        { error: "PortOne 환불은 완료됐지만 크레딧 lot 차감 반영에 실패했습니다. 즉시 확인이 필요합니다." },
        { status: 500 }
      );
    }
  }

  const newCredits = await getAvailableCredits(supabase, payment.user_id);

  return NextResponse.json({
    ok: true,
    refundedAmount: refundAmount,
    creditsDeducted: creditsToRemove,
    usedCredits,
    wasPartial,
    remainingCredits: newCredits,
    refundStatus,
  });
}
