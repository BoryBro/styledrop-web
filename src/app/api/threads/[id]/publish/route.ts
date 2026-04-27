import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishToThreads } from "@/lib/threads.server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// POST /api/threads/[id]/publish — 승인/실패 포스트를 즉시 발행
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: post } = await supabase
    .from("threads_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (post.status === "published") return NextResponse.json({ error: "already published" }, { status: 400 });
  if (post.status !== "approved" && post.status !== "failed") {
    return NextResponse.json({ error: "must be approved first" }, { status: 400 });
  }
  if (post.image_upload_recommended && !post.image_url) {
    return NextResponse.json({ error: "image required before publishing" }, { status: 400 });
  }

  const result = await publishToThreads(post.content, post.image_url);

  if (result.ok) {
    await supabase
      .from("threads_posts")
      .update({ status: "published", thread_id: result.threadId, published_at: new Date().toISOString(), error_message: null })
      .eq("id", id);
    return NextResponse.json({ ok: true, threadId: result.threadId });
  } else {
    await supabase
      .from("threads_posts")
      .update({ status: "failed", error_message: result.error })
      .eq("id", id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
}
