import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { addWatermark } from "@/lib/watermark";
import { STYLE_LABELS } from "@/lib/styles";
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

const STYLE_CONFIGS: Record<string, { temperature?: number; topP?: number; topK?: number }> = {};

// 2D 구조: STYLE_PROMPTS[styleId][variant]
// 서브 옵션이 없는 스타일은 "default" 키만 가짐
const STYLE_PROMPTS: Record<string, Record<string, string>> = {
  // v1 (2026-03-30): 복셀/블록 캐릭터 변환
  "voxel-character": {
    "default": "Transform this photo into a voxel block-art 3D character. Recreate the subject as a full-body blocky character built entirely from cubic voxel blocks.\\n\\nIDENTITY — PRESERVE THESE DETAILS:\\n- Clothing colors, patterns, and outfit composition: identical to original\\n- Hair color, hairstyle, and length: identical\\n- Skin tone: identical\\n- Accessories (glasses, jewelry, bag, hat): all included\\n- Overall proportions should reflect the original person\\n\\nVOXEL STYLE REQUIREMENTS:\\n- Full-body character visible from head to toe\\n- All body parts built from cubic voxel/block units\\n- Blocky pixel-art aesthetic — no smooth curves anywhere\\n- Face: simple square pixels for eyes (white blocks with dark pupils), minimal nose dot, simple flat mouth\\n- Hands: blocky square paddle hands — no individual fingers\\n- Feet: flat rectangular block shoes\\n\\nRENDERING:\\n- 3D voxel render with subtle directional shading on each block face\\n- Clean solid white background\\n- Slight 3/4 front-facing angle\\n- High resolution, perfectly sharp block edges\\n- Flat matte colors per block — no photorealistic textures\\n- Character fully centered, entire body in frame with small margin\\n\\nAESTHETIC: 3D block builder toy meets game character sprite. Colorful, fun, and immediately recognizable as the original person through their outfit and colors.",
  },
  // v4 (2026-03-31): 얼굴 각도/표정/구도 고정 강화
  "flash-selfie": {
    "default": "Apply a direct on-camera flash lighting effect to this photo. ONLY change the lighting. Change nothing else.\n\nFACE & IDENTITY — MUST BE PIXEL-PERFECT IDENTICAL:\n- The person's face direction, head tilt, and camera-facing angle must be exactly the same as the original\n- Eye gaze direction, eye openness, eyebrow position: identical\n- Mouth shape, smile or neutral expression: identical — do not alter even slightly\n- Same person, same face, same skin tone, same facial structure\n- Same hairstyle, hair color, hair position\n- Same clothing, accessories, body pose\n\nCOMPOSITION — MUST NOT CHANGE:\n- Same framing, same crop, same aspect ratio\n- Same camera-to-subject distance\n- Same background elements and their positions\n\nLIGHTING CHANGE ONLY:\n- Add harsh, bright frontal flash hitting the subject directly\n- Glossy light reflections and slight overexposure on skin\n- Hard-edged shadows cast behind the subject on walls/surfaces\n- Background darker than flash-lit foreground (vignette)\n- Smooth, airbrushed, slightly glossy skin finish from flash\n\nMOOD: iPhone night flash or Y2K digicam party shot feel. Slight digital noise.",
  },
  // v3 (2026-03-31): 헤어 + 얼굴 통합 강화
  "joseon-farmer": {
    "default": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- Wide dry Korean farmland, flat horizon, harvested field\n- Yellow-brown dry grass and soil\n- Pale overcast sky, flat harsh natural daylight\n- Holding a simple wooden farming tool (hoe or rake)\n- Full body visible head to toe\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",
  },
  // v4 (2026-03-31): 얼굴 보존 최우선 + 장면 합성
  "grab-selfie": {
    "default": "Composite this person into a motorcycle selfie scene. The face must be preserved exactly.\n\nFACE PRESERVATION — HIGHEST PRIORITY:\n- Copy the person's face from the original photo with zero changes\n- Face angle toward the camera: identical to the original photo\n- Head tilt and rotation: identical\n- Eye direction, eye openness: identical\n- Facial expression — every muscle position, smile or neutral: identical\n- Skin tone, facial features, hair: identical\n- Do NOT reinterpret or redraw the face. Transplant it as-is.\n\nSCENE: The person is the rear passenger on a motorcycle in a busy Southeast Asian city street, taking a high-angle selfie.\n\nSEATING: Person sits on the BACK SEAT behind the driver. Driver's back is visible in the lower foreground.\n\nCLOTHING: Replace any cold-weather clothing with lightweight summer clothes (casual short-sleeve shirt). Keep the face, hair, and accessories exactly as in the original.\n\nSCENE SETUP:\n- Person wears a plain solid-color helmet (no logos, no text) and black sunglasses\n- Driver in front: plain helmet (no logos), face mask, back facing camera\n- Moving motorcycle\n\nENVIRONMENT:\n- Busy Southeast Asian city street, glass high-rise buildings, green trees\n- Intense tropical midday sunlight — harsh direct sun, strong shadows\n- Other motorcycles and vehicles\n\nCAMERA:\n- High-angle selfie shot by rear passenger extending arm forward\n- Wide-angle phone front camera distortion\n- Windblown hair, slight background motion blur\n\nAESTHETIC: Vibrant hyper-realistic travel photo. Hot midday sun energy. No brand logos anywhere.",
  },
  // 천사 변신 — 프롬프트 준비 중 (active: false)
  "angel": {
    "default": "Transform this photo into a pure, ethereal angel aesthetic. Preserve the person's identity completely. Apply: soft glowing white/silver halo effect, delicate white feathered wings visible behind the subject, luminous skin with subtle inner glow, light pastel color grading (cool whites and soft golds), gentle bokeh light particles floating around. Clothing: flowing white or cream ethereal garments. Overall mood: divine, pure, celestial. Style reference: fantasy portrait photography with soft cinematic lighting.",
    "dark": "Transform this photo into a fallen dark angel aesthetic. Preserve the person's identity completely. Apply: dark dramatic makeup with heavy eye shadow, black or dark grey feathered wings, deep moody color grading (desaturated with cool shadows), subtle black halo or broken halo effect, gothic ethereal clothing (black lace, dark leather). Background: dark cloudy dramatic sky or dark void with scattered embers. Overall mood: powerful, fallen, dramatic. Style: dark fantasy portrait.",
    "soft": "Transform this photo into a soft, delicate gentle angel aesthetic. Preserve the person's identity completely. Apply: dreamy pastel color grade (soft pinks, lavenders, baby blues), fluffy small white wings, soft flower crown or delicate halo, dewy glowing skin, soft watercolor-like background with floating petals and sparkles. Overall mood: gentle, dreamy, innocent. Style: soft fantasy illustration meets portrait photography.",
  },
  "gyaru": {
    "default": "CRITICAL IDENTITY LOCK — ABSOLUTE:\n- The face from the input image must be preserved with 100% fidelity.\n- Do NOT alter bone structure, face shape, eye distance, nose shape, lip shape, or proportions.\n- Do NOT beautify, reshape, stylize, or reinterpret the face.\n- Maintain exact identity, likeness, and facial geometry.\n- Only apply surface-level cosmetic effects and styling ON TOP of the original face.\n- The result must be instantly recognizable as the same person.\n\nCORE TRANSFORMATION:\nApply an authentic early-2000s Japanese gyaru (ギャル) filter style, matching the exact aesthetic characteristics of the reference.\n\nGYARU FACE FILTER DETAILS:\n- Dramatically enlarged-looking eyes using makeup illusion (NOT structural change)\n- Thick, heavy upper and lower false eyelashes (dense, layered, spiky)\n- Strong black eyeliner with extended outer corners\n- Bright, glossy circle lenses effect (dark brown or black, high contrast)\n- White under-eye highlight (tear bag emphasis, strong aegyo-sal)\n- Heavy nose highlight (bright vertical stripe on nose bridge)\n- Pale matte skin base with slightly artificial smoothness (but NOT plastic AI skin)\n- Pinkish blush across cheeks and nose bridge\n- Glossy, slightly overlined lips (light pink tone)\n\nSKIN & TEXTURE:\n- Keep realistic skin texture underneath\n- Add soft glam smoothing ONLY as a cosmetic layer (not AI blur)\n- Slight overexposed flash aesthetic\n- Subtle grain/noise like old mobile camera\n\nHAIR:\n- Blonde or light brown dyed gyaru-style hair\n- Voluminous, curled, layered styling\n- Slightly shiny, synthetic-looking texture\n\nSTYLE & ACCESSORIES:\n- Leopard print elements (background or outfit)\n- Decorative stickers / sparkles / rhinestone UI overlays\n- Early 2000s Japanese purikura (プリクラ) aesthetic\n- Over-the-top feminine decoration\n\nCAMERA & LIGHTING:\n- Front-facing selfie angle\n- Slight top-down perspective\n- Direct flash lighting (harsh frontal light + shadow behind)\n- High exposure, slightly blown highlights\n\nCOLOR & TONE:\n- High contrast\n- Slightly warm tone\n- Candy-like saturation\n- Not cinematic, not realistic grading — must feel like retro Japanese photo booth / flip phone camera\n\nFRAME & UI:\n- Add decorative frame elements (pearls, sparkles, stickers)\n- Slight compression artifacts for authenticity\n- Optional Japanese text decoration (non-intrusive)\n\nSTRICT RULES:\n- NO face reshaping\n- NO identity drift\n- NO AI-style smoothing or plastic skin\n- NO modern influencer aesthetic\n- MUST look like real gyaru-era purikura photo\n\nFINAL GOAL:\nA perfect gyaru filter overlay applied to the original person, preserving identity 100%, while fully transforming the visual style into authentic gyaru culture.",
  },
};

