import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(request: NextRequest): { id: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

// 오디션 결과 공유 시 1크레딧 보상 (계정당 1회)
export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 이미 공유 보상을 받은 적 있는지 확인
  const { data: existing } = await supabase
    .from("user_events")
    .select("id")
    .eq("user_id", session.id)
    .eq("event_type", "share_credit_reward")
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ ok: false, reason: "already_rewarded", credits: null });
  }

  // 1크레딧 지급
  await supabase.rpc("add_credits", { p_user_id: session.id, p_credits: 1 });
  await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "share_credit_reward",
    metadata: { credits: 1 },
  });

  // 최신 크레딧 잔액 조회
  const { data: creditRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", session.id)
    .single();

  return NextResponse.json({ ok: true, credits: creditRow?.credits ?? null });
}
