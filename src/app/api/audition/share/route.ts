import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from("audition_shares")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const { result, genres, bestSceneIdx, userPhotoBase64, userPhotosBase64, stillImageBase64 } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const id = `au_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let userPhotoUrl: string | null = null;
    let stillImageUrl: string | null = null;
    const userPhotosUrls: (string | null)[] = [null, null, null];

    // 베스트 씬 사진 업로드
    if (userPhotoBase64) {
      const buf = Buffer.from(userPhotoBase64, "base64");
      const { error } = await supabase.storage
        .from("shared-images")
        .upload(`audition/${id}-photo.jpg`, buf, { contentType: "image/jpeg", upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("shared-images").getPublicUrl(`audition/${id}-photo.jpg`);
        userPhotoUrl = data.publicUrl;
      }
    }

    // 3장 전체 사진 업로드
    if (Array.isArray(userPhotosBase64)) {
      await Promise.all(userPhotosBase64.map(async (b64: string | null, i: number) => {
        if (!b64) return;
        const buf = Buffer.from(b64, "base64");
        const { error } = await supabase.storage
          .from("shared-images")
          .upload(`audition/${id}-photo${i}.jpg`, buf, { contentType: "image/jpeg", upsert: false });
        if (!error) {
          const { data } = supabase.storage.from("shared-images").getPublicUrl(`audition/${id}-photo${i}.jpg`);
          userPhotosUrls[i] = data.publicUrl;
        }
      }));
    }

    // AI 스틸컷 업로드
    if (stillImageBase64) {
      const buf = Buffer.from(stillImageBase64, "base64");
      const { error } = await supabase.storage
        .from("shared-images")
        .upload(`audition/${id}-still.jpg`, buf, { contentType: "image/jpeg", upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("shared-images").getPublicUrl(`audition/${id}-still.jpg`);
        stillImageUrl = data.publicUrl;
      }
    }

    const { error: dbError } = await supabase.from("audition_shares").insert({
      id,
      result_json: result,
      genres_json: genres,
      best_scene_idx: bestSceneIdx ?? 0,
      user_photo_url: userPhotoUrl,
      user_photos_json: userPhotosUrls,
      still_image_url: stillImageUrl,
    });

    if (dbError) throw dbError;

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[audition/share] error:", err);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
