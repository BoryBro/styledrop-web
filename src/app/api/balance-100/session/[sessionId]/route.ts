import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  discardBalance100Session,
  findBalance100Matches,
  getBalance100Session,
  updateBalance100Session,
} from "@/lib/balance-100.server";
import { loadBalance100FeatureControl } from "@/lib/style-controls.server";

async function ensureEnabled() {
  const control = await loadBalance100FeatureControl();
  return control.is_visible && control.is_enabled;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const found = await getBalance100Session(sessionId);
  if (found.error || !found.session) {
    return NextResponse.json({ error: found.error ?? "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (found.session.ownerUserId !== session.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const matches = found.session.status === "completed"
    ? await findBalance100Matches({ session: found.session, limit: 10 })
    : { matches: [], error: null };

  return NextResponse.json({
    ok: true,
    session: found.session,
    matches: matches.matches,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName : undefined;
    const updated = await updateBalance100Session({
      sessionId,
      user: session,
      answers: body?.answers,
      representativeImageUrl:
        typeof body?.representativeImageUrl === "string"
          ? body.representativeImageUrl
          : undefined,
      ownerName,
    });

    if (updated.error || !updated.session) {
      return NextResponse.json({ error: updated.error ?? "저장에 실패했습니다." }, { status: 500 });
    }

    const matches = updated.session.status === "completed"
      ? await findBalance100Matches({ session: updated.session, limit: 10 })
      : { matches: [], error: null };

    return NextResponse.json({
      ok: true,
      session: updated.session,
      matches: matches.matches,
    });
  } catch {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const discarded = await discardBalance100Session({ sessionId, user: session });

  if (!discarded.ok) {
    return NextResponse.json({ error: discarded.error ?? "진행 상태를 정리하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
