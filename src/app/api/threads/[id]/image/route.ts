import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  MAX_THREADS_IMAGE_COUNT,
  parseThreadsImageUrls,
  serializeThreadsImageUrls,
} from "@/lib/threads-images";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

function extensionFromType(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const form = await req.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const fallbackFile = form.get("file");
  if (files.length === 0 && fallbackFile instanceof File) files.push(fallbackFile);
  if (files.length === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "image file required" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "image must be under 8MB" }, { status: 400 });
    }
  }

  const supabase = getSupabase();
  const { data: post } = await supabase
    .from("threads_posts")
    .select("status,image_url")
    .eq("id", id)
    .single();

  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (post.status === "published") {
    return NextResponse.json({ error: "cannot edit published post" }, { status: 400 });
  }

  const existingUrls = parseThreadsImageUrls(post.image_url);
  if (existingUrls.length + files.length > MAX_THREADS_IMAGE_COUNT) {
    return NextResponse.json(
      { error: `이미지는 최대 ${MAX_THREADS_IMAGE_COUNT}장까지 업로드할 수 있습니다.` },
      { status: 400 }
    );
  }

  const uploadedUrls: string[] = [];
  for (const file of files) {
    const ext = extensionFromType(file.type);
    const path = `threads/${id}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("shared-images")
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    uploadedUrls.push(supabase.storage.from("shared-images").getPublicUrl(path).data.publicUrl);
  }

  const imageUrls = [...existingUrls, ...uploadedUrls];
  const { data, error } = await supabase
    .from("threads_posts")
    .update({ image_url: serializeThreadsImageUrls(imageUrls) })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data, imageUrl: imageUrls[0] ?? null, imageUrls });
}
