import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { buildNaboRoomView, createNaboRoom } from "@/lib/nabo-room.server";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import { loadNaboFeatureControl } from "@/lib/style-controls.server";

const NABO_ROOM_CREATE_CREDITS = 1;

export async function POST(request: NextRequest) {
  try {
    const control = await loadNaboFeatureControl();
    if (!control.is_visible || !control.is_enabled) {
      return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
    }

    const session = readSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: "카카오 로그인 후 이용할 수 있습니다." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const ownerName = String(body?.ownerName ?? body?.myName ?? "").trim();

    if (!ownerName) {
      return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
    }

    if (ownerName.length > 30) {
      return NextResponse.json({ error: "닉네임은 30자 이하로 입력해주세요." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    const { data: remainingCredits, error: deductError } = await supabase.rpc("deduct_credit", {
      p_user_id: session.id,
      p_amount: NABO_ROOM_CREATE_CREDITS,
    });

    if (deductError || remainingCredits === null || remainingCredits === undefined) {
      return NextResponse.json(
        { error: "내가 보는 너 링크를 만들려면 1크레딧이 필요해요." },
        { status: 429 },
      );
    }

    const created = await createNaboRoom({
      ownerName,
      ownerUserId: session.id,
    }, supabase);

    if (created.error || !created.room || !created.ownerToken || !created.respondentToken) {
      await addCreditsWithPolicy(supabase, {
        userId: session.id,
        credits: NABO_ROOM_CREATE_CREDITS,
        sourceType: "refund",
        sourceId: `nabo-room-create-refund:${session.id}:${Date.now()}`,
      }).catch(() => undefined);

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
      chargedCredits: NABO_ROOM_CREATE_CREDITS,
      remainingCredits,
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
