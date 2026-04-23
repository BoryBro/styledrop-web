import { NextRequest, NextResponse } from "next/server";
import {
  attachTravelParticipantUserId,
  buildTravelRoomView,
  getTravelRole,
  getTravelRoom,
  markTravelParticipantJoined,
} from "@/lib/travel-together-room.server";
import { readSessionFromRequest } from "@/lib/auth-session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const token = request.nextUrl.searchParams.get("token");
  const session = readSessionFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "token이 필요합니다." }, { status: 400 });
  }

  const { room, error } = await getTravelRoom(roomId);
  if (error || !room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  const role = getTravelRole(room, token);
  if (!role) {
    return NextResponse.json({ error: "입장 권한이 없습니다." }, { status: 403 });
  }

  let currentRoom = room;

  if (session?.id) {
    const attached = await attachTravelParticipantUserId(currentRoom, role, session.id);
    if (attached.error || !attached.room) {
      return NextResponse.json({ error: attached.error ?? "참여자 확인에 실패했습니다." }, { status: 403 });
    }
    currentRoom = attached.room;
  }

  const joined = await markTravelParticipantJoined(currentRoom, role);
  if (joined.error || !joined.room) {
    return NextResponse.json({ error: joined.error ?? "입장 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    view: buildTravelRoomView(joined.room, role),
  });
}
