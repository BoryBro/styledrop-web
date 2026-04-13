import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { PAYMENT_PACKAGES, type PaymentPackageId } from "@/lib/payment-policy";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  return readSessionFromRequest(request);
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { packageId } = await request.json();
  const pkg = PAYMENT_PACKAGES[packageId as PaymentPackageId];
  if (!pkg) return NextResponse.json({ error: "유효하지 않은 패키지입니다." }, { status: 400 });

  const paymentId = `sd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return NextResponse.json({
    paymentId,
    amount: pkg.amount,
    credits: pkg.credits,
    orderName: pkg.name,
    userId: session.id,
    userName: session.nickname,
  });
}
