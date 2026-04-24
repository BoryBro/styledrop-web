import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ALL_STYLES } from "@/lib/styles";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

type GenerationHistoryItem = {
  id: string;
  user_id: string;
  nickname: string | null;
  style_id: string;
  style_name: string;
  created_at: string;
  success: boolean;
};

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const searchUser = searchParams.get("searchUser") || "";
  const limit = 50;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // transform_history와 users 조인
    const { data: transformHistory, error: historyError } = await supabase
      .from("transform_history")
      .select(
        `
        id,
        user_id,
        style_id,
        created_at,
        users!inner(nickname)
      `
      )
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // generation_errors 조회 (실패 기록)
    const { data: generationErrors } = await supabase
      .from("generation_errors")
      .select("id")
      .gte("created_at", sevenDaysAgo.toISOString());

    const errorIds = new Set(generationErrors?.map((e) => e.id) || []);

    // 결과 데이터 변환
    const styleMap = new Map(ALL_STYLES.map((s) => [s.id, s.name]));

    const results: GenerationHistoryItem[] = (transformHistory || [])
      .filter((item: any) => {
        if (!searchUser) return true;
        const nickname = item.users?.nickname || "";
        return nickname.toLowerCase().includes(searchUser.toLowerCase());
      })
      .map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        nickname: item.users?.nickname || "Unknown",
        style_id: item.style_id,
        style_name: styleMap.get(item.style_id) || item.style_id,
        created_at: item.created_at,
        success: !errorIds.has(item.id),
      }));

    return NextResponse.json({
      data: results,
      total: results.length,
    });
  } catch (error) {
    console.error("[admin/generation-history]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
