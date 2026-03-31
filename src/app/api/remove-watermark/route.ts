import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { imageKey } = await request.json();
  if (!imageKey) return NextResponse.json({ error: "imageKey 누락" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // clean 이미지 조회
  const { data: tempImg } = await supabase
    .from("temp_images")
    .select("clean_data")
    .eq("id", imageKey)
    .single();

  if (!tempImg) {
    return NextResponse.json({ error: "이미지를 찾을 수 없어요. 다시 변환해주세요." }, { status: 404 });
  }

  // 크레딧 차감 (원자적)
  const { error: deductError } = await supabase.rpc("deduct_credit", {
    p_user_id: session.id,
  });

  if (deductError) {
    return NextResponse.json({ error: "크레딧이 부족해요." }, { status: 402 });
  }

  // 사용된 임시 이미지 삭제
  await supabase.from("temp_images").delete().eq("id", imageKey);

  // 남은 크레딧 조회
  const { data: creditData } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", session.id)
    .single();

  return NextResponse.json({
    image: tempImg.clean_data,
    credits: creditData?.credits ?? 0,
  });
}
