import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";

const STORY_LIKE = "story_like";
const STORY_UNLIKE = "story_unlike";

type ReactionEvent = {
  user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
};

function parseSession(req: NextRequest): { id: string } | null {
  return readSessionFromRequest(req);
}

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function readTargetUserId(metadata: ReactionEvent["metadata"]): string | null {
  const targetUserId = metadata?.target_user_id;
  return typeof targetUserId === "string" && targetUserId.trim() ? targetUserId : null;
}

async function getLikeCount(supabase: ReturnType<typeof getSupabase>, targetUserId: string) {
  const { data, error } = await supabase
    .from("user_events")
    .select("user_id, event_type, metadata")
    .in("event_type", [STORY_LIKE, STORY_UNLIKE])
    .contains("metadata", { target_user_id: targetUserId })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw error;

  const latestByUser = new Map<string, boolean>();
  for (const event of (data ?? []) as ReactionEvent[]) {
    if (!event.user_id || latestByUser.has(event.user_id)) continue;
    if (readTargetUserId(event.metadata) !== targetUserId) continue;
    latestByUser.set(event.user_id, event.event_type === STORY_LIKE);
  }

  let count = 0;
  for (const liked of latestByUser.values()) {
    if (liked) count += 1;
  }
  return count;
}

// POST /api/showcase-likes  { targetUserId: string, liked: boolean }
export async function POST(req: NextRequest) {
  try {
    const session = parseSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
    const liked = Boolean(body?.liked);
    if (!targetUserId) return NextResponse.json({ error: "missing targetUserId" }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from("user_events").insert({
      user_id: session.id,
      event_type: liked ? STORY_LIKE : STORY_UNLIKE,
      metadata: { target_user_id: targetUserId },
    });

    if (error) throw error;

    const likeCount = await getLikeCount(supabase, targetUserId);
    return NextResponse.json({ ok: true, liked, likeCount });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
