import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";

const ALLOWED_EVENTS = [
  "share_kakao",
  "share_link_copy",
  "save_image",
  "audition_share_kakao",
  "audition_share_link_copy",
  "gift_share_kakao",
  "revisit",
  "lab_nabo_room_created",
  "lab_nabo_response_completed",
  "lab_nabo_unlock",
  "lab_travel_room_created",
  "lab_travel_response_completed",
  "lab_travel_partner_ready",
  "lab_travel_unlock",
  "lab_personal_color_completed",
];

const ALLOWED_PUBLIC_EVENTS = new Set([
  "lab_nabo_room_created",
  "lab_nabo_response_completed",
  "lab_nabo_unlock",
  "lab_travel_room_created",
  "lab_travel_response_completed",
  "lab_travel_partner_ready",
  "lab_travel_unlock",
  "lab_personal_color_completed",
]);

function parseSession(request: NextRequest): { id: string } | null {
  return readSessionFromRequest(request);
}

export async function POST(request: NextRequest) {
  const { event_type, metadata } = await request.json();
  if (!ALLOWED_EVENTS.includes(event_type)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const session = parseSession(request);
  const isPublicEvent = ALLOWED_PUBLIC_EVENTS.has(event_type);
  if (!session && !isPublicEvent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await supabase.from("user_events").insert({
    user_id: session?.id ?? null,
    event_type,
    metadata: metadata ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
