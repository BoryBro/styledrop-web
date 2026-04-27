import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import { getCreditExpiryIso } from "@/lib/credits";
import { PAYMENT_PACKAGES, type PaymentPackageId } from "@/lib/payment-policy";
import { rewardReferralForFirstPayment } from "@/lib/referrals.server";
import nodemailer from "nodemailer";

async function sendPaymentAlert(userName: string, amount: number, credits: number) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: `[StyleDrop] 결제 완료 🎉 ${userName}`,
      text: `${userName}님이 ${amount.toLocaleString()}원 결제 완료!\n크레딧 ${credits}개 지급됨.`,
    });
  } catch {
    // 알림 실패는 결제 흐름에 영향 없음
  }
}

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  return readSessionFromRequest(request);
}

const VERIFY_RETRY_DELAYS_MS = [0, 800, 1600, 2400] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPortOnePayment(paymentId: string, secret: string) {
  let lastError:
    | {
        status: number;
        type?: string | null;
        message?: string | null;
      }
    | null = null;

  for (const delay of VERIFY_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await sleep(delay);
    }

    const verifyRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${secret}` },
      cache: "no-store",
    });

    const payload = await verifyRes.json().catch(() => null);

    if (verifyRes.ok && payload) {
      const status = payload?.status;
      if (status === "PAID") {
        return { ok: true as const, payment: payload };
      }

      lastError = {
        status: verifyRes.status,
        type: "PAYMENT_NOT_PAID",
        message: typeof status === "string" ? `payment status is ${status}` : "payment is not paid yet",
      };

      if (status === "READY" || status === "PENDING") {
        continue;
      }

      break;
    }

    const type = typeof payload?.type === "string" ? payload.type : null;
    const message = typeof payload?.message === "string" ? payload.message : null;

    lastError = {
      status: verifyRes.status,
      type,
      message,
    };

    const retryable =
      verifyRes.status === 404 ||
      verifyRes.status === 429 ||
      verifyRes.status >= 500 ||
      type === "PAYMENT_NOT_FOUND";

    if (!retryable) {
      break;
    }
  }

  return {
    ok: false as const,
    error: lastError ?? {
      status: 500,
      type: "UNKNOWN_PORTONE_VERIFY_ERROR",
      message: "unknown payment verification error",
    },
  };
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { paymentId, packageId } = await request.json();
  if (!paymentId || !packageId) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const pkg = PAYMENT_PACKAGES[packageId as PaymentPackageId];
  if (!pkg) return NextResponse.json({ error: "유효하지 않은 패키지" }, { status: 400 });

  // PortOne v2 결제 검증
  const secret = process.env.PORTONE_API_SECRET!;
  const verification = await verifyPortOnePayment(paymentId, secret);
  if (!verification.ok) {
    const isRetryable =
      verification.error.type === "PAYMENT_NOT_FOUND" ||
      verification.error.type === "PAYMENT_NOT_PAID";

    return NextResponse.json(
      {
        error: isRetryable
          ? "결제 승인 반영 중입니다. 잠시 후 다시 확인해 주세요."
          : `결제 검증 실패: ${verification.error.message ?? verification.error.type ?? verification.error.status}`,
        retryable: isRetryable,
      },
      { status: isRetryable ? 409 : 400 }
    );
  }

  const payment = verification.payment;

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

  const referralReward = await rewardReferralForFirstPayment(supabase, {
    referredUserId: session.id,
    paymentId,
  });

  sendPaymentAlert(session.nickname, pkg.amount, pkg.credits);

  return NextResponse.json({
    success: true,
    credits: pkg.credits + referralReward.referredBonusCredits,
    referralReward,
  });
}
