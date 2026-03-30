import { NextRequest, NextResponse } from "next/server";
import { GUEST_LIMIT, USER_LIMIT, GUEST_COOKIE, USER_COOKIE, getRemaining } from "@/lib/rate-limit";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  const cookieName = session ? USER_COOKIE : GUEST_COOKIE;
  const limit = session ? USER_LIMIT : GUEST_LIMIT;
  const raw = request.cookies.get(cookieName)?.value;
  const remaining = getRemaining(raw, limit);
  return NextResponse.json({ remaining, limit, loggedIn: !!session });
}
