import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getAvailableCredits } from "@/lib/credits.server";
import { loadAuditionFeatureControl } from "@/lib/style-controls.server";
import { buildDuoRoomHref, DUO_AUDITION_CREDIT_COST } from "@/lib/audition-duo";
import { insertDuoRoom } from "@/lib/audition-duo.server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_visible || !auditionControl.is_enabled) {
    return NextResponse.json({ error: "AI 오디션이 현재 비공개 상태입니다." }, { status: 503 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = getSupabase();
  const credits = await getAvailableCredits(supabase, session.id);
  if (credits < DUO_AUDITION_CREDIT_COST) {
    return NextResponse.json(
      { error: `친구랑 함께하기는 ${DUO_AUDITION_CREDIT_COST}크레딧이 필요합니다.` },
      { status: 429 }
    );
  }

  const { room, error } = await insertDuoRoom({
    host: {
      userId: session.id,
      nickname: session.nickname,
      profileImage: session.profileImage,
      joinedAt: new Date().toISOString(),
    },
    supabase,
  });

  if (error || !room) {
    return NextResponse.json({ error: error ?? "방을 만들지 못했습니다." }, { status: 500 });
  }

  await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "audition_duo_room_created",
    metadata: {
      room_id: room.roomId,
      invite_code: room.inviteCode,
    },
  });

  return NextResponse.json({
    ok: true,
    room,
    href: buildDuoRoomHref(room.roomId),
  });
}
