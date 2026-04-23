import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

function isAuthed(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: post } = await supabase
    .from("threads_posts")
    .select("thread_id")
    .eq("id", id)
    .single();

  if (!post?.thread_id) return NextResponse.json({ error: "no thread_id" }, { status: 404 });

  const token = process.env.THREADS_ACCESS_TOKEN;
  const res = await fetch(
    `https://graph.threads.net/v1.0/${post.thread_id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${token}`,
  );
  const data = await res.json();

  if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? "api error" }, { status: 502 });

  const metrics: Record<string, number> = {};
  for (const item of data.data ?? []) {
    metrics[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
  }

  return NextResponse.json({ metrics });
}
