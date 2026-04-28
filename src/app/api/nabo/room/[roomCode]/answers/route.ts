import { NextRequest, NextResponse } from "next/server";
import {
  getNaboRoomBundleByCode,
  NABO_BASIC_RESULT_COUNT,
  NABO_FULL_RESULT_COUNT,
  type NaboAnswerMap,
  verifyNaboOwnerToken,
} from "@/lib/nabo-room.server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { loadNaboFeatureControl } from "@/lib/style-controls.server";

type RouteContext = { params: Promise<{ roomCode: string }> };
const TEXT_QUESTION_IDS = new Set(["q2", "q4", "q8"]);

function toBasicAnswers(answers: NaboAnswerMap) {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => !TEXT_QUESTION_IDS.has(key)),
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const control = await loadNaboFeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const { roomCode } = await params;
  const ownerToken = request.nextUrl.searchParams.get("owner");
  const session = readSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 확인할 수 있습니다." }, { status: 401 });
  }

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  const isSessionOwner = Boolean(bundle.room.owner_user_id && bundle.room.owner_user_id === session.id);
  if (ownerToken && !verifyNaboOwnerToken(bundle.room, ownerToken)) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }
  if (!ownerToken && !isSessionOwner) {
    return NextResponse.json({ error: "오너 권한이 필요합니다." }, { status: 403 });
  }
  if (bundle.room.owner_user_id && !isSessionOwner) {
    return NextResponse.json({ error: "방을 만든 계정으로만 확인할 수 있습니다." }, { status: 403 });
  }

  const responseCount = bundle.responses.length;
  const hasEarlyAccess = Boolean(bundle.room.premium_access_at);

  if (responseCount < 1 || (responseCount < NABO_BASIC_RESULT_COUNT && !hasEarlyAccess)) {
    return NextResponse.json(
      { error: "기본 결과는 3명 이상 응답하거나 2크레딧으로 먼저 열 수 있습니다." },
      { status: 403 },
    );
  }

  const full = hasEarlyAccess || responseCount >= NABO_FULL_RESULT_COUNT;
  const answers = bundle.responses.map((r) => full ? r.answers : toBasicAnswers(r.answers));

  return NextResponse.json({
    ok: true,
    level: full ? "full" : "basic",
    responseCount,
    answers,
  });
}
