import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishToThreads } from "@/lib/threads.server";

// Vercel Cron 또는 외부 크론이 호출하는 엔드포인트
// 승인됐고 scheduled_at이 지난 포스트를 자동 발행
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualCron = cronSecret === process.env.CRON_SECRET;
  if (!process.env.CRON_SECRET || (!isVercelCron && !isManualCron)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const now = new Date().toISOString();
  const { data: duePosts, error } = await supabase
    .from("threads_posts")
    .select("*")
    .eq("status", "approved")
    .lte("scheduled_at", now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ published: 0 });
  }

  const publishablePosts = duePosts.filter((post) => !(post.image_upload_recommended && !post.image_url));
  if (publishablePosts.length === 0) {
    return NextResponse.json({ published: 0, failed: 0, skipped: duePosts.length });
  }

  const results = await Promise.allSettled(
    publishablePosts.map(async (post) => {
      const result = await publishToThreads(post.content, post.image_url);
      if (result.ok) {
        await supabase
          .from("threads_posts")
          .update({ status: "published", thread_id: result.threadId, published_at: new Date().toISOString(), error_message: null })
          .eq("id", post.id);
      } else {
        await supabase
          .from("threads_posts")
          .update({ status: "failed", error_message: result.error })
          .eq("id", post.id);
      }
      return { id: post.id, ok: result.ok };
    })
  );

  const published = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
  const failed = results.length - published;
  return NextResponse.json({ published, failed, skipped: duePosts.length - publishablePosts.length });
}
