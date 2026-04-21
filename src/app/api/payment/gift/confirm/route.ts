import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { PAYMENT_PACKAGES, type PaymentPackageId } from "@/lib/payment-policy";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  return readSessionFromRequest(request);
}

function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GIFT-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const VERIFY_RETRY_DELAYS_MS = [0, 800, 1600, 2400] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPortOnePayment(paymentId: string, secret: string) {
  let lastError: { status: number; type?: string | null; message?: string | null } | null = null;

  for (const delay of VERIFY_RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);

    const verifyRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${secret}` },
      cache: "no-store",
    });

    const payload = await verifyRes.json().catch(() => null);

    if (verifyRes.ok && payload) {
      const status = payload?.status;
      if (status === "PAID") return { ok: true as const, payment: payload };
      lastError = { status: verifyRes.status, type: "PAYMENT_NOT_PAID", message: `payment status is ${status}` };
      if (status === "READY" || status === "PENDING") continue;
      break;
    }

    lastError = {
      status: verifyRes.status,
      type: typeof payload?.type === "string" ? payload.type : null,
      message: typeof payload?.message === "string" ? payload.message : null,
    };

    const retryable = verifyRes.status === 404 || verifyRes.status === 429 || verifyRes.status >= 500 || lastError.type === "PAYMENT_NOT_FOUND";
    if (!retryable) break;
  }

  return { ok: false as const, error: lastError ?? { status: 500, type: "UNKNOWN", message: "unknown error" } };
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { paymentId, packageId } = await request.json();
  if (!paymentId || !packageId) return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });

  const pkg = PAYMENT_PACKAGES[packageId as PaymentPackageId];
  if (!pkg) return NextResponse.json({ error: "유효하지 않은 패키지" }, { status: 400 });

  const secret = process.env.PORTONE_API_SECRET!;
  const verification = await verifyPortOnePayment(paymentId, secret);
  if (!verification.ok) {
    const isRetryable = verification.error.type === "PAYMENT_NOT_FOUND" || verification.error.type === "PAYMENT_NOT_PAID";
    return NextResponse.json(
      { error: isRetryable ? "결제 승인 반영 중입니다. 잠시 후 다시 확인해 주세요." : `결제 검증 실패: ${verification.error.message}`, retryable: isRetryable },
      { status: isRetryable ? 409 : 400 }
    );
  }

  const payment = verification.payment;
  if (payment.status !== "PAID" || payment.amount.total !== pkg.amount) {
    return NextResponse.json({ error: "결제 금액 불일치" }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: existing } = await supabase.from("payments").select("id").eq("id", paymentId).single();
  if (existing) return NextResponse.json({ error: "이미 처리된 결제입니다." }, { status: 409 });

  // 결제 내역 저장
  await supabase.from("payments").insert({
    id: paymentId,
    user_id: session.id,
    amount: pkg.amount,
    credits: pkg.credits,
    status: "paid",
    pg_provider: payment.channel?.pgProvider ?? null,
  });

  // 고유한 선물 코드 생성
  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = generateGiftCode();
    const { data: dup } = await supabase.from("gift_codes").select("code").eq("code", candidate).maybeSingle();
    if (!dup) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ error: "코드 생성 실패" }, { status: 500 });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30일

  await supabase.from("gift_codes").insert({
    code,
    credits: pkg.credits,
    amount: pkg.amount,
    status: "unused",
    created_by: session.id,
    expires_at: expiresAt,
  });

  return NextResponse.json({ success: true, code, credits: pkg.credits, expiresAt });
}
