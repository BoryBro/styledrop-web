import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getLabHistoryKey, listHiddenLabHistoryKeys } from "@/lib/lab-history-hidden.server";
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

  const hidden = await listHiddenLabHistoryKeys(session.id);
  if (hidden.error) {
    return NextResponse.json({ error: hidden.error }, { status: 500 });
  }

  return NextResponse.json({
    history: items.filter((item) => !hidden.keys.has(getLabHistoryKey("travel-together", item.roomId))),
  });
}
