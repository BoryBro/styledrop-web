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

const STYLE_NAMES: Record<string, string> = {
  "flash-selfie": "플래시 필터",
  "4k-upscale": "4K 업스케일링",
  "grab-selfie": "베트남 오토바이 셀카",
  "voxel-character": "픽셀 캐릭터",
  "joseon-farmer": "조선시대 농부",
};

const STYLE_PROMPTS: Record<string, string> = {
  "4k-upscale": "Upscale this image to ultra-high 4K resolution. Enhance all details, textures, and clarity significantly. Make the lighting dynamic and remove all noise and blur, resulting in a perfectly sharp, professional photorealistic image.",
  // v1 (2026-03-30): 복셀/블록 캐릭터 변환
  "voxel-character": "Transform this photo into a voxel block-art 3D character. Recreate the subject as a full-body blocky character built entirely from cubic voxel blocks.\\n\\nIDENTITY — PRESERVE THESE DETAILS:\\n- Clothing colors, patterns, and outfit composition: identical to original\\n- Hair color, hairstyle, and length: identical\\n- Skin tone: identical\\n- Accessories (glasses, jewelry, bag, hat): all included\\n- Overall proportions should reflect the original person\\n\\nVOXEL STYLE REQUIREMENTS:\\n- Full-body character visible from head to toe\\n- All body parts built from cubic voxel/block units\\n- Blocky pixel-art aesthetic — no smooth curves anywhere\\n- Face: simple square pixels for eyes (white blocks with dark pupils), minimal nose dot, simple flat mouth\\n- Hands: blocky square paddle hands — no individual fingers\\n- Feet: flat rectangular block shoes\\n\\nRENDERING:\\n- 3D voxel render with subtle directional shading on each block face\\n- Clean solid white background\\n- Slight 3/4 front-facing angle\\n- High resolution, perfectly sharp block edges\\n- Flat matte colors per block — no photorealistic textures\\n- Character fully centered, entire body in frame with small margin\\n\\nAESTHETIC: 3D block builder toy meets game character sprite. Colorful, fun, and immediately recognizable as the original person through their outfit and colors.",
  // v4 (2026-03-31): 얼굴 각도/표정/구도 고정 강화
  "flash-selfie": "Apply a direct on-camera flash lighting effect to this photo. ONLY change the lighting. Change nothing else.\n\nFACE & IDENTITY — MUST BE PIXEL-PERFECT IDENTICAL:\n- The person's face direction, head tilt, and camera-facing angle must be exactly the same as the original\n- Eye gaze direction, eye openness, eyebrow position: identical\n- Mouth shape, smile or neutral expression: identical — do not alter even slightly\n- Same person, same face, same skin tone, same facial structure\n- Same hairstyle, hair color, hair position\n- Same clothing, accessories, body pose\n\nCOMPOSITION — MUST NOT CHANGE:\n- Same framing, same crop, same aspect ratio\n- Same camera-to-subject distance\n- Same background elements and their positions\n\nLIGHTING CHANGE ONLY:\n- Add harsh, bright frontal flash hitting the subject directly\n- Glossy light reflections and slight overexposure on skin\n- Hard-edged shadows cast behind the subject on walls/surfaces\n- Background darker than flash-lit foreground (vignette)\n- Smooth, airbrushed, slightly glossy skin finish from flash\n\nMOOD: iPhone night flash or Y2K digicam party shot feel. Slight digital noise.",
  // v2 (2026-03-31): 리얼리티 강화, 날것 질감, 손채색 사진 재현
  "joseon-farmer": "Transform this photo into a Joseon Dynasty Korean farmer portrait.\n\nThis must look like a real historical photograph from 1900–1920s Korea — completely unretouched, raw, aged, and documentary. Not artistic. Not stylized. Real.\n\nCRITICAL IDENTITY LOCK — ABSOLUTE PRIORITY:\n- The face must be treated as a fixed, non-generative region\n- DO NOT reinterpret, redraw, reconstruct, or stylize the face in any way\n- Preserve exact facial geometry at pixel-level accuracy\n- Same bone structure, same eye shape, same nose, same lips, same proportions\n- Same expression and gaze direction\n- The face must look like it was directly preserved from the original image, not AI-generated\n- No beautification, no smoothing, no symmetry correction\n- No face enhancement of any kind\n- No lighting change applied specifically to the face\n\nFACE TEXTURE (NON-DESTRUCTIVE ONLY):\n- Apply only surface-level texture overlay\n- Add sun damage, rough pores, uneven tone, weathered skin\n- Skin must feel aged, leathery, and exposed to harsh outdoor labor\n- IMPORTANT: texture must NOT alter structure or proportions\n\nSTRICT RULE:\n- Identity must be instantly recognizable\n- If facial structure changes even slightly, the result is incorrect\n\nSTRICT SEPARATION LOGIC:\n- Face = preserve (no generation)\n- Everything else = transform\n\nCLOTHING:\n- Traditional Korean hemp work clothing (삼베옷)\n- Loose jeogori top and wide baji pants\n- Pants tied at ankles with cloth strips\n- Fabric must look coarse, rough, and worn\n- Visible fibers, stretched seams, imperfections\n- Dirt stains, sweat marks, discoloration embedded into fabric\n- No clean edges, no modern tailoring\n\nSCENE:\n- Wide, dry Korean farmland or village path\n- Flat horizon with harvested field\n- Yellow-brown dry grass and soil\n- Pale, overcast sky\n- Flat, harsh natural daylight (no cinematic lighting)\n- Slight dust in air, dry environment\n- Holding a simple wooden farming tool (hoe or rake)\n\nPHOTOGRAPH QUALITY — BASE:\n- Early 1900s glass plate photograph look\n- Heavy, coarse analog film grain (not digital noise)\n- Slight global softness, no sharp edges\n- No HDR, no digital sharpening, no modern clarity\n- Slight blur in edges and background\n- Low contrast overall\n- Washed-out highlights, lifted blacks\n- Faded tonal range\n- Subtle degradation as if scanned from aged print\n\nREFERENCE HISTORICAL TEXTURE — EXACT MATCH:\nTONE & COLOR:\n- Base must feel like sepia-toned black-and-white\n- Warm brown / yellow overall cast\n- Whites are slightly yellowed, not pure white\n- Skin tones are uneven, slightly desaturated, with brown/gray variation\n- Sky is faint pale blue but very washed out\n\nCOLOR APPLICATION:\n- Colors must look hand-tinted over monochrome base\n- Uneven manual color application\n- Slight color bleeding beyond edges (imprecise boundaries)\n- No clean digital color separation\n- Some areas more saturated than others (inconsistent tint)\n\nTEXTURE & DETAIL LOSS:\n- Slight blur and softness across entire image\n- No modern crispness anywhere\n- Fine irregular analog grain structure\n- Minor edge bleeding and softness around contours\n\nCONTRAST & EXPOSURE:\n- Flat tonal range\n- Blacks are not deep black\n- Highlights are slightly faded and dull\n- Overall washed and aged look\n\nAGING EFFECT:\n- Subtle fading across image\n- Slight tonal inconsistency\n- Feels like a 100+ year-old archived photograph\n- Mild scan-like degradation and micro artifacts\n\nFINAL OUTPUT RULE:\n- Must feel like a real archived Korean historical photograph\n- Must NOT look like a filter, CGI, or stylized artwork\n- Must NOT feel cinematic or modern\n- Must feel raw, documentary, and physically aged\n- The person must be immediately recognizable as the same individual from the original image",
  // v4 (2026-03-31): 얼굴 보존 최우선 + 장면 합성
  "grab-selfie": "Composite this person into a motorcycle selfie scene. The face must be preserved exactly.\n\nFACE PRESERVATION — HIGHEST PRIORITY:\n- Copy the person's face from the original photo with zero changes\n- Face angle toward the camera: identical to the original photo\n- Head tilt and rotation: identical\n- Eye direction, eye openness: identical\n- Facial expression — every muscle position, smile or neutral: identical\n- Skin tone, facial features, hair: identical\n- Do NOT reinterpret or redraw the face. Transplant it as-is.\n\nSCENE: The person is the rear passenger on a motorcycle in a busy Southeast Asian city street, taking a high-angle selfie.\n\nSEATING: Person sits on the BACK SEAT behind the driver. Driver's back is visible in the lower foreground.\n\nCLOTHING: Replace any cold-weather clothing with lightweight summer clothes (casual short-sleeve shirt). Keep the face, hair, and accessories exactly as in the original.\n\nSCENE SETUP:\n- Person wears a plain solid-color helmet (no logos, no text) and black sunglasses\n- Driver in front: plain helmet (no logos), face mask, back facing camera\n- Moving motorcycle\n\nENVIRONMENT:\n- Busy Southeast Asian city street, glass high-rise buildings, green trees\n- Intense tropical midday sunlight — harsh direct sun, strong shadows\n- Other motorcycles and vehicles\n\nCAMERA:\n- High-angle selfie shot by rear passenger extending arm forward\n- Wide-angle phone front camera distortion\n- Windblown hair, slight background motion blur\n\nAESTHETIC: Vibrant hyper-realistic travel photo. Hot midday sun energy. No brand logos anywhere."
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
    const { style, imageBase64, mimeType } = await request.json();

    const prompt = STYLE_PROMPTS[style];
    if (!prompt) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
        { text: "Edit this image: " + prompt }
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"]
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
            style_name: STYLE_NAMES[style] ?? style,
            user_id: session?.id ?? null,
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
