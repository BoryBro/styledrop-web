import { NextRequest, NextResponse } from "next/server";
import {
  buildNaboRoomView,
  submitNaboResponse,
  type NaboAnswerMap,
} from "@/lib/nabo-room.server";

type RoomResponseRouteContext = {
  params: Promise<{ roomCode: string }>;
};

function sanitizeAnswers(value: unknown): NaboAnswerMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result: NaboAnswerMap = {};

  for (const [key, raw] of Object.entries(value)) {
    if (!/^q\d+$/.test(key)) continue;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) result[key] = trimmed.slice(0, 300);
      continue;
    }

    if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = Math.min(100, Math.max(0, Math.round(raw)));
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export async function POST(request: NextRequest, { params }: RoomResponseRouteContext) {
  const { roomCode } = await params;
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token ?? "").trim();
  const answers = sanitizeAnswers(body?.answers);
  const clientFingerprint = String(body?.clientFingerprint ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "응답 토큰이 필요합니다." }, { status: 400 });
  }

  if (!answers) {
    return NextResponse.json({ error: "저장할 답변이 없습니다." }, { status: 400 });
  }

  const submitted = await submitNaboResponse({
    roomCode,
    respondentToken: token,
    answers,
    clientFingerprint: clientFingerprint || null,
  });

  if (submitted.error || !submitted.bundle) {
    return NextResponse.json(
      { error: submitted.error ?? "응답 저장에 실패했습니다.", duplicate: submitted.duplicate },
      { status: submitted.duplicate ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: false,
    view: buildNaboRoomView({
      bundle: submitted.bundle,
      role: "respondent",
      respondentToken: token,
    }),
  });
}
