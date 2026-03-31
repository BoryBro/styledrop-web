import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// 방문 기록 + 카운트 반환
export async function GET() {
  const supabase = getSupabase();

  // 방문 기록 삽입
  await supabase.from("page_views").insert({});

  // 오늘 자정 기준
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayRes, totalRes] = await Promise.all([
    supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("page_views")
      .select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    today: todayRes.count ?? 0,
    total: totalRes.count ?? 0,
  });
}
