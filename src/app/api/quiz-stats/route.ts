import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// POST /api/quiz-stats  { hash: string, correct: boolean }
// → { correctCount, totalCount }
export async function POST(req: NextRequest) {
  try {
    const { hash, correct } = await req.json();
    if (!hash) return NextResponse.json({ error: "missing hash" }, { status: 400 });

    const { data, error } = await getSupabase().rpc("record_quiz_answer", {
      p_hash: String(hash),
      p_correct: Boolean(correct),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      correctCount: row?.correct_count ?? 0,
      totalCount:   row?.total_count   ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