// 레퍼런스 이미지 경로 배열 (public/ 기준)
// - 빈 배열 [] → 멀티모달 스킵 (텍스트 프롬프트만 사용)
// - 파일이 여러 개면 전부 Gemini에 전송 → 공통 스타일 추출
const STYLE_REFERENCES: Record<string, Record<string, string[]>> = {
  "voxel-character": { "default": [] },
  "flash-selfie":    { "default": [] },
  "joseon-farmer":   { "default": [] },
  "grab-selfie":     { "default": [] },
  "gyaru":           { "default": [] },
  // 천사 변신 — 레퍼런스 멀티모달 활성화
  "angel": {
    "dark": [
      "references/angel-dark-1.jpg",
      "references/angel-dark-2.jpg",
      "references/angel-dark-3.jpg",
    ],
    "soft": [
      "references/angel-soft-1.jpg",
      "references/angel-soft-2.jpg",
      "references/angel-soft-3.jpg",
    ],
  },
};

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  const now = Date.now();

  // ── 회원: 크레딧 차감 (원자적) ──────────────────────────────────────
  if (session) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: newCredits, error: deductError } = await supabase.rpc("deduct_credit", {
      p_user_id: session.id,
    });
    if (deductError || newCredits === null || newCredits === undefined) {
      return NextResponse.json(
        { error: "크레딧이 없어요. 충전 후 이용해주세요!" },
        { status: 429 }
      );
    }
  }

  // ── 비회원: 쿠키 기반 1회 무료 체험 ──────────────────────────────────
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
    const { style, imageBase64, mimeType, variant = "default" } = await request.json();

    const stylePrompts = STYLE_PROMPTS[style];
    const prompt = stylePrompts?.[variant] ?? stylePrompts?.["default"];
    if (!prompt) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }

    // 레퍼런스 이미지 로드 (존재하는 파일만, 없으면 단일 이미지 모드 fallback)
    const refPaths = STYLE_REFERENCES[style]?.[variant] ?? STYLE_REFERENCES[style]?.["default"] ?? [];
    const loadedRefs: string[] = [];
    for (const relPath of refPaths) {
      try {
        const abs = path.join(process.cwd(), "public", relPath);
        loadedRefs.push(fs.readFileSync(abs).toString("base64"));
      } catch { /* 파일 없음 — 스킵 */ }
    }

    const refCount = loadedRefs.length;
    const promptText = refCount === 0
      ? `Edit this image: ${prompt}`
      : refCount === 1
        ? `Image 1 is the original subject. Image 2 is the style reference. Extract identity from Image 1 and apply the exact style, color grading, and aesthetic of Image 2. Additional instructions: ${prompt}`
        : `Image 1 is the original subject. Images 2 to ${refCount + 1} are style references showing the target aesthetic. Extract identity from Image 1 and apply the common style, color grading, and aesthetic seen across all reference images. Additional instructions: ${prompt}`;

    const contents = [
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
      ...loadedRefs.map(b64 => ({ inlineData: { mimeType: "image/jpeg" as const, data: b64 } })),
      { text: promptText },
    ];

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const styleConfig = STYLE_CONFIGS[style];
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(styleConfig && {
          temperature: styleConfig.temperature,
          topP: styleConfig.topP,
          topK: styleConfig.topK,
        }),
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        // Supabase 로깅 — 실패해도 이미지 응답에 영향 없음
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
          );
          const { error } = await supabase.from("style_usage").insert({
            style_id: style,
            style_name: STYLE_LABELS[style] ?? style,
            user_id: session?.id ?? null,
            variant: variant ?? "default",
          });
          if (error) console.error("[Supabase] insert error:", error);

          if (session) {
            await supabase.from("user_events").insert({
              user_id: session.id,
              event_type: "transform",
              metadata: { style_id: style },
            });
          }
        } catch (err) {
          console.error("[Supabase] unexpected error:", err);
        }

        // 회원: clean 이미지 반환 (워터마크 없음)
        // 비회원: 워터마크 적용
        let imageData: string;
        if (session) {
          imageData = part.inlineData.data!;
        } else {
          imageData = await addWatermark(part.inlineData.data!);
        }

        const res = NextResponse.json({
          image: imageData,
          mimeType: "image/jpeg",
          shouldSaveHistory: !!session,
        });
        if (!session) res.cookies.set(GUEST_COOKIE, cookieValue, cookieOptions);
        return res;
      }
    }

    return NextResponse.json({ error: "No image generated" }, { status: 500 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
