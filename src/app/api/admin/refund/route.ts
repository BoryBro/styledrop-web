import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UNIT_PRICE = 190; // 기본 패키지 정가 단가 (원/회)

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
    .select("id, user_id, amount, credits, status")
    .eq("id", paymentId)
    .single();

  if (payErr || !payment) {
    return NextResponse.json({ error: "결제 정보를 찾을 수 없습니다." }, { status: 404 });
  }
  if (payment.status === "refunded") {
    return NextResponse.json({ error: "이미 환불된 결제입니다." }, { status: 409 });
  }

  // 현재 유저 크레딧 조회
  const { data: creditRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", payment.user_id)
    .single();

  const currentCredits = creditRow?.credits ?? 0;

  // ── 부분 환불 계산 ──────────────────────────────────────────────────
  // creditsToRemove: 실제로 회수 가능한 크레딧 (현재 잔액 or 구매수량 중 작은 값)
  // usedCredits: 이미 사용되어 회수 불가능한 크레딧
  const creditsToRemove = Math.min(currentCredits, payment.credits);
  const usedCredits = payment.credits - creditsToRemove;
  const deduction = usedCredits * UNIT_PRICE;
  const refundAmount = Math.max(0, payment.amount - deduction);
  const wasPartial = usedCredits > 0;

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
      { error: `사용 크레딧(${usedCredits}회 × ${UNIT_PRICE}원 = ${deduction.toLocaleString()}원) 공제 후 환불 가능 금액이 없습니다.` },
      { status: 400 }
    );
  }

  // ── PortOne v2 결제 취소 (부분/전액) ──────────────────────────────────
  const cancelBody: Record<string, unknown> = {
    reason: wasPartial
      ? `부분환불: 사용 ${usedCredits}회 × ${UNIT_PRICE}원 공제`
      : "관리자 전액 환불 처리",
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

  // payments 상태 → refunded
  await supabase
    .from("payments")
    .update({ status: "refunded" })
    .eq("id", paymentId);

  // 크레딧 차감
  const newCredits = Math.max(0, currentCredits - creditsToRemove);
  await supabase
    .from("user_credits")
    .upsert({ user_id: payment.user_id, credits: newCredits }, { onConflict: "user_id" });

  return NextResponse.json({
    ok: true,
    refundedAmount: refundAmount,
    creditsDeducted: creditsToRemove,
    usedCredits,
    wasPartial,
  });
}
