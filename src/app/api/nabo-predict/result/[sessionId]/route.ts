import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", "lab_nabo_predict_result_completed")
    .contains("metadata", { sessionId })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const metadata = data?.[0]?.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    return NextResponse.json({ error: "저장된 결과를 찾지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ result: metadata });
}
