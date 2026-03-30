import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function DELETE(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  await supabase.from("user_events").delete().eq("user_id", session.id);
  await supabase.from("transform_history").delete().eq("user_id", session.id);
  await supabase.from("style_usage").update({ user_id: null }).eq("user_id", session.id);
  await supabase.from("users").delete().eq("id", session.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set("sd_session", "", { maxAge: 0, path: "/" });
  return response;
}
