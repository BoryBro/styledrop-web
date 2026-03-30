import { NextRequest, NextResponse } from "next/server";
import { getRemainingCount, GUEST_LIMIT, USER_LIMIT } from "@/lib/rate-limit";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  const key = session ? "user:" + session.id : getIp(request);
  const limit = session ? USER_LIMIT : GUEST_LIMIT;
  const remaining = getRemainingCount(key, limit);
  return NextResponse.json({ remaining, limit, loggedIn: !!session });
}
