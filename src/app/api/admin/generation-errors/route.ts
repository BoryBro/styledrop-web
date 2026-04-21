import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const { password, ids } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedIds = Array.isArray(ids)
    ? ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (parsedIds.length === 0) {
    return NextResponse.json({ error: "삭제할 오류 기록이 없습니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from("generation_errors")
    .delete()
    .in("id", parsedIds)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message || "오류 기록 삭제 실패" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deletedCount: data?.length ?? 0,
    deletedIds: (data ?? []).map((row) => row.id),
  });
}
