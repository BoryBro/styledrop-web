import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const STYLE_PROMPTS: Record<string, string> = {
  "4k-upscale": "Upscale this image to ultra-high 4K resolution. Enhance all details, textures, and clarity significantly. Make the lighting dynamic and remove all noise and blur, resulting in a perfectly sharp, professional photorealistic image.",
  "flash-selfie": "Transform ONLY the lighting of this photo to look like an iPhone flash selfie.\nThe flash should create bright, slightly overexposed frontal lighting with subtle shadows behind the subject.\nCRITICAL: The subject's face, expression, pose, angle, composition, and every pixel of the subject MUST remain 100% identical to the original.\nOnly the light source and lighting atmosphere changes. Nothing else."
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
