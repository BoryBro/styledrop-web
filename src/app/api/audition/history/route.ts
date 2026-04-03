import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(request: NextRequest): { id: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data, error } = await supabase
    .from("audition_history")
    .select("id, share_id, avg_score, assigned_role, still_image_url, created_at")
    .eq("user_id", session.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ ok: true }); // 비로그인은 무시

  try {
    const { result, genres, bestSceneIdx, stillImageBase64 } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const shareId = `au_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let stillImageUrl: string | null = null;

    // 스틸컷 업로드
    if (stillImageBase64) {
      const buf = Buffer.from(stillImageBase64, "base64");
      const { error } = await supabase.storage
        .from("shared-images")
        .upload(`audition/${shareId}-still.jpg`, buf, { contentType: "image/jpeg", upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("shared-images").getPublicUrl(`audition/${shareId}-still.jpg`);
        stillImageUrl = data.publicUrl;
      }
    }

    // audition_shares 저장 (공유 URL 생성용)
    await supabase.from("audition_shares").insert({
      id: shareId,
      result_json: result,
      genres_json: genres,
      best_scene_idx: bestSceneIdx ?? 0,
      user_photo_url: null,
      still_image_url: stillImageUrl,
    });

    // 종합 점수 계산
    const SCORE_LABELS = ["이해도", "표정연기", "창의성", "몰입도"] as const;
    const avgScore = Math.round(
      result.scenes.reduce((sum: number, s: { scores: Record<string, number> }) => {
        const vals = SCORE_LABELS.map(l => s.scores?.[l] ?? 0);
        return sum + vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      }, 0) / result.scenes.length
    );
    const bestScene = result.scenes[bestSceneIdx ?? 0];

    // audition_history 저장
    await supabase.from("audition_history").insert({
      user_id: session.id,
      share_id: shareId,
      avg_score: avgScore,
      assigned_role: bestScene?.assigned_role ?? null,
      still_image_url: stillImageUrl,
    });

    return NextResponse.json({ ok: true, shareId });
  } catch (err) {
    console.error("[audition/history] error:", err);
    return NextResponse.json({ ok: true }); // 실패해도 UX 방해 안 함
  }
}
