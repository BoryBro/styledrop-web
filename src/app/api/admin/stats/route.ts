import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from("style_usage")
    .select("style_id, style_name");

  if (error || !data) {
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 500 });
  }

  const total = data.length;
  const counts: Record<string, { style_name: string; count: number }> = {};
  for (const row of data) {
    if (!counts[row.style_id]) {
      counts[row.style_id] = { style_name: row.style_name, count: 0 };
    }
    counts[row.style_id].count++;
  }

  const byStyle = Object.entries(counts).map(([style_id, v]) => ({
    style_id,
    style_name: v.style_name,
    count: v.count,
  }));

  return NextResponse.json({ total, byStyle });
}
