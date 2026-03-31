import { NextRequest, NextResponse } from "next/server";

const PACKAGES: Record<string, { amount: number; credits: number; name: string }> = {
  basic:  { amount: 1900, credits: 10, name: "기본 크레딧 10회" },
  plus:   { amount: 4900, credits: 30, name: "플러스 크레딧 30회" },
  pro:    { amount: 9900, credits: 70, name: "프로 크레딧 70회" },
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

  const { packageId } = await request.json();
  const pkg = PACKAGES[packageId];
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
