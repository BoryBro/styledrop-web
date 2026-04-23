import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

function parseScheduledAt(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (date.getTime() <= Date.now()) return undefined;
  return date.toISOString();
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.content === "string") {
    const content = body.content.trim();
    if (!content || content.length > 500) {
      return NextResponse.json({ error: "content must be 1-500 characters" }, { status: 400 });
    }
    patch.content = content;
  }
  if (typeof body.image_url === "string") patch.image_url = body.image_url.trim() || null;
  if (typeof body.quality_note === "string") patch.quality_note = body.quality_note.trim() || null;
  if (typeof body.category === "string") patch.category = body.category.trim() || null;
  if (typeof body.cta_type === "string") patch.cta_type = body.cta_type.trim() || null;
  if (typeof body.link_included === "boolean") patch.link_included = body.link_included;
  if (typeof body.image_upload_recommended === "boolean") patch.image_upload_recommended = body.image_upload_recommended;
  if (Array.isArray(body.recommended_styles)) patch.recommended_styles = body.recommended_styles.map(String);
  if (typeof body.scheduled_at === "string") {
    const scheduledAt = parseScheduledAt(body.scheduled_at);
    if (!scheduledAt) {
      return NextResponse.json({ error: "scheduled_at must be a future time" }, { status: 400 });
    }
    patch.scheduled_at = scheduledAt;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("threads_posts")
    .select("status")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.status === "published") {
    return NextResponse.json({ error: "cannot edit published post" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("threads_posts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}
