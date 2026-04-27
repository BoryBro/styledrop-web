import { NextRequest, NextResponse } from "next/server";
import {
  getNaboRoomBundleByCode,
  NABO_BASIC_RESULT_COUNT,
  NABO_FULL_RESULT_COUNT,
  type NaboAnswerMap,
  verifyNaboOwnerToken,
} from "@/lib/nabo-room.server";

type RouteContext = { params: Promise<{ roomCode: string }> };
const TEXT_QUESTION_IDS = new Set(["q2", "q4", "q8"]);

function toBasicAnswers(answers: NaboAnswerMap) {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => !TEXT_QUESTION_IDS.has(key)),
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { roomCode } = await params;
  const ownerToken = request.nextUrl.searchParams.get("owner");

  if (!ownerToken) {
    return NextResponse.json({ error: "오너 토큰이 필요합니다." }, { status: 400 });
  }

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!verifyNaboOwnerToken(bundle.room, ownerToken)) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const responseCount = bundle.responses.length;
  const resultAvailableTime = new Date(bundle.room.result_available_after).getTime();

  if (responseCount < NABO_BASIC_RESULT_COUNT) {
    return NextResponse.json(
      { error: "기본 결과는 3명 이상 응답한 뒤 확인할 수 있습니다." },
      { status: 403 },
    );
  }

  if (!Number.isFinite(resultAvailableTime) || resultAvailableTime > Date.now()) {
    return NextResponse.json(
      { error: "결과 공개 시간이 아직 지나지 않았습니다." },
      { status: 403 },
    );
  }

  const full = responseCount >= NABO_FULL_RESULT_COUNT;
  const answers = bundle.responses.map((r) => full ? r.answers : toBasicAnswers(r.answers));

  return NextResponse.json({
    ok: true,
    level: full ? "full" : "basic",
    responseCount,
    answers,
  });
}
