import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getLabHistoryKey, listHiddenLabHistoryKeys } from "@/lib/lab-history-hidden.server";
import { listBalance100SessionsForUser } from "@/lib/balance-100.server";

const BALANCE_PREDICTION_EVENT_TYPE = "lab_balance_prediction_state";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function readMetadata(row: { metadata: unknown }) {
  return row.metadata && typeof row.metadata === "object"
    ? row.metadata as Record<string, unknown>
    : {};
}

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

  const visibleSessions = sessions
    .filter((item) => item.status !== "closed" || Boolean(item.result))
    .filter((item) => !hidden.keys.has(getLabHistoryKey("balance-100", item.sessionId)))
    .slice(0, 10);
  const sessionIds = new Set(visibleSessions.map((item) => item.sessionId));
  const predictionStats = new Map<string, { count: number; latestPredictionAt: string | null }>();

  if (sessionIds.size > 0) {
    const supabase = getSupabase();
    const { data: predictions, error: predictionError } = await supabase
      .from("user_events")
      .select("metadata, created_at")
      .eq("event_type", BALANCE_PREDICTION_EVENT_TYPE)
      .contains("metadata", { sourceOwnerUserId: session.id })
      .order("created_at", { ascending: false })
      .limit(500);

    if (predictionError) {
      return NextResponse.json({ error: predictionError.message }, { status: 500 });
    }

    for (const row of predictions ?? []) {
      const metadata = readMetadata(row);
      const sourceSessionId = String(metadata.sourceSessionId ?? "");
      if (!sessionIds.has(sourceSessionId)) continue;
      const current = predictionStats.get(sourceSessionId) ?? { count: 0, latestPredictionAt: null };
      predictionStats.set(sourceSessionId, {
        count: current.count + 1,
        latestPredictionAt: current.latestPredictionAt ?? row.created_at,
      });
    }
  }

  return NextResponse.json({
    history: visibleSessions.map((item) => {
      const stats = predictionStats.get(item.sessionId) ?? { count: 0, latestPredictionAt: null };
      return {
        ...item,
        predictionCount: stats.count,
        latestPredictionAt: stats.latestPredictionAt,
      };
    }),
  });
}
