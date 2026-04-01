import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 카카오페이 심사용 테스트 계정 로그인
// 사용법: /api/auth/test-login?pw=어드민비밀번호

const TEST_KAKAO_ID = 9999999901; // 숫자형 (bigint 컬럼 맞춤)
const TEST_NICKNAME = "테스트계정";

export async function GET(request: NextRequest) {
  const pw = new URL(request.url).searchParams.get("pw");

  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ step: "auth_fail", ADMIN_PASSWORD_set: !!process.env.ADMIN_PASSWORD, pw_received: pw }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 테스트 유저 upsert
  const { data: user, error: upsertError } = await supabase
    .from("users")
    .upsert(
      { kakao_id: TEST_KAKAO_ID, nickname: TEST_NICKNAME, last_login_at: new Date().toISOString() },
      { onConflict: "kakao_id" }
    )
    .select("id")
    .single();

  if (upsertError || !user) {
    return NextResponse.json({ step: "upsert_fail", detail: upsertError?.message }, { status: 500 });
  }

  const { error: creditError } = await supabase.rpc("add_credits", { p_user_id: user.id, p_credits: 10 });

  return NextResponse.json({
    step: "ok",
    userId: user.id,
    creditError: creditError?.message ?? null,
    message: "여기까지 성공. 이 내용을 캡처해서 알려주세요.",
  });
}
