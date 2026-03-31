import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GUEST_LIMIT, USER_LIMIT, GUEST_COOKIE, getRemaining } from "@/lib/rate-limit";

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
    // 회원: DB에서 오늘 사용량 조회
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: usedCount } = await supabase.rpc("get_daily_usage", { p_user_id: session.id });
    const used = usedCount ?? 0;
    const remaining = Math.max(0, USER_LIMIT - used);
    return NextResponse.json({ remaining, limit: USER_LIMIT, loggedIn: true });
  }

  // 비회원: 쿠키 기반
  const raw = request.cookies.get(GUEST_COOKIE)?.value;
  const remaining = getRemaining(raw, GUEST_LIMIT);
  return NextResponse.json({ remaining, limit: GUEST_LIMIT, loggedIn: false });
}
