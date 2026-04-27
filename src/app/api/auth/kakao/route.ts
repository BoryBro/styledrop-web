import { NextRequest, NextResponse } from "next/server";
import { normalizeReferralCode } from "@/lib/referral";
import { encodeSignedState } from "@/lib/signed-state";

type KakaoAuthState = {
  ref?: string;
};

export async function GET(request: NextRequest) {
  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", process.env.KAKAO_REST_API_KEY!);
  kakaoAuthUrl.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/auth/kakao/callback`);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("scope", "profile_nickname profile_image");

  const ref = normalizeReferralCode(request.nextUrl.searchParams.get("ref"));
  if (ref) {
    kakaoAuthUrl.searchParams.set("state", encodeSignedState<KakaoAuthState>({ ref }));
  }

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
