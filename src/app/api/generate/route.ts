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
  // v3 (2026-03-31): 랜덤 3안 — v1 텍스트전용 / v2 ref-1 스타일 따라가기 / v3 ref-2 스타일 따라가기
  "joseon-farmer": {
    // v1 — 레퍼런스 없음, 순수 텍스트 프롬프트 (원본)
    "v1": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- Wide dry Korean farmland, flat horizon, harvested field\n- Yellow-brown dry grass and soil\n- Pale overcast sky, flat harsh natural daylight\n- Holding a simple wooden farming tool (hoe or rake)\n- Full body visible head to toe\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",

    // v3 — 자연/야외 씬 직접 묘사
    "v3": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- A natural outdoor rural hillside setting with rough rocks, uneven ground, and wild vegetation\n- Subject is seated directly on a rock or dirt surface, centered in frame\n- Background consists of dense, untrimmed plants, dry leaves, and natural terrain (not farmland horizon)\n- No visible modern elements, no structures, no artificial objects\n- Static, documentary composition with subject facing camera directly\n- Medium-to-full body framing (knees or full seated body visible), grounded posture\n- Natural, unposed, slightly weary expression\n- Lighting is flat natural daylight, slightly diffused, no dramatic shadows\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",

    // v5 — 스튜디오 씬 직접 묘사
    "v5": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nFACE — PRESERVE IDENTITY, INTEGRATE NATURALLY:\n- Preserve the person's facial features: bone structure, eye shape, nose, lips, proportions\n- Same expression and gaze direction\n- CRITICAL: The face must feel naturally integrated into the scene — same lighting direction, same contrast, same film grain texture as the rest of the image\n- The face must NOT look like it was pasted onto a different body\n- Match the neck and face seamlessly into the body and scene\n- Apply the same sepia/aged photo tone uniformly across the face and body\n- No beautification, no modern skin smoothing\n- Add surface weathering: sun damage, rough pores, uneven skin tone from outdoor labor\n\nHAIR — MUST CHANGE COMPLETELY:\n- Do NOT preserve the original hairstyle under any circumstances\n- Replace with authentic Joseon-era male farmer hair\n- Options: small topknot (상투) tied at the crown, OR very short roughly-cut hair typical of poor laborers\n- Hair must look unwashed, coarse, and unstyled\n- No modern haircut shapes, no volume, no styling\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants tied at ankles\n- Coarse, rough, worn fabric — visible fibers, stretched seams\n- Dirt stains, sweat marks embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- Neutral studio-like plain backdrop with no visible environment context\n- Flat wall or backdrop with subtle texture, slightly worn or aged surface\n- Subject standing upright, centered in frame, facing camera directly\n- Full body visible from head to bare feet\n- Feet grounded naturally, slightly apart, stable stance\n- Holding a simple thin stick or farming tool loosely in one hand\n- Minimal composition, no additional objects or scenery\n- Static, documentary posture with no stylization\n- Lighting is flat, frontal or slightly top-down natural light, evenly distributed, no dramatic shadows\n\nPHOTOGRAPH QUALITY:\n- Early 1900s glass plate photograph\n- Heavy coarse analog film grain across entire image including face\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening\n- Low contrast, washed-out highlights, lifted blacks\n- Sepia/warm brown overall tone applied uniformly to entire image\n- Slight degradation as if scanned from aged print\n- Feels like a 100+ year-old archived Korean photograph\n- Must NOT look like a filter or modern composite\n- Raw, documentary, physically aged",
  },
  // v4 (2026-03-31): 얼굴 보존 최우선 + 장면 합성
  "grab-selfie": {
    "default": "Composite this person into a motorcycle selfie scene. The face must be preserved exactly.\n\nFACE PRESERVATION — HIGHEST PRIORITY:\n- Copy the person's face from the original photo with zero changes\n- Face angle toward the camera: identical to the original photo\n- Head tilt and rotation: identical\n- Eye direction, eye openness: identical\n- Facial expression — every muscle position, smile or neutral: identical\n- Skin tone, facial features, hair: identical\n- Do NOT reinterpret or redraw the face. Transplant it as-is.\n\nSCENE: The person is the rear passenger on a motorcycle in a busy Southeast Asian city street, taking a high-angle selfie.\n\nSEATING: Person sits on the BACK SEAT behind the driver. Driver's back is visible in the lower foreground.\n\nCLOTHING: Replace any cold-weather clothing with lightweight summer clothes (casual short-sleeve shirt). Keep the face, hair, and accessories exactly as in the original.\n\nSCENE SETUP:\n- Person wears a plain solid-color helmet (no logos, no text) and black sunglasses\n- Driver in front: plain helmet (no logos), face mask, back facing camera\n- Moving motorcycle\n\nENVIRONMENT:\n- Busy Southeast Asian city street, glass high-rise buildings, green trees\n- Intense tropical midday sunlight — harsh direct sun, strong shadows\n- Other motorcycles and vehicles\n\nCAMERA:\n- High-angle selfie shot by rear passenger extending arm forward\n- Wide-angle phone front camera distortion\n- Windblown hair, slight background motion blur\n\nAESTHETIC: Vibrant hyper-realistic travel photo. Hot midday sun energy. No brand logos anywhere.",
  },
  // 천사 변신
  "angel": {
    "soft": `IDENTITY LOCK — NON-NEGOTIABLE:
The uploaded person's face must be preserved with 100% fidelity.
Keep the exact same bone structure, eye shape, nose, lips, proportions, and overall recognizable face.
Do NOT replace the person with a generic model or beautify into a different identity.
The result must be instantly recognizable as the same person from the original photo.
If any conflict arises between style and identity, preserve identity first.

TRANSFORMATION:
Place the uploaded person into a dreamy soft angel fantasy portrait.

FACE & MAKEUP:
- Preserve all facial features exactly
- Apply luminous ethereal makeup: shimmery white/iridescent eyeshadow, crystal glitter around eyes, rhinestone under-eye accents, glossy soft pink lips, dewy luminous skin with pearlescent glow
- Skin should feel illuminated from within — bright, heavenly, smooth but human

HAIR:
- Keep the person's original hairstyle recognizable
- Refine into a soft, silky, weightless angelic version
- Long flowing hair, smooth glossy texture, gentle volume

OUTFIT:
- Flowing white angel dress: chiffon gown, ivory draped fabric, or soft celestial robe
- Light, airy, elegant, modest but beautiful

WINGS:
- Large soft white feathered angel wings behind the body
- Fluffy, glittering, translucent-shimmering, luminous
- Wings should frame the upper body elegantly

POSE:
- Gentle seated pose inside clouds
- Soft body language: relaxed shoulders, slightly tilted head, delicate hand placement
- Calm, composed, fragile posture

EXPRESSION:
- Calm, slightly melancholic, dreamy distant gaze
- Soft parted lips, serene stillness
- No big smiles

BACKGROUND:
- Surreal heavenly cloudscape: oversized fluffy fantasy clouds, glittering mist, soft white fog
- Pale silver-white atmosphere, dreamy cloud chamber
- Clouds feel intentionally unreal, fantastical, immersive

LIGHTING:
- Soft diffused frontal light, gentle bloom and glow
- Slightly overexposed heavenly light, no harsh shadows
- Pearlescent reflections, low-shadow angelic illumination

COLOR PALETTE:
- White, pearl, ivory, silver, soft pastel pink, pale cool gray, iridescent shimmer
- Airy, luminous, clean

MOOD:
- Tender, mystical, fragile, innocent, dreamy, ethereal
- Like a soft angelic perfume campaign mixed with fantasy portrait photography

STRICT RULES:
- Do NOT change the person's identity
- Do NOT make it dark, gothic, or edgy
- Do NOT lose the softness, haze, and glow
- Do NOT make the clouds realistic; they must feel surreal and heavenly`,

    "dark": `Transform the uploaded selfie into a surreal "fallen angel / dark cupid" fantasy portrait with a raw flash-photo aesthetic, while preserving the exact identity of the uploaded person.

CORE GOAL:
This is a selfie-to-stylized-portrait transformation for a filter card product.
The final image must feel like a dramatic editorial fantasy photo made from the user's own face and body presence, not a new character.
Preserve the uploaded person's identity very strongly: same facial structure, same eye shape, same nose, same lips, same proportions, same recognizable face. Do not replace the person with another model. Keep the subject instantly recognizable as the original user.

IDENTITY PRESERVATION:
- Preserve 100% of the uploaded person's facial identity.
- Keep the original bone structure, face width, jawline, eye spacing, nose bridge, lip shape, skin tone family, and overall recognizable look.
- Do not beautify into a different person.
- Do not change ethnicity.
- Do not alter body type drastically.
- Do not generate a random fashion model face.
- The result must feel like the same person wearing a themed fantasy filter and entering a constructed visual world.

OVERALL CONCEPT:
A seductive celestial-underworld angel portrait, mixing innocent angel symbolism with slightly rebellious, smoky, decadent, dark-romantic energy.
The mood should combine:
- angel wings
- cherub / cupid motifs
- red hearts and small stars
- cigarette smoke
- dreamy clouds or smoky void
- soft sinful glamour
- low-budget DIY fantasy set energy mixed with editorial styling
- nostalgic 2000s flash photography
- surreal campy digital collage aesthetics
- feminine, emotionally distant, slightly dangerous, soft but provocative mood

VISUAL STYLE:
- direct on-camera flash photography
- raw digital camera look
- slightly overexposed skin highlights from flash
- visible specular glow on cheeks, forehead, nose, collarbone, shoulders, legs
- simple staged composition
- collage-like fantasy elements floating around the subject
- soft haze, smoke wisps, cloudy atmosphere
- intentionally artificial but stylish visual world
- not cinematic realism; more like flash-shot fantasy editorial mixed with internet-era surreal glamour
- playful but dark, heavenly but corrupted, glamorous but handmade, dreamy and eerie at the same time

COMPOSITION:
Create a centered or slightly off-centered single-subject portrait.
The uploaded person should dominate the frame as the main visual anchor.
Use a medium full-body or 3/4-body composition.
Allow large wings to spread behind the subject and fill a major portion of the image.
Arrange floating decorative elements around the subject in an intentionally stylized, poster-like composition.
The frame should feel like a staged fantasy portrait shot against a backdrop, not a casual real-world environment.

POSE DIRECTION:
- seated on an invisible ledge, cloud, flower-shaped platform, or soft surreal surface
- crouching in midair or floating with bent knees
- side-seated pose with one leg folded and one extended
- one hand touching face, chin, lips, hair, or cigarette
- slightly slouched, dreamy, detached posture
- elegant but sensual body language, relaxed shoulders, elongated neck, soft wrist angles

FACIAL EXPRESSION:
Detached, dreamy, sultry, melancholic.
- half-lidded eyes, distant upward gaze, sleepy eyes
- mildly bored or emotionally unavailable look
- subtly parted lips, soft pout, seductive blankness
Avoid smiling widely. The face should feel cool, moody, glamorous, and slightly sinful.

MAKEUP:
- metallic or glittery silver-white eyeshadow
- high-shine wet-look highlighter on cheekbones, nose bridge, eyelids, and brow bone
- glossy lips or softly blurred lipstick
- slightly frosted ethereal makeup finish
- optional glitter tear detail, shimmer under the eyes, pearl-like highlights
Makeup should look editorial and flash-reactive.

HAIR:
Keep the uploaded person's actual hairstyle recognizable, refined for fantasy portrait.
Long straight or softly waved hair, center part, slightly messy seductive texture.
Do not fully replace the hairstyle. The person must still look like themselves.

WARDROBE:
Short fitted angelic-glam mini dress: white glitter mini, white satin slip, ivory bodycon, black micro dress for darker variation, or shiny black latex mini dress.
Minimal, feminine, short, leg-revealing silhouette — satin, shimmer knit, or glitter stretch fabric.

WINGS:
Large dramatic feathered angel wings, sculptural and visually dominant.
Pure white, off-white, slightly silver, or metallic champagne feathers.
Positioned behind the subject's back, framing the body.
Feathers visible and layered, theatrical costume feel — not flat stickers.

OPTIONAL HEAD DETAILS:
Small halo or tiny devil horns (optional). Keep it simple and iconic.

HAND PROP:
Subject holds a lit cigarette near lips or cheek, exhaling soft thin smoke wisps drifting upward gently.

SURROUNDING DECORATIVE ELEMENTS:
Floating around the subject: tiny porcelain cherubs/cupids, glossy red heart icons, little glowing stars, small embers, cloud puffs, smoke trails.
Arranged like a surreal digital collage orbiting the subject — intentionally kitschy, symbolic, slightly chaotic but stylish.
Cherubs: white porcelain statue style, smooth doll-like, surreal campy and decorative — NOT realistic anatomical babies.

BACKGROUND:
Surreal fantasy backdrop: stormy gray cloudscape, soft foggy celestial void, warm dark gradient sky, or dusty red-brown infernal cloud haze.
Flat enough to support the subject clearly, rich enough to feel immersive and themed.

COLOR PALETTE:
White, silver, gray, pearl, smoke — with red heart accents. Or ivory + charcoal + soft blood-red.
Controlled and editorial. Not rainbow-colored.

LIGHTING:
Strong direct frontal flash. Hard, immediate, camera-mounted flash feeling.
Bright facial highlights, crisp illuminated skin against darker background.
Visible reflective hotspots on glossy makeup and skin.

SUBJECT PRIORITY:
1. face  2. wings and pose  3. outfit  4. floating symbolic objects  5. background atmosphere

NEGATIVE RULES:
- do not change identity or generate a completely different face
- do not make it painterly or hyper-cinematic
- do not remove the raw flash aesthetic
- do not create a crowded multi-person composition
- do not let props block the face
- do not make the cherubs too realistic or grotesque
- do not make it comedic or childish
- do not flatten the wings into a cheap sticker look
- do not lose the dreamy smoke and cloud atmosphere

FINAL OUTPUT TARGET:
A highly stylized flash-shot fantasy portrait of the uploaded user as a glamorous fallen angel / dark cupid figure, with preserved identity, large feathered wings, glossy shimmer makeup, short angelic or dark mini dress, cigarette and smoke, surreal floating cherubs, red heart icons, tiny stars, and a moody cloud-filled celestial-underworld backdrop.`,
  },
  "gyaru": {
    "default": "Transform this photo into an authentic early-2000s Japanese gyaru (ギャル) portrait style. Keep the person's identity intact — same face structure, same person.\n\nMAKEUP TRANSFORMATION:\n- Heavy dramatic eye makeup: thick layered false lashes, strong black eyeliner with extended outer corners\n- Dark dramatic contact lens effect (high contrast, enlarged-looking)\n- White shimmer highlight under the eyes (tear bag / aegyo-sal emphasis)\n- Bright vertical nose highlight stripe\n- Pale matte skin base with soft airbrushed finish\n- Pink blush across cheeks and nose bridge\n- Glossy light pink overlined lips\n\nHAIR:\n- Dye to blonde or light brown\n- Voluminous, curled, layered gyaru styling\n- Shiny, slightly synthetic-looking texture\n\nOUTFIT & BACKGROUND:\n- Leopard or animal print elements in outfit or background\n- Sparkly, rhinestone-style accessories\n- Feminine, over-the-top Y2K gyaru fashion\n\nPHOTO STYLE:\n- Front-facing selfie angle, slightly top-down\n- Direct flash lighting: overexposed skin highlights, high contrast\n- Warm candy-like color tone\n- Retro Japanese photo booth (purikura) aesthetic: slight grain, warm saturation\n\nSTRICT RULES:\n- Preserve the person's identity: same face, same bone structure\n- No face reshaping or identity change\n- Output must look like a real early-2000s gyaru photo",
  },
};

