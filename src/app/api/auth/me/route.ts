import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ loggedIn: false });
  }

  return NextResponse.json({ loggedIn: true, user });
}
