import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  findBalance100Matches,
  updateBalance100Session,
} from "@/lib/balance-100.server";
import { loadBalance100FeatureControl } from "@/lib/style-controls.server";

async function ensureEnabled() {
  const control = await loadBalance100FeatureControl();
  return control.is_visible && control.is_enabled;
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
    const updated = await updateBalance100Session({
      sessionId,
      user: session,
      answers: body?.answers,
      representativeImageUrl:
        typeof body?.representativeImageUrl === "string"
          ? body.representativeImageUrl
          : undefined,
    });

    if (updated.error || !updated.session) {
      return NextResponse.json({ error: updated.error ?? "저장에 실패했습니다." }, { status: 500 });
    }

    const matches = updated.session.status === "completed"
      ? await findBalance100Matches({ session: updated.session, limit: 5 })
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
