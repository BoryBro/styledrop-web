import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GUEST_LIMIT, GUEST_COOKIE, getRemaining } from "@/lib/rate-limit";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);

  if (session) {
    // v2.0: 회원은 크레딧 기반
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", session.id)
      .single();
    const credits = data?.credits ?? 0;
    return NextResponse.json({ remaining: credits, limit: null, loggedIn: true, credits });
  }

  // 비회원: 쿠키 기반 1회 무료 체험
  const raw = request.cookies.get(GUEST_COOKIE)?.value;
  const remaining = getRemaining(raw, GUEST_LIMIT);
  return NextResponse.json({ remaining, limit: GUEST_LIMIT, loggedIn: false });
}
