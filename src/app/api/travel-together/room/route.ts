import { NextRequest, NextResponse } from "next/server";
import {
  buildTravelInvitePath,
  buildTravelRoomView,
  createTravelRoom,
} from "@/lib/travel-together-room.server";
import { readSessionFromRequest } from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  try {
    const session = readSessionFromRequest(request);
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
    }, session?.id ?? null);

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
