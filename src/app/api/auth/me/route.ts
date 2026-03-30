import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = request.cookies.get("sd_session")?.value;
  if (!session) return NextResponse.json({ user: null });

  try {
    const user = JSON.parse(Buffer.from(session, "base64").toString("utf-8"));
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
