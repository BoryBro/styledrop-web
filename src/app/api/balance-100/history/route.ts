import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getLabHistoryKey, listHiddenLabHistoryKeys } from "@/lib/lab-history-hidden.server";
import { listBalance100SessionsForUser } from "@/lib/balance-100.server";

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ history: [] });
  }

  const { sessions, error } = await listBalance100SessionsForUser(session.id);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const hidden = await listHiddenLabHistoryKeys(session.id);
  if (hidden.error) {
    return NextResponse.json({ error: hidden.error }, { status: 500 });
  }

  return NextResponse.json({
    history: sessions
      .filter((item) => item.status !== "closed")
      .filter((item) => !hidden.keys.has(getLabHistoryKey("balance-100", item.sessionId)))
      .slice(0, 10),
  });
}
