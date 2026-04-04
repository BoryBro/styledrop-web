import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", process.env.KAKAO_REST_API_KEY!);
  kakaoAuthUrl.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/auth/kakao/callback`);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("scope", "profile_nickname profile_image");
  if (ref) kakaoAuthUrl.searchParams.set("state", `ref_${ref}`);

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
