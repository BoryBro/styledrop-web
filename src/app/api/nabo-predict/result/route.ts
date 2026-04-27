import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";

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
  const session = readSessionFromRequest(request);
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

  const metadata = {
    version: 1,
    sessionId,
    ownerName: String(payload.ownerName ?? "").slice(0, 16),
    targetName: String(payload.targetName ?? "").slice(0, 16),
    relationshipType: String(payload.relationshipType ?? "friend"),
    predictions: isPlainRecord(payload.predictions) ? payload.predictions : {},
    actualAnswers,
    createdAt: Number(payload.createdAt ?? Date.now()),
    completedAt: Date.now(),
    resultPath: `/nabo-predict?result=${encodeURIComponent(sessionId)}`,
  };

  const supabase = getSupabase();
  const { error } = await supabase.from("user_events").insert({
    user_id: session?.id ?? null,
    event_type: "lab_nabo_predict_result_completed",
    metadata,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resultPath: metadata.resultPath });
}
