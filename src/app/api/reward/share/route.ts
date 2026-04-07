import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCreditsWithPolicy, getAvailableCredits } from "@/lib/credits.server";

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
  const addRes = await addCreditsWithPolicy(supabase, {
    userId: session.id,
    credits: 1,
    sourceType: "reward",
    sourceId: "share_credit_reward",
  });
  if (!addRes.ok) {
    return NextResponse.json({ error: addRes.error?.message ?? "크레딧 지급 실패" }, { status: 500 });
  }
  await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "share_credit_reward",
    metadata: { credits: 1 },
  });

  const credits = await getAvailableCredits(supabase, session.id);
  return NextResponse.json({ ok: true, credits });
}
