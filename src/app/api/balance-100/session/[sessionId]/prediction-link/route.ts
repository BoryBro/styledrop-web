import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { createBalance100PredictionLink } from "@/lib/balance-100.server";
import { loadBalance100FeatureControl } from "@/lib/style-controls.server";

function getPredictionLinkErrorStatus(error?: string) {
  if (error === "권한이 없습니다.") return 403;
  if (error === "문항을 모두 완료한 뒤 만들 수 있습니다.") return 409;
  if (error === "session not found") return 404;
  return 500;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const control = await loadBalance100FeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const ownerName = typeof body?.ownerName === "string" ? body.ownerName : undefined;
  const created = await createBalance100PredictionLink({ sessionId, user: session, ownerName });

  if (created.error || !created.path) {
    return NextResponse.json(
      { error: created.error ?? "링크를 만들지 못했습니다." },
      { status: getPredictionLinkErrorStatus(created.error ?? undefined) },
    );
  }

  return NextResponse.json({
    ok: true,
    path: created.path,
    session: created.session,
  });
}
