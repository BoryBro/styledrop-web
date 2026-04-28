import { NextRequest, NextResponse } from "next/server";
import {
  buildTravelInvitePath,
  buildTravelRoomView,
  createTravelRoom,
} from "@/lib/travel-together-room.server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { loadTravelTogetherFeatureControl } from "@/lib/style-controls.server";

export async function POST(request: NextRequest) {
  try {
    const control = await loadTravelTogetherFeatureControl();
    if (!control.is_visible || !control.is_enabled) {
      return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
    }

    const session = readSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
    }

    const body = await request.json();
    const myName = String(body?.myName ?? "").trim();
    const partnerName = String(body?.partnerName ?? "").trim();
    const relation = body?.relation;

    if (!myName || !partnerName) {
      return NextResponse.json({ error: "이름이 필요합니다." }, { status: 400 });
    }

    if (!["friend", "lover", "family", "coworker"].includes(String(relation))) {
      return NextResponse.json({ error: "관계 설정이 올바르지 않습니다." }, { status: 400 });
    }

    const { room, error } = await createTravelRoom({
      myName,
      partnerName,
      relation,
    }, session.id);

    if (error || !room) {
      return NextResponse.json({ error: error ?? "방을 만들지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      participantToken: room.host.token,
      view: buildTravelRoomView(room, "host"),
      invitePath: buildTravelInvitePath(room),
    });
  } catch {
    return NextResponse.json({ error: "방 생성에 실패했습니다." }, { status: 500 });
  }
}
