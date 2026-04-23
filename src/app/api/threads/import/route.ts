import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ImportRow = {
  template_id?: string;
  post_text?: string;
  content?: string;
  category?: string;
  cta_type?: string;
  link_included?: string | boolean;
  image_upload_recommended?: string | boolean;
  recommended_styles?: string | string[];
  scheduled_at?: string;
  status?: string;
  quality_note?: string;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["yes", "true", "1", "y"].includes(value.trim().toLowerCase());
}

function parseStyles(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split("|")
    .map((style) => style.trim())
    .filter(Boolean);
}

function parseScheduledAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  if (raw.includes("T")) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 9, Number(mi), 0);
  return new Date(utc).toISOString();
}

function isFutureIso(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? (body.rows as ImportRow[]) : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "rows required" }, { status: 400 });
  }
  if (rows.length > 1200) {
    return NextResponse.json({ error: "too many rows" }, { status: 400 });
  }

  const normalized = rows.flatMap((row, index) => {
    const content = String(row.post_text ?? row.content ?? "").replace(/\\n/g, "\n").trim();
    const scheduledAt = parseScheduledAt(row.scheduled_at);
    if (!content || !scheduledAt || !isFutureIso(scheduledAt) || content.length > 500) return [];

    return [{
      template_id: String(row.template_id || `import_${Date.now()}_${index}`).trim(),
      content,
      image_url: null,
      scheduled_at: scheduledAt,
      status: "draft",
      category: row.category ? String(row.category).trim() : null,
      cta_type: row.cta_type ? String(row.cta_type).trim() : null,
      link_included: parseBool(row.link_included),
      image_upload_recommended: parseBool(row.image_upload_recommended),
      recommended_styles: parseStyles(row.recommended_styles),
      quality_note: row.quality_note ? String(row.quality_note).trim() : null,
      source: "csv_import",
      error_message: null,
    }];
  });

  if (normalized.length === 0) {
    return NextResponse.json({ error: "no valid rows" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("threads_posts")
    .upsert(normalized, { onConflict: "template_id" })
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    imported: data?.length ?? normalized.length,
    skipped: rows.length - normalized.length,
  });
}
