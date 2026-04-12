import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OPT_IN_EVENT = "home_showcase_opt_in";
const OPT_OUT_EVENT = "home_showcase_opt_out";

type Session = { id: string } | null;
type ShowcaseEvent = {
  id?: string;
  user_id: string;
  event_type: string;
  metadata: {
    image_url?: string | null;
    storage_path?: string | null;
    style_id?: string | null;
    variant?: string | null;
    instagram_handle?: string | null;
  } | null;
  created_at: string;
};

function parseSession(request: NextRequest): Session {
  try {
    const cookie = request.cookies.get("sd_session")?.value;
    if (!cookie) return null;
    return JSON.parse(Buffer.from(cookie, "base64").toString());
  } catch {
    return null;
  }
}

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function toBuffer(base64: string) {
  return Buffer.from(base64, "base64");
}

async function getLatestShowcaseEvent(supabase: ReturnType<typeof getSupabase>, userId: string): Promise<ShowcaseEvent | null> {
  const { data, error } = await supabase
    .from("user_events")
    .select("id, user_id, event_type, metadata, created_at")
    .eq("user_id", userId)
    .in("event_type", [OPT_IN_EVENT, OPT_OUT_EVENT])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = parseSession(request);
    const supabase = getSupabase();

    const { data: events, error } = await supabase
      .from("user_events")
      .select("user_id, event_type, metadata, created_at")
      .in("event_type", [OPT_IN_EVENT, OPT_OUT_EVENT])
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const showcaseEvents = (events ?? []) as ShowcaseEvent[];
    const latestByUser = new Map<string, ShowcaseEvent>();
    for (const event of showcaseEvents) {
      if (event.user_id && !latestByUser.has(event.user_id)) {
        latestByUser.set(event.user_id, event);
      }
    }

    const active = [...latestByUser.values()].filter((event) => event.event_type === OPT_IN_EVENT && event.metadata?.image_url);
    const userIds = active.map((event) => event.user_id).filter(Boolean);

    const [{ data: users }, { data: likeEvents }] = await Promise.all([
      userIds.length
        ? supabase.from("users").select("id, nickname, profile_image").in("id", userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; nickname: string | null; profile_image: string | null }> }),
      supabase.from("user_events").select("metadata").eq("event_type", "story_like"),
    ]);

    const userMap = new Map((users ?? []).map((user) => [user.id, user]));

    // 타겟 userId별 하트 카운트 집계
    const likeCounts: Record<string, number> = {};
    for (const e of likeEvents ?? []) {
      const tid = (e.metadata as Record<string, string> | null)?.target_user_id;
      if (tid) likeCounts[tid] = (likeCounts[tid] ?? 0) + 1;
    }

    const items = active
      .map((event) => {
        const profile = userMap.get(event.user_id);
        return {
          userId: event.user_id,
          nickname: profile?.nickname ?? "익명 사용자",
          profileImage: profile?.profile_image ?? null,
          imageUrl: event.metadata?.image_url ?? null,
          styleId: event.metadata?.style_id ?? null,
          instagramHandle: event.metadata?.instagram_handle ?? null,
          likeCount: likeCounts[event.user_id] ?? 0,
          createdAt: event.created_at,
        };
      })
      .filter((item) => item.imageUrl)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const meEvent = session ? latestByUser.get(session.id) : null;
    const me =
      meEvent?.event_type === OPT_IN_EVENT && meEvent.metadata?.image_url
        ? {
            imageUrl: meEvent.metadata.image_url as string,
            styleId: (meEvent.metadata?.style_id as string | null) ?? null,
            instagramHandle: (meEvent.metadata?.instagram_handle as string | null) ?? null,
            createdAt: meEvent.created_at,
          }
        : null;

    return NextResponse.json({ items, me });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const imageBase64 = body.imageBase64 as string | undefined;
    const styleId = body.styleId as string | undefined;
    const variant = body.variant as string | undefined;
    const instagramHandle =
      typeof body.instagramHandle === "string" && body.instagramHandle.trim()
        ? body.instagramHandle.trim().replace(/^@+/, "")
        : null;

    if (!imageBase64 || !styleId) {
      return NextResponse.json({ error: "Missing imageBase64 or styleId" }, { status: 400 });
    }

    const supabase = getSupabase();
    const previous = await getLatestShowcaseEvent(supabase, session.id);

    if (previous?.event_type === OPT_IN_EVENT && typeof previous.metadata?.storage_path === "string") {
      await supabase.storage.from("shared-images").remove([previous.metadata.storage_path]);
    }

    const filePath = `home-showcase/${session.id}-${Date.now()}.jpg`;
    const upload = await supabase.storage
      .from("shared-images")
      .upload(filePath, toBuffer(imageBase64), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const publicUrl = supabase.storage.from("shared-images").getPublicUrl(filePath).data.publicUrl;

    const { error } = await supabase.from("user_events").insert({
      user_id: session.id,
      event_type: OPT_IN_EVENT,
      metadata: {
        style_id: styleId,
        variant: variant ?? "default",
        image_url: publicUrl,
        storage_path: filePath,
        instagram_handle: instagramHandle,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, imageUrl: publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getSupabase();
    const previous = await getLatestShowcaseEvent(supabase, session.id);

    if (previous?.event_type === OPT_IN_EVENT && typeof previous.metadata?.storage_path === "string") {
      await supabase.storage.from("shared-images").remove([previous.metadata.storage_path]);
    }

    const { error } = await supabase.from("user_events").insert({
      user_id: session.id,
      event_type: OPT_OUT_EVENT,
      metadata: {
        previous_storage_path:
          previous?.event_type === OPT_IN_EVENT && typeof previous.metadata?.storage_path === "string"
            ? previous.metadata.storage_path
            : null,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
