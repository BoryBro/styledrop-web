import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { addCreditsWithPolicy, getAvailableCredits } from "@/lib/credits.server";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  return readSessionFromRequest(request);
}

function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GIFT-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedCredits = Number(body?.credits);
  const credits = Number.isInteger(requestedCredits) ? requestedCredits : Math.floor(requestedCredits);

  if (!Number.isFinite(credits) || credits < 1) {
    return NextResponse.json({ error: "선물할 크레딧 수를 1개 이상 입력해주세요." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const availableCredits = await getAvailableCredits(supabase, session.id);
  if (availableCredits < credits) {
    return NextResponse.json({ error: "보유 크레딧이 부족합니다." }, { status: 400 });
  }

  const { data: remainingCredits, error: deductError } = await supabase.rpc("deduct_credit", {
    p_user_id: session.id,
    p_amount: credits,
  });

  if (deductError || remainingCredits === null || remainingCredits === undefined) {
    return NextResponse.json({ error: "크레딧 차감에 실패했습니다." }, { status: 400 });
  }

  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = generateGiftCode();
    const { data: dup } = await supabase.from("gift_codes").select("code").eq("code", candidate).maybeSingle();
    if (!dup) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    await addCreditsWithPolicy(supabase, {
      userId: session.id,
      credits,
      sourceType: "refund",
      sourceId: `gift_create_failed:${session.id}:${Date.now()}`,
    });
    return NextResponse.json({ error: "선물 코드 생성 실패" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("gift_codes").insert({
    code,
    credits,
    amount: 0,
    status: "unused",
    created_by: session.id,
    expires_at: expiresAt,
  });

  if (insertError) {
    await addCreditsWithPolicy(supabase, {
      userId: session.id,
      credits,
      sourceType: "refund",
      sourceId: `gift_create_failed:${session.id}:${Date.now()}`,
    });
    return NextResponse.json({ error: "선물 코드 저장 실패" }, { status: 500 });
  }

  const { error: eventError } = await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "credit_gift_created",
    metadata: {
      credits,
      code,
    },
  });

  if (eventError) {
    console.error("[gift/create] failed to log credit gift event", eventError);
  }

  return NextResponse.json({
    success: true,
    code,
    credits,
    expiresAt,
    remainingCredits,
  });
}
