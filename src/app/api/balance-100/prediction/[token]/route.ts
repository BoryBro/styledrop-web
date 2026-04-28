import { NextRequest, NextResponse } from "next/server";
import { BALANCE_TOTAL_QUESTIONS } from "@/lib/balance-100";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  getBalance100SessionByPredictionToken,
  submitBalance100Prediction,
} from "@/lib/balance-100.server";
import { loadBalance100FeatureControl } from "@/lib/style-controls.server";

async function ensureEnabled() {
  const control = await loadBalance100FeatureControl();
  return control.is_visible && control.is_enabled;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 참여할 수 있습니다." }, { status: 401 });
  }

  const { token } = await context.params;
  const source = await getBalance100SessionByPredictionToken(token);
  if (source.error || !source.session) {
    return NextResponse.json({ error: "예측 링크를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    token,
    level: source.session.level,
    ownerName: source.session.ownerName,
    total: BALANCE_TOTAL_QUESTIONS,
    isOwner: source.session.ownerUserId === session.id,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 참여할 수 있습니다." }, { status: 401 });
  }

  try {
    const { token } = await context.params;
    const body = await request.json();
    const submitted = await submitBalance100Prediction({
      token,
      user: session,
      answers: body?.answers,
    });

    if (submitted.error || !submitted.prediction) {
      return NextResponse.json({ error: submitted.error ?? "예측 결과 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      prediction: submitted.prediction,
      source: submitted.sourceSession
        ? {
            ownerName: submitted.sourceSession.ownerName,
            level: submitted.sourceSession.level,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "예측 결과 저장에 실패했습니다." }, { status: 500 });
  }
}
