import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// PATCH /api/threads/[id]/approve — draft → approved (또는 approved → draft 토글)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: post } = await supabase
    .from("threads_posts")
    .select("status,image_upload_recommended,image_url")
    .eq("id", id)
    .single();

  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (post.status === "published") {
    return NextResponse.json({ error: "already published" }, { status: 400 });
  }
  if (post.status !== "approved" && post.image_upload_recommended && !post.image_url) {
    return NextResponse.json({ error: "image required before approval" }, { status: 400 });
  }

  const newStatus = post.status === "approved" ? "draft" : "approved";
  const { data, error } = await supabase
    .from("threads_posts")
    .update({ status: newStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

// DELETE /api/threads/[id]/approve — 포스트 삭제 (draft/approved만)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: post } = await supabase.from("threads_posts").select("status").eq("id", id).single();
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (post.status === "published") {
    return NextResponse.json({ error: "cannot delete published post" }, { status: 400 });
  }

  const { error } = await supabase.from("threads_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
