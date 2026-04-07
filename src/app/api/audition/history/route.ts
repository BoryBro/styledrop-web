import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadAuditionFeatureControl } from "@/lib/style-controls.server";

function parseSession(request: NextRequest): { id: string } | null {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) {
    return NextResponse.json({ error: "AI 오디션이 현재 비공개 상태입니다." }, { status: 503 });
  }

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
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) {
    return NextResponse.json({ error: "AI 오디션이 현재 비공개 상태입니다." }, { status: 503 });
  }

  const session = parseSession(request);
  if (!session) return NextResponse.json({ ok: true }); // 비로그인은 무시

  try {
    const { shareId: incomingShareId, result, genres, bestSceneIdx, stillImageBase64, userPhotoBase64, userPhotosBase64 } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const isUpdate = typeof incomingShareId === "string" && incomingShareId.trim().length > 0;
    const shareId = isUpdate
      ? incomingShareId.trim()
      : `au_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 스틸컷 + 사용자 사진 3장 병렬 업로드
    const uploadJpeg = async (b64: string, path: string): Promise<string | null> => {
      const buf = Buffer.from(b64, "base64");
      const { error } = await supabase.storage
        .from("shared-images")
        .upload(path, buf, { contentType: "image/jpeg", upsert: isUpdate });
      if (error) return null;
      return supabase.storage.from("shared-images").getPublicUrl(path).data.publicUrl;
    };

    const [stillImageUrl, userPhotoUrl, ...userPhotoUrls] = await Promise.all([
      stillImageBase64 ? uploadJpeg(stillImageBase64, `audition/${shareId}-still.jpg`) : Promise.resolve(null),
      userPhotoBase64 ? uploadJpeg(userPhotoBase64, `audition/${shareId}-user.jpg`) : Promise.resolve(null),
      ...(Array.isArray(userPhotosBase64) ? userPhotosBase64.map((b64: string | null, i: number) =>
        b64 ? uploadJpeg(b64, `audition/${shareId}-photo-${i}.jpg`) : Promise.resolve(null)
      ) : []),
    ]);

    const userPhotosJson = userPhotoUrls.length > 0 ? userPhotoUrls : null;

    if (isUpdate) {
      const shareUpdatePayload: Record<string, unknown> = {};
      if (result) shareUpdatePayload.result_json = result;
      if (genres) shareUpdatePayload.genres_json = genres;
      if (typeof bestSceneIdx === "number") shareUpdatePayload.best_scene_idx = bestSceneIdx;
      if (userPhotoUrl) shareUpdatePayload.user_photo_url = userPhotoUrl;
      if (stillImageUrl) shareUpdatePayload.still_image_url = stillImageUrl;
      if (userPhotosJson) shareUpdatePayload.user_photos_json = userPhotosJson;

      if (Object.keys(shareUpdatePayload).length > 0) {
        await supabase
          .from("audition_shares")
          .update(shareUpdatePayload)
          .eq("id", shareId);
      }

      const historyUpdatePayload: Record<string, unknown> = {};
      if (stillImageUrl) historyUpdatePayload.still_image_url = stillImageUrl;
      if (Object.keys(historyUpdatePayload).length > 0) {
        await supabase
          .from("audition_history")
          .update(historyUpdatePayload)
          .eq("share_id", shareId)
          .eq("user_id", session.id);
      }

      return NextResponse.json({ ok: true, shareId });
    }

    // audition_shares 저장 (공유 URL 생성용)
    await supabase.from("audition_shares").insert({
      id: shareId,
      result_json: result,
      genres_json: genres,
      best_scene_idx: bestSceneIdx ?? 0,
      user_photo_url: userPhotoUrl ?? null,
      still_image_url: stillImageUrl ?? null,
      user_photos_json: userPhotosJson,
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

    // audition_history 저장 + audition_complete 이벤트 기록 (병렬)
    await Promise.all([
      supabase.from("audition_history").insert({
        user_id: session.id,
        share_id: shareId,
        avg_score: avgScore,
        assigned_role: bestScene?.assigned_role ?? null,
        still_image_url: stillImageUrl,
      }),
      supabase.from("user_events").insert({
        user_id: session.id,
        event_type: "audition_complete",
      }),
    ]);

    return NextResponse.json({ ok: true, shareId });
  } catch (err) {
    console.error("[audition/history] error:", err);
    return NextResponse.json({ ok: true }); // 실패해도 UX 방해 안 함
  }
}
