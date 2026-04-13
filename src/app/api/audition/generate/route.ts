import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addWatermark } from "@/lib/watermark";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  assertBase64ImageSize,
  assertRequestBodySize,
  enforceAnonymousDailyLimit,
} from "@/lib/api-abuse-guard";
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

type LongformGenreId =
  | "action"
  | "comedy"
  | "crime"
  | "daily"
  | "fantasy"
  | "horror"
  | "melo"
  | "psycho"
  | "romance"
  | "thriller";

type LongformSectionKey =
  | "INTRO"
  | "POSE_EXPRESSION"
  | "SCENE"
  | "LIGHTING"
  | "FILTER_DREAM_EFFECT"
  | "PHOTO_STYLE"
  | "COLOR"
  | "MOOD"
  | "STRICT_RULES_APPEND"
  | "OUTPUT_TARGET_APPEND";

type LongformVariation = {
  title: string;
  sections: Record<LongformSectionKey, string>;
};

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

const LONGFORM_GENRE_BY_TEMPLATE: Record<GeneratePromptTemplateId, LongformGenreId> = {
  action: "action",
  comedy: "comedy",
  crime: "crime",
  daily: "daily",
  fantasy: "fantasy",
  horror: "horror",
  melo: "melo",
  psycho: "psycho",
  romance: "romance",
  thriller: "thriller",
  "thriller 2": "thriller",
};

const LONGFORM_SECTION_KEYS: LongformSectionKey[] = [
  "INTRO",
  "POSE_EXPRESSION",
  "SCENE",
  "LIGHTING",
  "FILTER_DREAM_EFFECT",
  "PHOTO_STYLE",
  "COLOR",
  "MOOD",
  "STRICT_RULES_APPEND",
  "OUTPUT_TARGET_APPEND",
];

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  return readSessionFromRequest(request);
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

const STILL_TEXT_BAN_BLOCK = [
  "ABSOLUTE TEXT BAN:",
  "- Do not generate subtitles, captions, dialogue text, title cards, credits, posters, signage, logos, watermarks, UI, stamps, labels, chat bubbles, or any graphic overlay.",
  "- Do not generate any readable Korean characters, English letters, numbers, punctuation, symbols, or typography anywhere in the image.",
  "- If the scene would naturally contain text-bearing objects, render them blank, obscured, defocused, or replaced with non-readable texture.",
  "- The final image must contain zero readable text of any kind.",
].join("\n");

async function loadPromptTemplate(templateId: GeneratePromptTemplateId) {
  const filePath = path.join(process.cwd(), "src/lib/styles/audition-prompts", `${templateId}.txt`);
  const content = await readFile(filePath, "utf8");
  return content.trim();
}

async function loadLongformMasterTemplate() {
  const filePath = path.join(process.cwd(), "src/lib/styles/audition-prompts/longform/MASTER_PROMPT_TEMPLATE.txt");
  const content = await readFile(filePath, "utf8");
  return content.trim();
}

async function loadLongformGenreFile(genreId: LongformGenreId) {
  const filePath = path.join(process.cwd(), "src/lib/styles/audition-prompts/longform", `${genreId}.md`);
  const content = await readFile(filePath, "utf8");
  return content.trim();
}

function parseLongformVariations(markdown: string): LongformVariation[] {
  const rawBlocks = markdown.split(/^## /m).slice(1);

  return rawBlocks.map((rawBlock) => {
    const normalizedBlock = rawBlock.trim();
    const firstLineBreak = normalizedBlock.indexOf("\n");
    const title = (firstLineBreak >= 0 ? normalizedBlock.slice(0, firstLineBreak) : normalizedBlock).trim();
    const body = firstLineBreak >= 0 ? normalizedBlock.slice(firstLineBreak + 1) : "";

    const sections = {} as Record<LongformSectionKey, string>;
    const sectionRegex = /^### ([A-Z_]+)\n([\s\S]*?)(?=^### [A-Z_]+\n|\Z)/gm;
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(body))) {
      const sectionKey = match[1] as LongformSectionKey;
      if (LONGFORM_SECTION_KEYS.includes(sectionKey)) {
        sections[sectionKey] = match[2].trim();
      }
    }

    return { title, sections };
  }).filter((variation) => LONGFORM_SECTION_KEYS.every((key) => Boolean(variation.sections[key])));
}

