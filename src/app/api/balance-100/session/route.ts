import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { BALANCE_TOTAL_QUESTIONS, normalizeBalanceLevel, type BalanceLevel } from "@/lib/balance-100";
import {
  createBalance100Session,
  findBalance100Matches,
  getCurrentBalance100Session,
  listBalance100SessionsForUser,
} from "@/lib/balance-100.server";
import { loadBalance100FeatureControl } from "@/lib/style-controls.server";

async function ensureEnabled() {
  const control = await loadBalance100FeatureControl();
  return control.is_visible && control.is_enabled;
}

export async function GET(request: NextRequest) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const current = await getCurrentBalance100Session(session.id);
  if (current.error) {
    return NextResponse.json({ error: current.error }, { status: 500 });
  }
  const history = await listBalance100SessionsForUser(session.id);
  if (history.error) {
    return NextResponse.json({ error: history.error }, { status: 500 });
  }

  const completedByLevel = new Map<BalanceLevel, NonNullable<typeof history.sessions>[number]>();
  for (const item of history.sessions) {
    if (!item.result || Object.keys(item.answers).length < BALANCE_TOTAL_QUESTIONS) continue;
    if (!completedByLevel.has(item.level)) {
      completedByLevel.set(item.level, item);
    }
  }

  const matches = current.session?.status === "completed"
    ? await findBalance100Matches({ session: current.session, limit: 5 })
    : { matches: [], error: null };

  return NextResponse.json({
    ok: true,
    session: current.session,
    matches: matches.matches,
    completedSessions: [...completedByLevel.values()].sort((a, b) => a.level - b.level),
  });
}

export async function POST(request: NextRequest) {
  if (!await ensureEnabled()) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const level = normalizeBalanceLevel(body?.level);
    const restart = Boolean(body?.restart);
    const created = await createBalance100Session({
      user: session,
      level,
      restart,
    });

    if (created.error || !created.session) {
      return NextResponse.json({ error: created.error ?? "세션을 만들지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      session: created.session,
      reused: created.reused,
    });
  } catch {
    return NextResponse.json({ error: "세션을 만들지 못했습니다." }, { status: 500 });
  }
}
