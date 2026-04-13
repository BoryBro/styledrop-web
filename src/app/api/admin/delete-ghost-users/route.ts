import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteGhostUsers, getGhostUserCandidates } from "@/lib/ghost-users.server";

export async function POST(request: NextRequest) {
  const { password, dryRun } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    if (dryRun) {
      const candidates = await getGhostUserCandidates(supabase);
      return NextResponse.json({
        ok: true,
        ghostUserCount: candidates.length,
        preview: candidates.slice(0, 10),
      });
    }

    const result = await deleteGhostUsers(supabase);
    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedCount,
      deletedUserIds: result.deletedUserIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "유령계정 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
