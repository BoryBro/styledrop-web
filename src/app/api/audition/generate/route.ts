import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addWatermark } from "@/lib/watermark";
import { loadAuditionFeatureControl } from "@/lib/style-controls.server";
import {
  GUEST_LIMIT, WINDOW_MS,
  GUEST_COOKIE,
  parseLimitCookie, encodeLimitCookie,
} from "@/lib/rate-limit";

type ScoreMap = Partial<Record<"이해도" | "표정연기" | "창의성" | "몰입도", number>>;
type GenerateScene = {
  genre?: string;
  assigned_role?: string;
  style_prompt?: string;
  scores?: ScoreMap;
};
type GenerateGenreMeta = {
  genre?: string;
  cue?: string;
};
type GeneratePhysiognomy = {
  archetype?: string;
  face_type?: string;
  screen_impression?: string;
  casting_frame?: string;
};

type GeneratePromptTemplateId =
  | "action"
  | "comedy"
  | "crime"
  | "daily"
  | "fantasy"
  | "horror"
  | "melo"
  | "psycho"
  | "romance"
  | "thriller"
  | "thriller 2";

const TEMPLATE_BY_GENRE: Record<string, GeneratePromptTemplateId> = {
  액션: "action",
  코미디: "comedy",
  범죄: "crime",
  일상: "daily",
  판타지: "fantasy",
  공포: "horror",
  멜로: "melo",
  심리: "psycho",
  로맨스: "romance",
  스릴러: "thriller 2",
};

const VALID_TEMPLATE_IDS = new Set<GeneratePromptTemplateId>([
  "action",
  "comedy",
  "crime",
  "daily",
  "fantasy",
  "horror",
  "melo",
  "psycho",
  "romance",
  "thriller",
  "thriller 2",
]);

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

function averageSceneScore(scene?: GenerateScene | null) {
  if (!scene?.scores) return 0;
  const labels: Array<keyof ScoreMap> = ["이해도", "표정연기", "창의성", "몰입도"];
  const total = labels.reduce((sum, label) => sum + (scene.scores?.[label] ?? 0), 0);
  return total / labels.length;
}

function clampText(value: unknown, limit = 120) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

function buildStillPrompt({
  genre,
  cue,
  assignedRole,
  archetype,
  screenImpression,
  castingFrame,
  fallbackStylePrompt,
}: {
  genre: string;
  cue: string;
  assignedRole: string;
  archetype: string;
  screenImpression: string;
  castingFrame: string;
  fallbackStylePrompt: string;
}) {
  const genreLabel = genre || "drama";
  const cueLine = cue || "a decisive dramatic moment";
  const roleLine = assignedRole || "scene-stealing supporting role";
  const archetypeLine = archetype || "distinctive cinematic screen presence";
  const impressionLine = screenImpression || castingFrame || "clear, memorable screen presence";

  return [
    "Use the attached front-facing reference photo only to preserve this person's exact identity, facial proportions, eyes, nose, lips, jawline, skin tone, and overall likeness.",
    `Create a premium cinematic still from a Korean ${genreLabel} feature film, not a selfie or poster, with film-grade lighting, production design, wardrobe, natural body posture, and a realistic medium close-up or medium shot.`,
    `The moment should feel like "${cueLine}", casting this person as "${roleLine}" with a ${archetypeLine}; the frame should read as ${impressionLine}.`,
    "Even if the reference image is neutral and front-facing, transform it into a believable in-scene movie frame with realistic anatomy, proper hands, exactly five fingers on each visible hand, and no text or graphic overlays.",
    fallbackStylePrompt ? `Additional art direction: ${fallbackStylePrompt}` : "",
  ].filter(Boolean).join(" ");
}

async function loadPromptTemplate(templateId: GeneratePromptTemplateId) {
  const filePath = path.join(process.cwd(), "src/lib/styles/audition-prompts", `${templateId}.txt`);
  const content = await readFile(filePath, "utf8");
  return content.trim();
}

function resolvePromptTemplateId(templateId: unknown, genre: string) {
  if (typeof templateId === "string" && VALID_TEMPLATE_IDS.has(templateId as GeneratePromptTemplateId)) {
    return templateId as GeneratePromptTemplateId;
  }
  return TEMPLATE_BY_GENRE[genre] ?? null;
}

