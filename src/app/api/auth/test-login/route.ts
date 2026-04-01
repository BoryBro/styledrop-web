import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 카카오페이 심사용 테스트 계정 로그인
// 사용법: /api/auth/test-login?pw=어드민비밀번호

const TEST_KAKAO_ID = 9999999901; // 숫자형 (bigint 컬럼 맞춤)
const TEST_NICKNAME = "테스트계정";

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
  const { data: user, error: upsertError } = await supabase
    .from("users")
    .upsert(
      { kakao_id: TEST_KAKAO_ID, nickname: TEST_NICKNAME, last_login_at: new Date().toISOString() },
      { onConflict: "kakao_id" }
    )
    .select("id")
    .single();

  if (upsertError || !user) {
    return NextResponse.json({ error: "유저 생성 실패", detail: upsertError?.message }, { status: 500 });
  }

  // 크레딧 10개 보충 (테스트용 — 매 접근 시 충전)
  await supabase.rpc("add_credits", { p_user_id: user.id, p_credits: 10 });

  // 세션 쿠키 → /shop으로 리다이렉트
  const session = Buffer.from(
    JSON.stringify({ id: user.id, nickname: TEST_NICKNAME, profileImage: null })
  ).toString("base64");

  const base = process.env.NEXTAUTH_URL ?? `${new URL(request.url).protocol}//${new URL(request.url).host}`;
  const response = NextResponse.redirect(`${base}/shop`);
  response.cookies.set("sd_session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
