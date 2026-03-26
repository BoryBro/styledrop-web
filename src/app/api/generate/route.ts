import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const STYLE_PROMPTS: Record<string, string> = {
  "4k-upscale": "Upscale this image to ultra-high 4K resolution. Enhance all details, textures, and clarity significantly. Make the lighting dynamic and remove all noise and blur, resulting in a perfectly sharp, professional photorealistic image.",
  "flash-selfie": "Transform this image into a raw, direct-flash photography style.\nCRITICAL LIGHTING INSTRUCTIONS:\n1. The subject MUST be aggressively illuminated by a harsh, direct on-camera flash.\n2. Create slight overexposure and glossy light reflections on the skin.\n3. You MUST generate hard, distinct black shadows immediately behind the subject's outline.\n4. The background MUST be noticeably darker than the foreground (strong vignette effect).\nKeep the exact person, body, and pose identical to the original, but completely overhaul the lighting atmosphere to match an authentic Y2K digicam or iPhone night flash."
};

export async function POST(request: NextRequest) {
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
