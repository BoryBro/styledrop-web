import { NextRequest, NextResponse } from "next/server";
import { saveStyleControls } from "@/lib/style-controls.server";
import type { StyleControlRow } from "@/lib/style-controls";

export async function POST(request: NextRequest) {
  const { password, controls } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await saveStyleControls(Array.isArray(controls) ? (controls as StyleControlRow[]) : []);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장 실패";
    return NextResponse.json(
      {
        error: message.includes("admin_style_controls")
          ? "Supabase에 supabase/admin_style_controls.sql 을 먼저 적용해주세요."
          : message,
      },
      { status: 500 }
    );
  }
}
