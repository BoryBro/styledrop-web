import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getAvailableCredits } from "@/lib/credits.server";
import { GUEST_LIMIT, GUEST_COOKIE, getRemaining } from "@/lib/rate-limit";

function parseSession(req: NextRequest): { id: string } | null {
  return readSessionFromRequest(req);
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);

  if (session) {
    // v2.0: 회원은 크레딧 기반
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const credits = await getAvailableCredits(supabase, session.id);
    return NextResponse.json({ remaining: credits, limit: null, loggedIn: true, credits });
  }

  // 비회원: 쿠키 기반 1회 무료 체험
  const raw = request.cookies.get(GUEST_COOKIE)?.value;
  const remaining = getRemaining(raw, GUEST_LIMIT);
  return NextResponse.json({ remaining, limit: GUEST_LIMIT, loggedIn: false });
}
