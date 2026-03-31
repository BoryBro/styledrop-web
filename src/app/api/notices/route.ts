import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// 공지 목록 조회 (public)
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notices")
    .select("id, text, active, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ notices: [] });
  return NextResponse.json({ notices: data ?? [] });
}

// 공지 저장 (admin only)
export async function POST(request: NextRequest) {
  const { password, notices } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // 기존 전체 삭제 후 재삽입
  await supabase.from("notices").delete().neq("id", 0);

  if (notices && notices.length > 0) {
    const rows = notices
      .filter((n: { text: string; active: boolean }) => n.text.trim())
      .map((n: { text: string; active: boolean }, i: number) => ({
        text: n.text.trim(),
        active: n.active,
        sort_order: i,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("notices").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
