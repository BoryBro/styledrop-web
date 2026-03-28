import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// In-memory rate limiter: IP → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

const STYLE_NAMES: Record<string, string> = {
  "flash-selfie": "플래시 필터(무료)",
  "4k-upscale": "4K 업스케일링(무료)",
  "grab-selfie": "그랩 셀카(무료)",
};

const STYLE_PROMPTS: Record<string, string> = {
  "4k-upscale": "Upscale this image to ultra-high 4K resolution. Enhance all details, textures, and clarity significantly. Make the lighting dynamic and remove all noise and blur, resulting in a perfectly sharp, professional photorealistic image.",
  // v3 (긍정형 전환 — API 최적화)
  "flash-selfie": "Transform this photo into a direct on-camera flash photography style.\n\nIDENTITY: Keep the same person, same face, same expression, same pose, same body, same clothing, same accessories, same hairstyle. The subject looks identical to the original photo.\n\nCOMPOSITION: Maintain the original framing, camera angle, and aspect ratio exactly.\n\nLIGHTING TRANSFORMATION:\n- Add harsh, bright frontal flash hitting the subject directly\n- Create glossy light reflections and slight overexposure on skin surfaces\n- Add hard-edged shadows cast on walls and surfaces behind the subject\n- Darken the background noticeably compared to the flash-lit foreground\n- Overall vignette effect: bright center, darker edges\n\nSKIN FINISH: Smooth, airbrushed, slightly glossy skin texture from the flash light. Flawless, soft, glowing skin like a high-end beauty filter.\n\nMOOD: Casual candid snapshot feeling — like an iPhone night flash photo or Y2K digicam party shot. Slight digital noise, imperfect auto-exposure look.",
  // v2 (backup, 2026-03-28): "Transform this image into a raw, direct-flash photography style.\nSUBJECT PRESERVATION: Do NOT change the person's face, identity, facial features, body shape, hairstyle, clothing, outfit details, or accessories. Keep the exact same composition, framing, camera angle, and aspect ratio as the original.\nCRITICAL LIGHTING INSTRUCTIONS:\n1. The subject MUST be aggressively illuminated by a harsh, direct on-camera flash.\n2. Create slight overexposure and glossy light reflections on the skin.\n3. Cast hard flash shadows on the wall and surfaces directly behind the subject. Shadows should fall naturally in the direction away from the flash source, not as an outline or halo around the subject's silhouette.\n4. The background MUST be noticeably darker than the foreground (strong vignette effect).\nSKIN RETOUCHING MUST BE APPLIED: Apply a flawless, airbrushed skin effect. Smooth out all blemishes, pores, and uneven textures. The skin MUST look incredibly soft, glowing, and perfectly retouched, like a high-end beauty filter, heavily contrasting with the harsh flash lighting.\nKeep the exact person, body, and pose identical to the original, but completely overhaul the lighting atmosphere to match an authentic Y2K digicam or iPhone night flash."
  // v1 (backup): "Transform this image into a raw, direct-flash photography style.\nCRITICAL LIGHTING INSTRUCTIONS:\n1. The subject MUST be aggressively illuminated by a harsh, direct on-camera flash.\n2. Create slight overexposure and glossy light reflections on the skin.\n3. You MUST generate hard, distinct black shadows immediately behind the subject's outline.\n4. The background MUST be noticeably darker than the foreground (strong vignette effect).\nSKIN RETOUCHING MUST BE APPLIED: Apply a flawless, airbrushed skin effect. Smooth out all blemishes, pores, and uneven textures. The skin MUST look incredibly soft, glowing, and perfectly retouched, like a high-end beauty filter, heavily contrasting with the harsh flash lighting.\nKeep the exact person, body, and pose identical to the original, but completely overhaul the lighting atmosphere to match an authentic Y2K digicam or iPhone night flash."
  "grab-selfie": "Place this person on the back of a motorcycle in a busy city street, taking a high-angle selfie.\n\nPERSON: Keep the same face, same facial features, same expression from the original photo. The person is the passenger on the motorcycle.\n\nSCENE SETUP:\n- The person wears a green Grab helmet and black sunglasses\n- A motorcycle driver sits in front, wearing a green polo shirt, green Grab helmet, and a face mask\n- Both are on a moving motorcycle\n\nENVIRONMENT:\n- Bustling Southeast Asian city street with glass high-rise buildings\n- Other motorcycles and vehicles sharing the road\n- Green trees lining the street\n- Overcast daylight, natural outdoor lighting\n\nCAMERA & COMPOSITION:\n- High-angle selfie perspective, shot from the passenger extended arm\n- Wide-angle lens distortion typical of a phone front camera\n- Motion feel: windblown hair, slight motion blur on background\n\nAESTHETIC: Vibrant, energetic travel photo. The atmosphere of riding through a modern Asian city. Clear, busy, alive."
};

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해주세요. (1시간에 최대 10회 요청 가능)" },
      { status: 429 }
    );
  }

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
          });
          if (error) console.error("[Supabase] insert error:", error);
        } catch (err) {
          console.error("[Supabase] unexpected error:", err);
        }

        return NextResponse.json({
          image: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        });
      }
    }

    return NextResponse.json({ error: "No image generated" }, { status: 500 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
