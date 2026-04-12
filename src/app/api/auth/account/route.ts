import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function parseSession(req: NextRequest): { id: string } | null {
  try {
    const cookie = req.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch { return null; }
}

function extractSharedImagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const matched = url.match(/\/storage\/v1\/object\/public\/shared-images\/([^?#]+)/);
  return matched?.[1] ? decodeURIComponent(matched[1]) : null;
}

function deriveTransformPaths(afterUrl: string | null | undefined): string[] {
  if (!afterUrl) return [];
  const matched = afterUrl.match(/\/shared\/([^/?#]+)-after\.jpg(?:\?|$)/);
  if (!matched) return [];
  const shareId = matched[1];
  return [`shared/${shareId}-before.jpg`, `shared/${shareId}-after.jpg`];
}

export async function DELETE(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const storagePaths = new Set<string>();

  const [{ data: historyRows }, { data: userEventRows }, { data: auditionHistoryRows }] = await Promise.all([
    supabase
      .from("transform_history")
      .select("result_image_url")
      .eq("user_id", session.id),
    supabase
      .from("user_events")
      .select("event_type, metadata")
      .eq("user_id", session.id),
    supabase
      .from("audition_history")
      .select("share_id")
      .eq("user_id", session.id),
  ]);

  for (const row of historyRows ?? []) {
    for (const path of deriveTransformPaths(row.result_image_url)) {
      storagePaths.add(path);
    }
  }

  for (const row of userEventRows ?? []) {
    const metadata = row.metadata as { storage_path?: string | null } | null;
    if (row.event_type === "home_showcase_opt_in" && metadata?.storage_path) {
      storagePaths.add(metadata.storage_path);
    }
  }

  const shareIds = (auditionHistoryRows ?? [])
    .map((row) => row.share_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (shareIds.length > 0) {
    const { data: auditionShares } = await supabase
      .from("audition_shares")
      .select("id, user_photo_url, still_image_url, user_photos_json")
      .in("id", shareIds);

    for (const row of auditionShares ?? []) {
      [
        extractSharedImagePath(row.user_photo_url),
        extractSharedImagePath(row.still_image_url),
      ]
        .filter((value): value is string => Boolean(value))
        .forEach((value) => storagePaths.add(value));

      const userPhotos = Array.isArray(row.user_photos_json) ? row.user_photos_json : [];
      for (const item of userPhotos) {
        if (typeof item === "string") {
          const path = extractSharedImagePath(item);
          if (path) storagePaths.add(path);
        }
      }
    }
  }

  if (storagePaths.size > 0) {
    await supabase.storage.from("shared-images").remove([...storagePaths]);
  }

  await supabase.from("user_events").delete().eq("user_id", session.id);
  await supabase.from("transform_history").delete().eq("user_id", session.id);
  await supabase.from("audition_history").delete().eq("user_id", session.id);
  if (shareIds.length > 0) {
    await supabase.from("audition_shares").delete().in("id", shareIds);
  }
  await supabase.from("style_usage").update({ user_id: null }).eq("user_id", session.id);
  await supabase.from("users").delete().eq("id", session.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set("sd_session", "", { maxAge: 0, path: "/" });
  return response;
}
