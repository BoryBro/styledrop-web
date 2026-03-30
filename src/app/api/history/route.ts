import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(request: NextRequest): { id: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("transform_history")
    .select("id, style_id, result_image_url, created_at")
    .eq("user_id", session.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data });
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { style_id, result_image_url } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await supabase.from("transform_history").insert({
    user_id: session.id,
    style_id,
    result_image_url,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "save_result",
    metadata: { style_id },
  });

  return NextResponse.json({ ok: true });
}
