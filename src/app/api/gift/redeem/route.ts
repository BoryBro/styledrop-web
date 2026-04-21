import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import { getCreditExpiryIso } from "@/lib/credits";

export async function POST(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { code } = await request.json();
  if (!code || typeof code !== "string") return NextResponse.json({ error: "코드를 입력해주세요." }, { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: gift, error } = await supabase
    .from("gift_codes")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (error || !gift) return NextResponse.json({ error: "유효하지 않은 코드입니다." }, { status: 404 });
  if (gift.status === "used") return NextResponse.json({ error: "이미 사용된 코드입니다." }, { status: 409 });
  if (new Date(gift.expires_at) < new Date()) return NextResponse.json({ error: "만료된 코드입니다." }, { status: 410 });
  if (gift.created_by === session.id) return NextResponse.json({ error: "본인이 구매한 코드는 직접 사용할 수 없습니다." }, { status: 400 });

  // 코드 사용 처리
  const { error: updateError } = await supabase
    .from("gift_codes")
    .update({ status: "used", used_by: session.id, used_at: new Date().toISOString() })
    .eq("code", gift.code)
    .eq("status", "unused");

  if (updateError) return NextResponse.json({ error: "코드 처리 중 오류가 발생했습니다." }, { status: 500 });

  // 크레딧 지급
  const addRes = await addCreditsWithPolicy(supabase, {
    userId: session.id,
    credits: gift.credits,
    sourceType: "reward",
    sourceId: `gift_${gift.code}`,
    expiresAt: getCreditExpiryIso(),
  });

  if (!addRes.ok) return NextResponse.json({ error: "크레딧 지급 실패" }, { status: 500 });

  return NextResponse.json({ success: true, credits: gift.credits });
}
