import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

// POST /api/showcase-likes  { targetUserId: string, liked: boolean }
export async function POST(req: NextRequest) {
  try {
    const session = parseSession(req);
    const { targetUserId, liked } = await req.json();
    if (!targetUserId) return NextResponse.json({ error: "missing targetUserId" }, { status: 400 });

    const likerId = session?.id ?? null;

    await getSupabase().from("user_events").insert({
      user_id: likerId,
      event_type: liked ? "story_like" : "story_unlike",
      metadata: { target_user_id: targetUserId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
