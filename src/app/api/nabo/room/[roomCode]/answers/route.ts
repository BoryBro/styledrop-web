import { NextRequest, NextResponse } from "next/server";
import { getNaboRoomBundleByCode, verifyNaboOwnerToken } from "@/lib/nabo-room.server";

type RouteContext = { params: Promise<{ roomCode: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { roomCode } = await params;
  const ownerToken = request.nextUrl.searchParams.get("owner");

  if (!ownerToken) {
    return NextResponse.json({ error: "오너 토큰이 필요합니다." }, { status: 400 });
  }

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!verifyNaboOwnerToken(bundle.room, ownerToken)) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  if (!bundle.room.premium_access_at) {
    return NextResponse.json({ error: "전체 결과를 열어야 답변을 확인할 수 있습니다." }, { status: 403 });
  }

  const answers = bundle.responses.map((r) => r.answers);

  return NextResponse.json({ ok: true, answers });
}
