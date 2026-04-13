import { NextRequest, NextResponse } from "next/server";
import { PAYMENT_PACKAGES, type PaymentPackageId } from "@/lib/payment-policy";

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
