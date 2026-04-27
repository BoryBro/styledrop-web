import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { setSessionCookie } from "@/lib/auth-session";
import { normalizeReferralCode } from "@/lib/referral";
import { recordReferralAttribution } from "@/lib/referrals.server";
import { decodeSignedState } from "@/lib/signed-state";

type KakaoAuthState = {
  ref?: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = decodeSignedState<KakaoAuthState>(searchParams.get("state"));
  const referralCode = normalizeReferralCode(state?.ref);

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
        client_secret: process.env.KAKAO_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/kakao/callback`,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("토큰 발급 실패: " + JSON.stringify(tokenData));

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
      // 기존 유저 확인
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("kakao_id", kakaoId)
        .single();

      const isNewUser = !existingUser;

      const { data: user, error: upsertError } = await supabase
        .from("users")
        .upsert({ kakao_id: kakaoId, nickname, profile_image: profileImage, email, last_login_at: new Date().toISOString() }, { onConflict: "kakao_id" })
        .select("id, nickname, profile_image")
        .single();

      if (!upsertError && user) {
        userId = user.id;
        await supabase.from("user_events").insert({ user_id: user.id, event_type: "login" });

        // 신규 가입 시 1크레딧 지급 (무료체험 카드 1회 사용 가능)
        if (isNewUser) {
          await supabase.rpc("add_credits", { p_user_id: user.id, p_credits: 1 });
          await supabase.from("user_events").insert({ user_id: user.id, event_type: "signup_bonus", metadata: { credits: 1 } });
          if (referralCode) {
            await recordReferralAttribution(supabase, {
              referrerCode: referralCode,
              referredUserId: user.id,
            });
          }
        }
      } else {
        console.error("[kakao callback] upsert error:", upsertError);
      }
    } catch (dbErr) {
      console.error("[kakao callback] db error:", dbErr);
    }

    // 4. 세션 쿠키 설정 후 /studio로 리다이렉트
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/studio`);
    setSessionCookie(response, {
      id: userId,
      nickname: nickname ?? "",
      profileImage,
    });

    return response;
  } catch (e) {
    console.error("[kakao callback]", e);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=login_failed`);
  }
}
