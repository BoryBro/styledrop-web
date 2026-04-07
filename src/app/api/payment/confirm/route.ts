import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import { getCreditExpiryIso } from "@/lib/credits";

const PACKAGES: Record<string, { amount: number; credits: number }> = {
  basic:  { amount: 1900, credits: 10 },
  plus:   { amount: 4900, credits: 30 },
  pro:    { amount: 9900, credits: 70 },
};

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { paymentId, packageId } = await request.json();
  if (!paymentId || !packageId) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const pkg = PACKAGES[packageId];
  if (!pkg) return NextResponse.json({ error: "유효하지 않은 패키지" }, { status: 400 });

  // PortOne v2 결제 검증
  const secret = process.env.PORTONE_API_SECRET!;
  const verifyRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
  });

  if (!verifyRes.ok) {
    return NextResponse.json({ error: "결제 검증 실패" }, { status: 400 });
  }

  const payment = await verifyRes.json();

  // 금액 위변조 검증
  if (payment.status !== "PAID" || payment.amount.total !== pkg.amount) {
    return NextResponse.json({ error: "결제 금액 불일치" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 중복 처리 방지
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("id", paymentId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "이미 처리된 결제입니다." }, { status: 409 });
  }

  // 결제 내역 저장
  await supabase.from("payments").insert({
    id: paymentId,
    user_id: session.id,
    amount: pkg.amount,
    credits: pkg.credits,
    status: "paid",
    pg_provider: payment.channel?.pgProvider ?? null,
  });

  // 크레딧 적립 (결제일로부터 1년)
  const addRes = await addCreditsWithPolicy(supabase, {
    userId: session.id,
    credits: pkg.credits,
    sourceType: "payment",
    sourceId: paymentId,
    expiresAt: getCreditExpiryIso(),
  });

  if (!addRes.ok) {
    return NextResponse.json({ error: addRes.error?.message ?? "크레딧 적립 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true, credits: pkg.credits });
}
