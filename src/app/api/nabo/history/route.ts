import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getLabHistoryKey, listHiddenLabHistoryKeys } from "@/lib/lab-history-hidden.server";
import { getLabHistoryCutoffIso } from "@/lib/lab-history-retention.server";
import { NABO_BASIC_RESULT_COUNT } from "@/lib/nabo-room.server";

type NaboHistoryRoomRow = {
  id: string;
  room_code: string;
  owner_name: string;
  response_target: number;
  result_available_after: string;
  premium_access_at: string | null;
  status: "open" | "closed" | "deleted";
  created_at: string;
  expires_at: string;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ history: [] });
  }

  const supabase = getSupabase();
  const cutoffIso = getLabHistoryCutoffIso();
  const { data: rooms, error: roomError } = await supabase
    .from("nabo_rooms")
    .select("id, room_code, owner_name, response_target, result_available_after, premium_access_at, status, created_at, expires_at")
    .eq("owner_user_id", session.id)
    .neq("status", "deleted")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(20);

  if (roomError) {
    return NextResponse.json({ error: roomError.message }, { status: 500 });
  }

  const roomRows = (rooms ?? []) as NaboHistoryRoomRow[];
  const responseStats = new Map<string, { count: number; latestResponseAt: string | null }>();

  if (roomRows.length > 0) {
    const stats = await Promise.all(
      roomRows.map(async (room) => {
        const { data, error, count } = await supabase
          .from("nabo_responses")
          .select("created_at", { count: "exact" })
          .eq("room_id", room.id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          roomId: room.id,
          count: count ?? 0,
          latestResponseAt: typeof data?.[0]?.created_at === "string" ? data[0].created_at : null,
          error: error?.message ?? null,
        };
      }),
    );

    const responseError = stats.find((item) => item.error)?.error;
    if (responseError) {
      return NextResponse.json({ error: responseError }, { status: 500 });
    }

    for (const item of stats) {
      responseStats.set(item.roomId, {
        count: item.count,
        latestResponseAt: item.latestResponseAt,
      });
    }
  }

  const hidden = await listHiddenLabHistoryKeys(session.id);
  if (hidden.error) {
    return NextResponse.json({ error: hidden.error }, { status: 500 });
  }

  return NextResponse.json({
    history: roomRows
      .filter((room) => new Date(room.expires_at).getTime() > Date.now())
      .filter((room) => !hidden.keys.has(getLabHistoryKey("nabo", room.room_code)))
      .map((room) => {
        const stats = responseStats.get(room.id) ?? { count: 0, latestResponseAt: null };
        return {
          roomCode: room.room_code,
          ownerName: room.owner_name,
          responseCount: stats.count,
          responseTarget: room.response_target,
          latestResponseAt: stats.latestResponseAt,
          resultAvailableAfter: room.result_available_after,
          canViewResults: stats.count >= NABO_BASIC_RESULT_COUNT || Boolean(room.premium_access_at),
          premiumAccess: Boolean(room.premium_access_at),
          createdAt: room.created_at,
          href: `/nabo?room=${encodeURIComponent(room.room_code)}`,
        };
      }),
  });
}
