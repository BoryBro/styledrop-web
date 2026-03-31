import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ credits: 0 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", session.id)
    .single();

  return NextResponse.json({ credits: data?.credits ?? 0 });
}
