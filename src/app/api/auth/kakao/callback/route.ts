import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=kakao_denied`);
  }

  try {
    // 1. 카카오 토큰 발급
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_REST_API_KEY!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/kakao/callback`,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("토큰 발급 실패");

    // 2. 카카오 유저 정보 조회
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const kakaoId = userData.id;
    const nickname = userData.kakao_account?.profile?.nickname ?? null;
    const profileImage = userData.kakao_account?.profile?.profile_image_url ?? null;
    const email = userData.kakao_account?.email ?? null;

    if (!kakaoId) throw new Error("유저 정보 없음");

    // 3. Supabase upsert (실패해도 로그인 진행)
    let userId = String(kakaoId);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      const { data: user, error: upsertError } = await supabase
        .from("users")
        .upsert({ kakao_id: kakaoId, nickname, profile_image: profileImage, email, last_login_at: new Date().toISOString() }, { onConflict: "kakao_id" })
        .select("id, nickname, profile_image")
        .single();

      if (!upsertError && user) {
        userId = user.id;
        await supabase.from("user_events").insert({ user_id: user.id, event_type: "login" });
      } else {
        console.error("[kakao callback] upsert error:", upsertError);
      }
    } catch (dbErr) {
      console.error("[kakao callback] db error:", dbErr);
    }

    // 4. 세션 쿠키 설정 후 /studio로 리다이렉트
    const session = Buffer.from(JSON.stringify({ id: userId, nickname, profileImage })).toString("base64");
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/studio`);
    response.cookies.set("sd_session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: "/",
    });

    return response;
  } catch (e) {
    console.error("[kakao callback]", e);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=login_failed`);
  }
}
