import { NextRequest, NextResponse } from "next/server";
import {
  cleanupExpiredLabHistoryRecords,
  LAB_HISTORY_RETENTION_DAYS,
} from "@/lib/lab-history-retention.server";

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualCron = cronSecret === process.env.CRON_SECRET;

  if (!process.env.CRON_SECRET || (!isVercelCron && !isManualCron)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cleaned = await cleanupExpiredLabHistoryRecords();
  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error, cutoffIso: cleaned.cutoffIso }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    retentionDays: LAB_HISTORY_RETENTION_DAYS,
    cutoffIso: cleaned.cutoffIso,
  });
}