// 레퍼런스 이미지 경로 배열 (public/ 기준)
// - 빈 배열 [] → 멀티모달 스킵 (텍스트 프롬프트만 사용)
// - 파일이 여러 개면 전부 Gemini에 전송 → 공통 스타일 추출
const STYLE_REFERENCES: Record<string, Record<string, string[]>> = {
  "voxel-character": { "default": [] },
  "flash-selfie":    { "default": [] },
  "joseon-farmer": {
    "v1": [],
    "v3": [],
    "v5": [],
  },
  "grab-selfie":     { "default": [] },
  "gyaru":           { "default": [] },
  // 천사 변신 — 레퍼런스 멀티모달 활성화
  "angel": {
    "dark": [
      "references/angel-dark-1.jpg",
      "references/angel-dark-2.jpg",
      "references/angel-dark-3.jpg",
      "references/angel-dark-4.jpg",
    ],
    "soft": [
      "references/angel-soft-1.jpg",
      "references/angel-soft-2.jpg",
      "references/angel-soft-3.jpg",
      "references/angel-soft-4.jpg",
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

    // ── 로컬 Mock 모드 (MOCK_GEMINI=true 시 API 호출 없이 입력 이미지 그대로 반환) ──
    if (process.env.MOCK_GEMINI === "true") {
      console.log(`[MOCK] style=${style} variant=${variant} — Gemini API 호출 생략`);
      const res = NextResponse.json({
        image: imageBase64,
        mimeType: mimeType || "image/jpeg",
        shouldSaveHistory: false,
      });
      if (!session) res.cookies.set(GUEST_COOKIE, cookieValue, cookieOptions);
      return res;
    }

    // 레퍼런스 이미지 로드 (존재하는 파일만, 없으면 단일 이미지 모드 fallback)
    // 비용 절감을 위해 전체 리스트 중 랜덤하게 1개만 선택하여 보냄
    const refPaths = STYLE_REFERENCES[style]?.[variant] ?? STYLE_REFERENCES[style]?.["default"] ?? [];
    const chosenPath = refPaths.length > 0
      ? refPaths[Math.floor(Math.random() * refPaths.length)]
      : null;

    const loadedRefs: string[] = [];
    if (chosenPath) {
      try {
        const abs = path.join(process.cwd(), "public", chosenPath);
        console.log(`[ref] loading: ${abs}`);
        loadedRefs.push(fs.readFileSync(abs).toString("base64"));
        console.log(`[ref] loaded OK: ${chosenPath}`);
      } catch (e) {
        console.error(`[ref] load failed: ${chosenPath}`, e);
      }
    } else {
      console.log(`[ref] no ref — style=${style} variant=${variant}`);
    }

    const refCount = loadedRefs.length;

    const promptText = refCount === 0
      ? `Edit this image: ${prompt}`
      : `Image 1 is the original subject. Image 2 is the style reference. Extract identity from Image 1 and apply the exact style, color grading, and aesthetic of Image 2. Additional instructions: ${prompt}`;

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

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const parts = candidate?.content?.parts || [];

    // 이미지 없이 종료된 경우 원인 로그
    if (!parts.some(p => p.inlineData)) {
      const textParts = parts.filter(p => p.text).map(p => p.text).join(" ");
      console.error(`[generate] style=${style} finishReason=${finishReason} textResponse=${textParts || "(없음)"}`);
    }

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
    console.error("[generate] catch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