function replacePromptPlaceholders(template: string, values: Record<string, string>) {
  return template.replace(/{{([A-Z_]+)}}/g, (_match, key: string) => values[key] ?? "");
}

function renderLongformPrompt({
  masterTemplate,
  variation,
  values,
}: {
  masterTemplate: string;
  variation: LongformVariation;
  values: Record<string, string>;
}) {
  let output = masterTemplate;
  for (const sectionKey of LONGFORM_SECTION_KEYS) {
    output = output.replace(`{{${sectionKey}}}`, replacePromptPlaceholders(variation.sections[sectionKey], values));
  }
  return replacePromptPlaceholders(output, values);
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickVariationIndex(variationCount: number, seed: string) {
  if (variationCount <= 1) return 0;
  return hashSeed(seed) % variationCount;
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
  if (!session) {
    try {
      const allowed = await enforceAnonymousDailyLimit(request, {
        scope: "audition-still-generate",
        limit: GUEST_LIMIT,
      });

      if (!allowed) {
        return NextResponse.json(
          { error: "무료 체험이 끝났어요. 카카오 로그인하면 5크레딧을 무료로 받을 수 있어요!" },
          { status: 429 }
        );
      }
    } catch (error) {
      console.error("[audition/generate] anonymous throttle error:", error);
      return NextResponse.json(
        { error: "요청이 잠시 많아요. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }
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
    assertRequestBodySize(request, 18 * 1024 * 1024);
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
      selectedSceneIdx,
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
    try {
      assertBase64ImageSize(referenceImage, { label: "관상 사진" });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "이미지 확인에 실패했어요." },
        { status: 400 }
      );
    }

    const requestedSceneIdx = Number(selectedSceneIdx);
    const bestSceneIdx = normalizedScenes.length > 0
      ? Number.isInteger(requestedSceneIdx) && requestedSceneIdx >= 0 && requestedSceneIdx < normalizedScenes.length
        ? requestedSceneIdx
        : normalizedScenes.reduce((best, scene, index) => (
          averageSceneScore(scene) > averageSceneScore(normalizedScenes[best]) ? index : best
        ), 0)
      : 0;
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
      const sceneCueLine = clampText(bestGenreMeta.cue, 120);
      const roleLine = clampText(bestScene.assigned_role, 48);
      const longformGenreId = LONGFORM_GENRE_BY_TEMPLATE[resolvedTemplateId];

      try {
        const [masterTemplate, genreMarkdown] = await Promise.all([
          loadLongformMasterTemplate(),
          loadLongformGenreFile(longformGenreId),
        ]);
        const variations = parseLongformVariations(genreMarkdown);
        if (variations.length > 0) {
          const variationSeed = [
            clampText(referenceImage, 180),
            clampText(bestScene.genre, 32),
            sceneCueLine,
            roleLine,
            clampText(normalizedPhysiognomy.archetype, 40),
            clampText(normalizedPhysiognomy.screen_impression, 72),
            clampText(normalizedPhysiognomy.casting_frame, 72),
          ].join("|");
          const selectedVariation = variations[pickVariationIndex(variations.length, variationSeed)];
          promptText = renderLongformPrompt({
            masterTemplate,
            variation: selectedVariation,
            values: {
              SCENE_CUE: sceneCueLine || "a decisive dramatic moment",
              ASSIGNED_ROLE: roleLine || "scene-stealing supporting role",
              ARCHETYPE: clampText(normalizedPhysiognomy.archetype, 40) || "distinctive cinematic screen presence",
              SCREEN_IMPRESSION: clampText(normalizedPhysiognomy.screen_impression, 72) || "clear, memorable screen presence",
              CASTING_FRAME: clampText(normalizedPhysiognomy.casting_frame, 72) || "a strong, cinematic supporting-role presence",
            },
          });
        } else {
          throw new Error(`No longform variations parsed for ${longformGenreId}`);
        }
      } catch {
        const templatePrompt = await loadPromptTemplate(resolvedTemplateId);
        promptText = [
          templatePrompt,
          sceneCueLine ? `Scene cue to honor: ${sceneCueLine}.` : "",
          roleLine ? `Character role to embody: ${roleLine}.` : "",
        ].filter(Boolean).join("\n\n");
      }
    }

    if (!promptText) {
      return NextResponse.json({ error: "스틸컷 생성용 장르 정보가 부족합니다." }, { status: 400 });
    }

    promptText = [promptText, STILL_TEXT_BAN_BLOCK].join("\n\n");

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
