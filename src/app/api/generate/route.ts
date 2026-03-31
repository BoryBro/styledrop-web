import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addWatermark } from "@/lib/watermark";
import {
  GUEST_LIMIT, USER_LIMIT, WINDOW_MS,
  GUEST_COOKIE, USER_COOKIE,
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
  "flash-selfie": "플래시 필터(무료)",
  "4k-upscale": "4K 업스케일링(무료)",
  "grab-selfie": "그랩 셀카(무료)",
  "voxel-character": "복셀 캐릭터(무료)",
};

const STYLE_PROMPTS: Record<string, string> = {
  "4k-upscale": "Upscale this image to ultra-high 4K resolution. Enhance all details, textures, and clarity significantly. Make the lighting dynamic and remove all noise and blur, resulting in a perfectly sharp, professional photorealistic image.",
  // v1 (2026-03-30): 복셀/블록 캐릭터 변환
  "voxel-character": "Transform this photo into a voxel block-art 3D character. Recreate the subject as a full-body blocky character built entirely from cubic voxel blocks.\\n\\nIDENTITY — PRESERVE THESE DETAILS:\\n- Clothing colors, patterns, and outfit composition: identical to original\\n- Hair color, hairstyle, and length: identical\\n- Skin tone: identical\\n- Accessories (glasses, jewelry, bag, hat): all included\\n- Overall proportions should reflect the original person\\n\\nVOXEL STYLE REQUIREMENTS:\\n- Full-body character visible from head to toe\\n- All body parts built from cubic voxel/block units\\n- Blocky pixel-art aesthetic — no smooth curves anywhere\\n- Face: simple square pixels for eyes (white blocks with dark pupils), minimal nose dot, simple flat mouth\\n- Hands: blocky square paddle hands — no individual fingers\\n- Feet: flat rectangular block shoes\\n\\nRENDERING:\\n- 3D voxel render with subtle directional shading on each block face\\n- Clean solid white background\\n- Slight 3/4 front-facing angle\\n- High resolution, perfectly sharp block edges\\n- Flat matte colors per block — no photorealistic textures\\n- Character fully centered, entire body in frame with small margin\\n\\nAESTHETIC: 3D block builder toy meets game character sprite. Colorful, fun, and immediately recognizable as the original person through their outfit and colors.",
  // v4 (2026-03-31): 얼굴 각도/표정/구도 고정 강화
  "flash-selfie": "Apply a direct on-camera flash lighting effect to this photo. ONLY change the lighting. Change nothing else.\n\nFACE & IDENTITY — MUST BE PIXEL-PERFECT IDENTICAL:\n- The person's face direction, head tilt, and camera-facing angle must be exactly the same as the original\n- Eye gaze direction, eye openness, eyebrow position: identical\n- Mouth shape, smile or neutral expression: identical — do not alter even slightly\n- Same person, same face, same skin tone, same facial structure\n- Same hairstyle, hair color, hair position\n- Same clothing, accessories, body pose\n\nCOMPOSITION — MUST NOT CHANGE:\n- Same framing, same crop, same aspect ratio\n- Same camera-to-subject distance\n- Same background elements and their positions\n\nLIGHTING CHANGE ONLY:\n- Add harsh, bright frontal flash hitting the subject directly\n- Glossy light reflections and slight overexposure on skin\n- Hard-edged shadows cast behind the subject on walls/surfaces\n- Background darker than flash-lit foreground (vignette)\n- Smooth, airbrushed, slightly glossy skin finish from flash\n\nMOOD: iPhone night flash or Y2K digicam party shot feel. Slight digital noise.",
  // v2 (backup, 2026-03-28): "Transform this image into a raw, direct-flash photography style.\nSUBJECT PRESERVATION: Do NOT change the person's face, identity, facial features, body shape, hairstyle, clothing, outfit details, or accessories. Keep the exact same composition, framing, camera angle, and aspect ratio as the original.\nCRITICAL LIGHTING INSTRUCTIONS:\n1. The subject MUST be aggressively illuminated by a harsh, direct on-camera flash.\n2. Create slight overexposure and glossy light reflections on the skin.\n3. Cast hard flash shadows on the wall and surfaces directly behind the subject. Shadows should fall naturally in the direction away from the flash source, not as an outline or halo around the subject's silhouette.\n4. The background MUST be noticeably darker than the foreground (strong vignette effect).\nSKIN RETOUCHING MUST BE APPLIED: Apply a flawless, airbrushed skin effect. Smooth out all blemishes, pores, and uneven textures. The skin MUST look incredibly soft, glowing, and perfectly retouched, like a high-end beauty filter, heavily contrasting with the harsh flash lighting.\nKeep the exact person, body, and pose identical to the original, but completely overhaul the lighting atmosphere to match an authentic Y2K digicam or iPhone night flash."
  // v1 (backup): "Transform this image into a raw, direct-flash photography style.\nCRITICAL LIGHTING INSTRUCTIONS:\n1. The subject MUST be aggressively illuminated by a harsh, direct on-camera flash.\n2. Create slight overexposure and glossy light reflections on the skin.\n3. You MUST generate hard, distinct black shadows immediately behind the subject's outline.\n4. The background MUST be noticeably darker than the foreground (strong vignette effect).\nSKIN RETOUCHING MUST BE APPLIED: Apply a flawless, airbrushed skin effect. Smooth out all blemishes, pores, and uneven textures. The skin MUST look incredibly soft, glowing, and perfectly retouched, like a high-end beauty filter, heavily contrasting with the harsh flash lighting.\nKeep the exact person, body, and pose identical to the original, but completely overhaul the lighting atmosphere to match an authentic Y2K digicam or iPhone night flash."
  // v4 (2026-03-31): 얼굴 보존 최우선 + 장면 합성
  "grab-selfie": "Composite this person into a motorcycle selfie scene. The face must be preserved exactly.\n\nFACE PRESERVATION — HIGHEST PRIORITY:\n- Copy the person's face from the original photo with zero changes\n- Face angle toward the camera: identical to the original photo\n- Head tilt and rotation: identical\n- Eye direction, eye openness: identical\n- Facial expression — every muscle position, smile or neutral: identical\n- Skin tone, facial features, hair: identical\n- Do NOT reinterpret or redraw the face. Transplant it as-is.\n\nSCENE: The person is the rear passenger on a motorcycle in a busy Southeast Asian city street, taking a high-angle selfie.\n\nSEATING: Person sits on the BACK SEAT behind the driver. Driver's back is visible in the lower foreground.\n\nCLOTHING: Replace any cold-weather clothing with lightweight summer clothes (casual short-sleeve shirt). Keep the face, hair, and accessories exactly as in the original.\n\nSCENE SETUP:\n- Person wears a plain solid-color helmet (no logos, no text) and black sunglasses\n- Driver in front: plain helmet (no logos), face mask, back facing camera\n- Moving motorcycle\n\nENVIRONMENT:\n- Busy Southeast Asian city street, glass high-rise buildings, green trees\n- Intense tropical midday sunlight — harsh direct sun, strong shadows\n- Other motorcycles and vehicles\n\nCAMERA:\n- High-angle selfie shot by rear passenger extending arm forward\n- Wide-angle phone front camera distortion\n- Windblown hair, slight background motion blur\n\nAESTHETIC: Vibrant hyper-realistic travel photo. Hot midday sun energy. No brand logos anywhere."
  // v1 (backup): "Place this person on the back of a motorcycle in a busy city street, taking a high-angle selfie.\n\nPERSON: Keep the same face, same facial features, same expression from the original photo. The person is the passenger on the motorcycle.\n\nSCENE SETUP:\n- The person wears a green Grab helmet and black sunglasses\n- A motorcycle driver sits in front, wearing a green polo shirt, green Grab helmet, and a face mask\n- Both are on a moving motorcycle\n\nENVIRONMENT:\n- Bustling Southeast Asian city street with glass high-rise buildings\n- Other motorcycles and vehicles sharing the road\n- Green trees lining the street\n- Overcast daylight, natural outdoor lighting\n\nCAMERA & COMPOSITION:\n- High-angle selfie perspective, shot from the passenger extended arm\n- Wide-angle lens distortion typical of a phone front camera\n- Motion feel: windblown hair, slight motion blur on background\n\nAESTHETIC: Vibrant, energetic travel photo. The atmosphere of riding through a modern Asian city. Clear, busy, alive."
};

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  const cookieName = session ? USER_COOKIE : GUEST_COOKIE;
  const limit = session ? USER_LIMIT : GUEST_LIMIT;
  const now = Date.now();

  const raw = request.cookies.get(cookieName)?.value;
  const data = parseLimitCookie(raw);
  let count = 0;
  let resetAt = now + WINDOW_MS;
  if (data && now < data.resetAt) {
    count = data.count;
    resetAt = data.resetAt;
  }

  if (count >= limit) {
    const error = session
      ? "오늘 사용량을 모두 소진했습니다. 내일 다시 이용해주세요!"
      : "무료 체험이 끝났습니다. 카카오 로그인하면 하루 10회까지 무료로 이용할 수 있어요!";
    return NextResponse.json({ error }, { status: 429 });
  }

  const newCount = count + 1;
  const cookieValue = encodeLimitCookie({ count: newCount, resetAt });
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
        // Supabase 로깅 + clean 이미지 저장 — 실패해도 이미지 응답에 영향 없음
        let imageKey: string | null = null;
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

          // clean 이미지 임시 저장 (워터마크 제거 시 사용)
          const { data: tempImg } = await supabase
            .from("temp_images")
            .insert({ clean_data: part.inlineData.data!, user_id: session?.id ?? null })
            .select("id")
            .single();
          imageKey = tempImg?.id ?? null;
        } catch (err) {
          console.error("[Supabase] unexpected error:", err);
        }

        // 워터마크 적용 (크레딧 차감 없이 사용 시 항상 적용)
        const watermarked = await addWatermark(part.inlineData.data!);

        const res = NextResponse.json({
          image: watermarked,
          mimeType: "image/jpeg",
          shouldSaveHistory: !!session,
          imageKey,
        });
        res.cookies.set(cookieName, cookieValue, cookieOptions);
        return res;
      }
    }

    return NextResponse.json({ error: "No image generated" }, { status: 500 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
