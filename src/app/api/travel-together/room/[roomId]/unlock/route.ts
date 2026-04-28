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
import { loadTravelTogetherFeatureControl } from "@/lib/style-controls.server";

const DETAIL_UNLOCK_CREDITS = 1;

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
  const control = await loadTravelTogetherFeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "상세 결과 결제는 카카오 로그인 후 가능합니다." },
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
      return NextResponse.json({ error: "상세 결과를 볼 권한이 없습니다." }, { status: 403 });
    }

    if (role !== "host") {
      return NextResponse.json(
        { error: "상세 결과는 방을 만든 사람만 1크레딧으로 열 수 있습니다." },
        { status: 403 },
      );
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
      const latest = await getTravelRoom(roomId);
      if (latest.room?.unlockedAt) {
        return NextResponse.json({
          ok: true,
          view: buildTravelRoomView(latest.room, role),
          chargedCredits: 0,
        });
      }

      return NextResponse.json(
        { error: "크레딧이 부족합니다. 1크레딧 충전 후 다시 시도해주세요." },
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
        { error: unlocked.error ?? "상세 결과를 열지 못했습니다." },
        { status: 500 },
      );
    }

    if (!unlocked.didUnlock) {
      await addCreditsWithPolicy(supabase, {
        userId: session.id,
        credits: DETAIL_UNLOCK_CREDITS,
        sourceType: "refund",
        sourceId: `travel-together-unlock-race-refund:${roomId}:${session.id}:${Date.now()}`,
      }).catch(() => undefined);

      return NextResponse.json({
        ok: true,
        view: buildTravelRoomView(unlocked.room, role),
        chargedCredits: 0,
        refundedCredits: DETAIL_UNLOCK_CREDITS,
      });
    }

    return NextResponse.json({
      ok: true,
      view: buildTravelRoomView(unlocked.room, role),
      chargedCredits: DETAIL_UNLOCK_CREDITS,
      remainingCredits,
    });
  } catch {
    return NextResponse.json(
      { error: "상세 결과를 열지 못했습니다." },
      { status: 500 },
    );
  }
}