export async function POST(request: NextRequest) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) {
    return NextResponse.json({ error: "AI 오디션이 현재 비공개 상태입니다." }, { status: 503 });
  }

  const session = parseSession(request);
  const now = Date.now();

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
      { error: "무료 체험이 끝났어요. 카카오 로그인하면 5크레딧을 무료로 받을 수 있어요!" },
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
    const {
      image,
      physioImage,
      shareId,
      mimeType,
      stylePrompt,
      scenes,
      genreMeta,
      physiognomy,
      promptTemplateId,
    } = await request.json();

    const normalizedScenes: GenerateScene[] = Array.isArray(scenes) ? scenes : [];
    const normalizedGenreMeta: GenerateGenreMeta[] = Array.isArray(genreMeta) ? genreMeta : [];
    const normalizedPhysiognomy: GeneratePhysiognomy = physiognomy && typeof physiognomy === "object"
      ? physiognomy
      : {};

    const referenceImage =
      typeof physioImage === "string" && physioImage.trim()
        ? physioImage
        : typeof image === "string" && image.trim()
          ? image
          : "";

    if (!referenceImage) {
      return NextResponse.json({ error: "관상용 정면 사진이 필요합니다." }, { status: 400 });
    }

    const bestSceneIdx = normalizedScenes.reduce((best, scene, index) => (
      averageSceneScore(scene) > averageSceneScore(normalizedScenes[best]) ? index : best
    ), 0);
    const bestScene = normalizedScenes[bestSceneIdx] ?? {};
    const bestGenreMeta = normalizedGenreMeta[bestSceneIdx] ?? normalizedGenreMeta.find((item) => item.genre === bestScene.genre) ?? {};
    const defaultPromptText = buildStillPrompt({
      genre: clampText(bestScene.genre, 32),
      cue: clampText(bestGenreMeta.cue, 96),
      assignedRole: clampText(bestScene.assigned_role, 40),
      archetype: clampText(normalizedPhysiognomy.archetype, 40),
      screenImpression: clampText(normalizedPhysiognomy.screen_impression, 72),
      castingFrame: clampText(normalizedPhysiognomy.casting_frame, 72),
      fallbackStylePrompt: clampText(stylePrompt ?? bestScene.style_prompt, 200),
    });

    let promptText = defaultPromptText;
    const resolvedTemplateId = resolvePromptTemplateId(promptTemplateId, clampText(bestScene.genre, 32));
    if (resolvedTemplateId) {
      const templatePrompt = await loadPromptTemplate(resolvedTemplateId);
      const sceneCueLine = clampText(bestGenreMeta.cue, 120);
      const roleLine = clampText(bestScene.assigned_role, 48);
      promptText = [
        templatePrompt,
        sceneCueLine ? `Scene cue to honor: ${sceneCueLine}.` : "",
        roleLine ? `Character role to embody: ${roleLine}.` : "",
      ].filter(Boolean).join("\n\n");
    }

    if (!promptText) {
      return NextResponse.json({ error: "스틸컷 생성용 장르 정보가 부족합니다." }, { status: 400 });
    }

    if (typeof shareId === "string" && shareId.trim()) {
      const { data: shareRow } = await createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )
        .from("audition_shares")
        .select("id, still_image_url")
        .eq("id", shareId.trim())
        .maybeSingle();

      if (shareRow?.still_image_url) {
        return NextResponse.json({ error: "스틸컷은 1회만 생성할 수 있어요." }, { status: 409 });
      }
    }

    // ── Mock 모드: API 호출 없이 원본 이미지를 그대로 반환 ─────────────
    if (process.env.MOCK_GEMINI === "true") {
      console.log("[MOCK] audition/generate — Gemini API 호출 생략, 원본 이미지 반환");
      return NextResponse.json({ image: referenceImage, mimeType: "image/jpeg" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const contents = [
      { inlineData: { mimeType: (mimeType || "image/jpeg") as "image/jpeg", data: referenceImage } },
      { text: promptText },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents,
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    let generatedImage: string | null = null;
    for (const part of parts) {
      if (part.inlineData) {
        generatedImage = session
          ? part.inlineData.data!
          : await addWatermark(part.inlineData.data!);
        break;
      }
    }
    if (!generatedImage) throw new Error("스틸컷 이미지 생성 실패");

    // 사용 횟수 로깅
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    ).from("style_usage").insert({ style_id: "audition" }).then(() => {});

    const res = NextResponse.json({ image: generatedImage, mimeType: "image/jpeg" });
    if (!session) res.cookies.set(GUEST_COOKIE, cookieValue, cookieOptions);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[audition/generate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
