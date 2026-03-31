import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

async function getCounts() {
  const supabase = getSupabase();
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

  return { today: todayRes.count ?? 0, total: totalRes.count ?? 0 };
}

// GET: 카운트만 조회 (기록 없음)
export async function GET() {
  const counts = await getCounts();
  return NextResponse.json(counts);
}

// POST: 방문 기록 + 카운트 반환
export async function POST() {
  const supabase = getSupabase();
  await supabase.from("page_views").insert({});
  const counts = await getCounts();
  return NextResponse.json(counts);
}
