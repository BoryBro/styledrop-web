import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";

const ALLOWED_EVENTS = [
  "share_kakao",
  "share_link_copy",
  "save_image",
  "audition_share_kakao",
  "audition_share_link_copy",
  "revisit",
  "share_credit_reward",
];

function parseSession(request: NextRequest): { id: string } | null {
  return readSessionFromRequest(request);
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { event_type, metadata } = await request.json();
  if (!ALLOWED_EVENTS.includes(event_type)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await supabase.from("user_events").insert({
    user_id: session.id,
    event_type,
    metadata: metadata ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
