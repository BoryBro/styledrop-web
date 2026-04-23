import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { listCompletedTravelRoomsForUser } from "@/lib/travel-together-room.server";

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ history: [] });
  }

  const { items, error } = await listCompletedTravelRoomsForUser(session.id);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ history: items });
}
