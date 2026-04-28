import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getLabHistoryKey, listHiddenLabHistoryKeys } from "@/lib/lab-history-hidden.server";

type NaboPredictHistoryItem = {
  sessionId: string;
  ownerName: string;
  targetName: string;
  relationshipType: string;
  createdAt: number;
  completedAt: number | null;
  status: "waiting" | "completed";
  role: "owner" | "respondent";
  href: string;
};

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

function toItem(
  metadata: Record<string, unknown>,
  role: "owner" | "respondent",
  completedAt: number | null,
): NaboPredictHistoryItem | null {
  const sessionId = String(metadata.sessionId ?? "");
  if (!sessionId) return null;

  return {
    sessionId,
    ownerName: String(metadata.ownerName ?? "나"),
    targetName: String(metadata.targetName ?? "상대"),
    relationshipType: String(metadata.relationshipType ?? "friend"),
    createdAt: Number(metadata.createdAt ?? completedAt ?? Date.now()),
    completedAt,
    status: completedAt ? "completed" : "waiting",
    role,
    href: completedAt
      ? `/nabo-predict?result=${encodeURIComponent(sessionId)}`
      : `/nabo-predict?data=${encodeURIComponent(String(metadata.encodedPayload ?? ""))}`,
  };
}

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ history: [] });
  }

  const supabase = getSupabase();
  const { data: ownEvents, error: ownError } = await supabase
    .from("user_events")
    .select("event_type, metadata, created_at")
    .eq("user_id", session.id)
    .in("event_type", ["lab_nabo_predict_link_created", "lab_nabo_predict_result_completed"])
    .order("created_at", { ascending: false })
    .limit(80);

  if (ownError) {
    return NextResponse.json({ error: ownError.message }, { status: 500 });
  }

  const createdSessionIds = new Set(
    (ownEvents ?? [])
      .filter((row) => row.event_type === "lab_nabo_predict_link_created")
      .map((row) => String(readMetadata(row).sessionId ?? ""))
      .filter(Boolean),
  );

  const { data: recentResults, error: resultError } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", "lab_nabo_predict_result_completed")
    .order("created_at", { ascending: false })
    .limit(300);

  if (resultError) {
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  const resultBySession = new Map<string, Record<string, unknown>>();
  for (const row of recentResults ?? []) {
    const metadata = readMetadata(row);
    const sessionId = String(metadata.sessionId ?? "");
    if (sessionId && !resultBySession.has(sessionId)) {
      resultBySession.set(sessionId, metadata);
    }
  }

  const items = new Map<string, NaboPredictHistoryItem>();

  for (const row of ownEvents ?? []) {
    const metadata = readMetadata(row);
    const sessionId = String(metadata.sessionId ?? "");
    if (!sessionId) continue;

    if (row.event_type === "lab_nabo_predict_link_created") {
      const result = resultBySession.get(sessionId);
      const item = toItem(
        { ...metadata, ...(result ?? {}) },
        "owner",
        result ? Number(result.completedAt ?? Date.parse(String(row.created_at))) : null,
      );
      if (item) items.set(`owner:${sessionId}`, item);
    }

    if (row.event_type === "lab_nabo_predict_result_completed") {
      const item = toItem(metadata, "respondent", Number(metadata.completedAt ?? Date.parse(String(row.created_at))));
      if (item) items.set(`respondent:${sessionId}`, item);
    }
  }

  for (const sessionId of createdSessionIds) {
    const result = resultBySession.get(sessionId);
    const current = items.get(`owner:${sessionId}`);
    if (current && result && current.status !== "completed") {
      items.set(`owner:${sessionId}`, {
        ...current,
        completedAt: Number(result.completedAt ?? Date.now()),
        status: "completed",
        href: `/nabo-predict?result=${encodeURIComponent(sessionId)}`,
      });
    }
  }

  const hidden = await listHiddenLabHistoryKeys(session.id);
  if (hidden.error) {
    return NextResponse.json({ error: hidden.error }, { status: 500 });
  }

  return NextResponse.json({
    history: Array.from(items.values())
      .filter((item) => !hidden.keys.has(getLabHistoryKey("nabo-predict", `${item.role}:${item.sessionId}`)))
      .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
      .slice(0, 20),
  });
}
