import { NextRequest, NextResponse } from "next/server";
import { hideLabHistoryItem, isLabHistoryType } from "@/lib/lab-history-hidden.server";
import { readSessionFromRequest } from "@/lib/auth-session";

export async function DELETE(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { type?: unknown; itemId?: unknown } | null;
  const type = body?.type;
  const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";

  if (!isLabHistoryType(type) || !itemId) {
    return NextResponse.json({ error: "Invalid lab history item" }, { status: 400 });
  }

  const hidden = await hideLabHistoryItem(session.id, type, itemId);
  if (!hidden.ok) {
    return NextResponse.json({ error: hidden.error ?? "Failed to delete history item" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key: hidden.key });
}
