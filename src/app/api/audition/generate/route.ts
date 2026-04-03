import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addWatermark } from "@/lib/watermark";
import {
  GUEST_LIMIT, WINDOW_MS,
  GUEST_COOKIE,
  parseLimitCookie, encodeLimitCookie,
} from "@/lib/rate-limit";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  const now = Date.now();

  // ── 회원: 크레딧 3개 차감 ─────────────────────────────────────────
  if (session) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: creditRow } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", session.id)
      .single();
    if (!creditRow || creditRow.credits < 3) {
      return NextResponse.json(
        { error: "크레딧이 부족해요. AI 오디션은 3크레딧이 필요합니다!" },
        { status: 429 }
      );
    }
    const { error: e1 } = await supabase.rpc("deduct_credit", { p_user_id: session.id });
    const { error: e2 } = await supabase.rpc("deduct_credit", { p_user_id: session.id });
    const { error: e3 } = await supabase.rpc("deduct_credit", { p_user_id: session.id });
    if (e1 || e2 || e3) {
      return NextResponse.json(
        { error: "크레딧 차감에 실패했어요. 다시 시도해주세요." },
        { status: 500 }
      );
    }
  }

  // ── 비회원: 쿠키 기반 무료 체험 제한 ──────────────────────────────────
  const raw = !session ? request.cookies.get(GUEST_COOKIE)?.value : undefined;
  const limitData = !session ? parseLimitCookie(raw) : null;
  let guestCount = 0;
  let resetAt = now + WINDOW_MS;
  if (!session && limitData && now < limitData.resetAt) {
    guestCount = limitData.count;
    resetAt = limitData.resetAt;
  }
  if (!session && guestCount >= GUEST_LIMIT) {
    return NextResponse.json(
      { error: "무료 체험이 끝났어요. 카카오 로그인하면 3크레딧을 무료로 받을 수 있어요!" },
      { status: 429 }
    );
  }

  const cookieValue = !session ? encodeLimitCookie({ count: guestCount + 1, resetAt }) : "";
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.ceil((resetAt - now) / 1000),
  };

  try {
    const { images, mimeType, stylePrompts } = await request.json();

    if (!Array.isArray(images) || images.length !== 3 || !Array.isArray(stylePrompts) || stylePrompts.length !== 3) {
      return NextResponse.json({ error: "이미지 3장과 프롬프트 3개가 필요합니다." }, { status: 400 });
    }

    // ── Mock 모드: API 호출 없이 원본 이미지를 그대로 반환 ─────────────
    if (process.env.MOCK_GEMINI === "true") {
      console.log("[MOCK] audition/generate — Gemini API 호출 생략, 원본 이미지 반환");
      return NextResponse.json({ images, mimeType: "image/jpeg" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    // 씬별 이미지 생성 (순차 처리)
    const generatedImages: string[] = [];
    for (let i = 0; i < 3; i++) {
      const promptText = `이 사람의 얼굴 형태와 이목구비를 100% 유지하면서, 다음 배역에 맞게 합성해: ${stylePrompts[i]}`;
      const contents = [
        { inlineData: { mimeType: (mimeType || "image/jpeg") as "image/jpeg", data: images[i] } },
        { text: promptText },
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents,
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      let found = false;
      for (const part of parts) {
        if (part.inlineData) {
          const imageData = session
            ? part.inlineData.data!
            : await addWatermark(part.inlineData.data!);
          generatedImages.push(imageData);
          found = true;
          break;
        }
      }
      if (!found) throw new Error(`씬 ${i + 1} 이미지 생성 실패`);
    }

    // 사용 횟수 로깅
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    ).from("style_usage").insert({ style_id: "audition" }).then(() => {});

    const res = NextResponse.json({ images: generatedImages, mimeType: "image/jpeg" });
    if (!session) res.cookies.set(GUEST_COOKIE, cookieValue, cookieOptions);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[audition/generate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
