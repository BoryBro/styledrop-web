import { NextRequest, NextResponse } from "next/server";
import {
  buildNaboRoomView,
  getNaboRoomBundleByCode,
  verifyNaboOwnerToken,
  verifyNaboRespondentToken,
} from "@/lib/nabo-room.server";

type RoomRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function GET(request: NextRequest, { params }: RoomRouteContext) {
  const { roomCode } = await params;
  const ownerToken = request.nextUrl.searchParams.get("owner");
  const respondentToken = request.nextUrl.searchParams.get("token");

  if (!ownerToken && !respondentToken) {
    return NextResponse.json({ error: "접속 토큰이 필요합니다." }, { status: 400 });
  }

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (ownerToken) {
    if (!verifyNaboOwnerToken(bundle.room, ownerToken)) {
      return NextResponse.json({ error: "방 접근 권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      view: buildNaboRoomView({
        bundle,
        role: "owner",
        ownerToken,
      }),
    });
  }

  if (!respondentToken || !verifyNaboRespondentToken(bundle.room, respondentToken)) {
    return NextResponse.json({ error: "응답 권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    view: buildNaboRoomView({
      bundle,
      role: "respondent",
      respondentToken,
    }),
  });
}
