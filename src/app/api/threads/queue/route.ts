import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serializeThreadsImageUrls } from "@/lib/threads-images";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function checkAdmin(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  return password === process.env.ADMIN_PASSWORD;
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["yes", "true", "1", "y"].includes(value.trim().toLowerCase());
}

function parseStyles(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split("|").map((v) => v.trim()).filter(Boolean);
}

function parseFutureDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() <= Date.now()) return null;
  return date.toISOString();
}

// GET /api/threads/queue — 전체 목록 (최신순)
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("threads_posts")
    .select("*")
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

// POST /api/threads/queue — 새 포스트 초안 생성
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    content,
    image_url,
    image_urls,
    scheduled_at,
    template_id,
    category,
    cta_type,
    link_included,
    image_upload_recommended,
    recommended_styles,
    quality_note,
  } = body;
  if (!content || !scheduled_at) {
    return NextResponse.json({ error: "content and scheduled_at required" }, { status: 400 });
  }
  const scheduledAt = parseFutureDate(scheduled_at);
  if (!scheduledAt) {
    return NextResponse.json({ error: "scheduled_at must be a future time" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("threads_posts")
    .insert({
      content,
      image_url: serializeThreadsImageUrls(image_urls ?? image_url),
      scheduled_at: scheduledAt,
      status: "draft",
      template_id: template_id || null,
      category: category || null,
      cta_type: cta_type || null,
      link_included: parseBool(link_included),
      image_upload_recommended: parseBool(image_upload_recommended),
      recommended_styles: parseStyles(recommended_styles),
      quality_note: quality_note || null,
      source: "manual",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data }, { status: 201 });
}
