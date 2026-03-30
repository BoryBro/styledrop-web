import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("sd_session")?.value;
  if (!cookie) return NextResponse.json({ loggedIn: false });

  try {
    const user = JSON.parse(Buffer.from(cookie, "base64").toString("utf-8"));
    return NextResponse.json({ loggedIn: true, user });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
