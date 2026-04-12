import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// GET /api/profile  — instagram_handle 조회
export async function GET(req: NextRequest) {
  const session = parseSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase()
    .from("users")
    .select("instagram_handle")
    .eq("id", session.id)
    .single();

  if (error) return NextResponse.json({ instagram_handle: null });
  return NextResponse.json({ instagram_handle: data?.instagram_handle ?? null });
}

// PATCH /api/profile  — instagram_handle 저장/삭제
export async function PATCH(req: NextRequest) {
  const session = parseSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw: string = body.instagram_handle ?? "";

  // @ 제거, 소문자, 공백 제거, 30자 제한
  const handle = raw.replace(/^@+/, "").trim().toLowerCase().slice(0, 30);

  // 유효성: 영문·숫자·_·. 만 허용 (인스타 ID 규칙)
  if (handle && !/^[a-z0-9_.]{1,30}$/.test(handle)) {
    return NextResponse.json(
      { error: "영문, 숫자, 밑줄(_), 마침표(.)만 사용할 수 있어요." },
      { status: 400 }
    );
  }

  const { error } = await supabase()
    .from("users")
    .update({ instagram_handle: handle || null })
    .eq("id", session.id);

  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });
  return NextResponse.json({ instagram_handle: handle || null });
}
