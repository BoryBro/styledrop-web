import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { buildNaboRoomView, createNaboRoom } from "@/lib/nabo-room.server";
import { loadNaboFeatureControl } from "@/lib/style-controls.server";

export async function POST(request: NextRequest) {
  try {
    const control = await loadNaboFeatureControl();
    if (!control.is_visible || !control.is_enabled) {
      return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
    }

    const session = readSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const ownerName = String(body?.ownerName ?? body?.myName ?? "").trim();

    if (!ownerName) {
      return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
    }

    if (ownerName.length > 30) {
      return NextResponse.json({ error: "닉네임은 30자 이하로 입력해주세요." }, { status: 400 });
    }

    const created = await createNaboRoom({
      ownerName,
      ownerUserId: session?.id ?? null,
    });

    if (created.error || !created.room || !created.ownerToken || !created.respondentToken) {
      return NextResponse.json(
        { error: created.error ?? "방을 만들지 못했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      roomCode: created.room.room_code,
      ownerToken: created.ownerToken,
      ownerPath: created.ownerPath,
      invitePath: created.invitePath,
      view: buildNaboRoomView({
        bundle: { room: created.room, responses: [] },
        role: "owner",
        ownerToken: created.ownerToken,
        respondentToken: created.respondentToken,
      }),
    });
  } catch {
    return NextResponse.json({ error: "방 생성에 실패했습니다." }, { status: 500 });
  }
}
