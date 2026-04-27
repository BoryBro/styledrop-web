import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  buildNaboRoomView,
  getNaboRoomBundleByCode,
  verifyNaboOwnerToken,
} from "@/lib/nabo-room.server";

type PremiumAccessRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: NextRequest, { params }: PremiumAccessRouteContext) {
  const session = readSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      { error: "카카오 로그인 후 이용할 수 있습니다." },
      { status: 401 },
    );
  }

  const { roomCode } = await params;
  const body = await request.json().catch(() => ({}));
  const ownerToken = String(body?.ownerToken ?? "").trim();

  if (!ownerToken) {
    return NextResponse.json({ error: "방장 토큰이 필요합니다." }, { status: 400 });
  }

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!verifyNaboOwnerToken(bundle.room, ownerToken)) {
    return NextResponse.json({ error: "결제 권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    chargedCredits: 0,
    message: "전체 결과는 이제 추가 크레딧 없이 응답 수에 따라 열립니다.",
    view: buildNaboRoomView({
      bundle,
      role: "owner",
      ownerToken,
    }),
  });
}
