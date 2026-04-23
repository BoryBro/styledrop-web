import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PROMPT_DIR = path.join(process.cwd(), "src/lib/styles/general-card-prompts");

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

function cleanStyleId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const styleId = value.trim();
  if (!/^[a-z0-9-]+$/.test(styleId)) return null;
  return styleId;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawStyles: unknown[] = Array.isArray(body?.styles) ? body.styles : [];
  const styles = rawStyles
    .map(cleanStyleId)
    .filter((style): style is string => Boolean(style));

  const uniqueStyles = [...new Set(styles)].slice(0, 5);
  if (uniqueStyles.length === 0) {
    return NextResponse.json({ error: "styles required" }, { status: 400 });
  }

  const promptBlocks = await Promise.all(
    uniqueStyles.map(async (styleId) => {
      const filePath = path.join(PROMPT_DIR, `${styleId}.txt`);
      try {
        const prompt = await readFile(filePath, "utf8");
        return `===== ${styleId} =====\n${prompt.trim()}`;
      } catch {
        return `===== ${styleId} =====\n프롬프트 파일을 찾지 못했습니다.`;
      }
    })
  );

  return NextResponse.json({ prompt: promptBlocks.join("\n\n") });
}
