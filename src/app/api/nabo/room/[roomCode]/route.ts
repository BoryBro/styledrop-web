import { NextRequest, NextResponse } from "next/server";
import {
  buildNaboRoomView,
  getNaboRoomBundleByCode,
  verifyNaboOwnerToken,
  verifyNaboRespondentToken,
} from "@/lib/nabo-room.server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { loadNaboFeatureControl } from "@/lib/style-controls.server";

type RoomRouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function GET(request: NextRequest, { params }: RoomRouteContext) {
  const control = await loadNaboFeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const { roomCode } = await params;
  const ownerToken = request.nextUrl.searchParams.get("owner");
  const respondentToken = request.nextUrl.searchParams.get("token");
  const session = readSessionFromRequest(request);

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  const isSessionOwner = Boolean(session && bundle.room.owner_user_id === session.id);

  if (!ownerToken && !respondentToken) {
    if (!isSessionOwner) {
      return NextResponse.json({ error: "접속 권한이 필요합니다." }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      view: buildNaboRoomView({
        bundle,
        role: "owner",
      }),
    });
  }

  if (ownerToken) {
    if (!verifyNaboOwnerToken(bundle.room, ownerToken)) {
      return NextResponse.json({ error: "방 접근 권한이 없습니다." }, { status: 403 });
    }
    if (bundle.room.owner_user_id && !isSessionOwner) {
      return NextResponse.json({ error: "방을 만든 계정으로만 확인할 수 있습니다." }, { status: 403 });
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
  if (session && bundle.room.owner_user_id === session.id) {
    return NextResponse.json({ error: "방을 만든 계정으로는 응답할 수 없습니다." }, { status: 403 });
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
