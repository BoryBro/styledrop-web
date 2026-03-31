import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const { password, paymentId } = await request.json();

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

  // PortOne v2 결제 취소
  const cancelRes = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "관리자 환불 처리" }),
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

  // 크레딧 차감 (구매한 크레딧만큼, 없으면 0으로)
  const { data: creditRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", payment.user_id)
    .single();

  const currentCredits = creditRow?.credits ?? 0;
  const newCredits = Math.max(0, currentCredits - payment.credits);
  await supabase
    .from("user_credits")
    .upsert({ user_id: payment.user_id, credits: newCredits }, { onConflict: "user_id" });

  return NextResponse.json({
    ok: true,
    refundedAmount: payment.amount,
    creditsDeducted: currentCredits - newCredits,
  });
}
