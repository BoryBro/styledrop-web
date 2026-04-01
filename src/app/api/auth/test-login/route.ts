import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 카카오페이 심사용 테스트 계정 로그인
// 사용법: /api/auth/test-login?pw=어드민비밀번호
// → 자동으로 테스트 계정으로 로그인 후 /shop으로 이동

const TEST_KAKAO_ID = "test_reviewer_kakaopaycorp";
const TEST_NICKNAME = "테스트계정";
const TEST_CREDITS = 10;

export async function GET(request: NextRequest) {
  const pw = new URL(request.url).searchParams.get("pw");

  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 테스트 유저 upsert
  const { data: user, error } = await supabase
    .from("users")
    .upsert(
      { kakao_id: TEST_KAKAO_ID, nickname: TEST_NICKNAME, last_login_at: new Date().toISOString() },
      { onConflict: "kakao_id" }
    )
    .select("id, nickname")
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "유저 생성 실패" }, { status: 500 });
  }

  // 크레딧 잔액 확인 후 부족하면 보충
  const { data: creditRow } = await supabase
    .from("credits")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  const balance = creditRow?.balance ?? 0;
  if (balance < TEST_CREDITS) {
    await supabase.rpc("add_credits", {
      p_user_id: user.id,
      p_credits: TEST_CREDITS - balance,
    });
  }

  // 세션 쿠키 설정 → /shop으로 이동 (결제창 바로 확인 가능)
  const session = Buffer.from(
    JSON.stringify({ id: user.id, nickname: TEST_NICKNAME, profileImage: null })
  ).toString("base64");

  const response = NextResponse.redirect(
    new URL("/shop", process.env.NEXTAUTH_URL ?? request.url)
  );
  response.cookies.set("sd_session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 1일
    path: "/",
  });

  return response;
}
