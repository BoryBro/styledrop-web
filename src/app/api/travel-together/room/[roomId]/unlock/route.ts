import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import {
  attachTravelParticipantUserId,
  buildTravelRoomView,
  getTravelRole,
  getTravelRoom,
  unlockTravelRoom,
} from "@/lib/travel-together-room.server";

const DETAIL_UNLOCK_CREDITS = 2;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "상세 결과 결제는 로그인 회원만 가능합니다." },
      { status: 401 },
    );
  }

  const { roomId } = await context.params;

  try {
    const body = await request.json();
    const token = String(body?.token ?? "");

    if (!token) {
      return NextResponse.json({ error: "token이 필요합니다." }, { status: 400 });
    }

    const { room, error } = await getTravelRoom(roomId);
    if (error || !room) {
      return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    }

    const role = getTravelRole(room, token);
    if (!role) {
      return NextResponse.json({ error: "결제 권한이 없습니다." }, { status: 403 });
    }

    const attached = await attachTravelParticipantUserId(room, role, session.id);
    if (attached.error || !attached.room) {
      return NextResponse.json(
        { error: attached.error ?? "참여자 확인에 실패했습니다." },
        { status: 403 },
      );
    }

    if (attached.room.unlockedAt) {
      return NextResponse.json({
        ok: true,
        view: buildTravelRoomView(attached.room, role),
        chargedCredits: 0,
      });
    }

    const supabase = getSupabase();
    const { data: remainingCredits, error: deductError } = await supabase.rpc(
      "deduct_credit",
      {
        p_user_id: session.id,
        p_amount: DETAIL_UNLOCK_CREDITS,
      },
    );

    if (deductError || remainingCredits === null || remainingCredits === undefined) {
      return NextResponse.json(
        { error: "크레딧이 부족합니다. 2크레딧 충전 후 다시 시도해주세요." },
        { status: 429 },
      );
    }

    const unlocked = await unlockTravelRoom(
      attached.room,
      session.id,
      DETAIL_UNLOCK_CREDITS,
    );

    if (unlocked.error || !unlocked.room) {
      await addCreditsWithPolicy(supabase, {
        userId: session.id,
        credits: DETAIL_UNLOCK_CREDITS,
        sourceType: "refund",
        sourceId: `travel-together-unlock-refund:${roomId}:${session.id}`,
      }).catch(() => undefined);

      return NextResponse.json(
        { error: unlocked.error ?? "상세 결과 결제 처리에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      view: buildTravelRoomView(unlocked.room, role),
      chargedCredits: DETAIL_UNLOCK_CREDITS,
    });
  } catch {
    return NextResponse.json(
      { error: "상세 결과 결제 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
