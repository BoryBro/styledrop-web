import { NextRequest, NextResponse } from "next/server";
import {
  attachTravelParticipantUserId,
  buildTravelRoomView,
  getTravelRole,
  getTravelRoom,
  submitTravelAnswers,
} from "@/lib/travel-together-room.server";
import { readSessionFromRequest } from "@/lib/auth-session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const session = readSessionFromRequest(request);

  try {
    const body = await request.json();
    const token = String(body?.token ?? "");
    const answers = body?.answers;

    if (!token || !answers || typeof answers !== "object") {
      return NextResponse.json({ error: "응답 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const { room, error } = await getTravelRoom(roomId);
    if (error || !room) {
      return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    }

    const role = getTravelRole(room, token);
    if (!role) {
      return NextResponse.json({ error: "응답 권한이 없습니다." }, { status: 403 });
    }

    let currentRoom = room;

    if (session?.id) {
      const attached = await attachTravelParticipantUserId(currentRoom, role, session.id);
      if (attached.error || !attached.room) {
        return NextResponse.json({ error: attached.error ?? "참여자 확인에 실패했습니다." }, { status: 403 });
      }
      currentRoom = attached.room;
    }

    const submitted = await submitTravelAnswers({ room: currentRoom, role, answers });
    if (submitted.error || !submitted.room) {
      return NextResponse.json({ error: submitted.error ?? "응답 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      view: buildTravelRoomView(submitted.room, role),
    });
  } catch {
    return NextResponse.json({ error: "응답 저장에 실패했습니다." }, { status: 500 });
  }
}
