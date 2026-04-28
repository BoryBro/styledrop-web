import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { loadNaboPredictFeatureControl } from "@/lib/style-controls.server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const control = await loadNaboPredictFeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "카카오 로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("user_id, metadata, created_at")
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

  const resultOwnerId = data?.[0]?.user_id;
  let hasAccess = resultOwnerId === session.id;

  if (!hasAccess) {
    const { data: createdRows, error: createdError } = await supabase
      .from("user_events")
      .select("id")
      .eq("user_id", session.id)
      .eq("event_type", "lab_nabo_predict_link_created")
      .contains("metadata", { sessionId })
      .limit(1);

    if (createdError) {
      return NextResponse.json({ error: createdError.message }, { status: 500 });
    }

    hasAccess = (createdRows?.length ?? 0) > 0;
  }

  if (!hasAccess) {
    return NextResponse.json({ error: "결과를 볼 권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json({ result: metadata });
}
