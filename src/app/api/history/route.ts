import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";

function parseSession(request: NextRequest): { id: string } | null {
  return readSessionFromRequest(request);
}

function deriveBeforeImageUrl(afterUrl: string | null): string | null {
  if (!afterUrl) return null;
  return /-after\.jpg(?:\?|$)/.test(afterUrl)
    ? afterUrl.replace(/-after\.jpg(\?.*)?$/, "-before.jpg$1")
    : null;
}

function extractSharedImagePaths(afterUrl: string | null): string[] {
  if (!afterUrl) return [];
  const matched = afterUrl.match(/\/shared\/([^/?#]+)-after\.jpg(?:\?|$)/);
  if (!matched) return [];
  const shareId = matched[1];
  return [`shared/${shareId}-before.jpg`, `shared/${shareId}-after.jpg`];
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("transform_history")
    .select("id, style_id, variant, result_image_url, created_at")
    .eq("user_id", session.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    history: (data ?? []).map((item) => ({
      ...item,
      before_image_url: deriveBeforeImageUrl(item.result_image_url),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { style_id, variant, result_image_url } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await supabase.from("transform_history").insert({
    user_id: session.id,
    style_id,
    variant,
    result_image_url,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: "save_result",
    metadata: { style_id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing history id" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: existing, error: fetchError } = await supabase
    .from("transform_history")
    .select("id, result_image_url")
    .eq("id", id)
    .eq("user_id", session.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error: deleteError } = await supabase
    .from("transform_history")
    .delete()
    .eq("id", id)
    .eq("user_id", session.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const paths = extractSharedImagePaths(existing.result_image_url);
  if (paths.length > 0) {
    await supabase.storage.from("shared-images").remove(paths);
  }

  return NextResponse.json({ ok: true, id });
}
