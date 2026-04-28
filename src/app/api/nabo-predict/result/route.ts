import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { loadNaboPredictFeatureControl } from "@/lib/style-controls.server";
import { isWithinLabHistoryRetention } from "@/lib/lab-history-retention.server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const control = await loadNaboPredictFeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!isPlainRecord(body)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const payload = body.payload;
  const actualAnswers = body.actualAnswers;

  if (!isPlainRecord(payload) || !isPlainRecord(actualAnswers)) {
    return NextResponse.json({ error: "결과 저장 정보가 부족합니다." }, { status: 400 });
  }

  const sessionId = String(payload.sessionId ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }
  const createdAt = Number(payload.createdAt ?? Date.now());
  if (!isWithinLabHistoryRetention(createdAt)) {
    return NextResponse.json({ error: "30일이 지난 실험실 링크입니다." }, { status: 410 });
  }

  const metadata = {
    version: 1,
    sessionId,
    ownerName: String(payload.ownerName ?? "").slice(0, 16),
    targetName: String(payload.targetName ?? "").slice(0, 16),
    relationshipType: String(payload.relationshipType ?? "friend"),
    questionIds: Array.isArray(payload.questionIds) ? payload.questionIds.filter((item) => typeof item === "string") : [],
    predictions: isPlainRecord(payload.predictions) ? payload.predictions : {},
    actualAnswers,
    createdAt,
    completedAt: Date.now(),
    resultPath: `/nabo-predict?result=${encodeURIComponent(sessionId)}`,
  };

  const supabase = getSupabase();
  const { error } = await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "lab_nabo_predict_result_completed",
    metadata,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resultPath: metadata.resultPath });
}
