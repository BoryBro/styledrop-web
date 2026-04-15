import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { MOCK_BOARD_DATA } from "@/lib/magazine";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_MAGAZINE === "true";
const SHOWCASE_OPT_IN = "home_showcase_opt_in";
const SHOWCASE_OPT_OUT = "home_showcase_opt_out";
const ENTRY_UPSERT = "magazine_entry_upsert";
const ENTRY_REMOVE = "magazine_entry_remove";
const STORY_LIKE = "story_like";
const STORY_UNLIKE = "story_unlike";

type Session = { id: string } | null;
type EventRow = {
  user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function parseSession(request: NextRequest): Session {
  return readSessionFromRequest(request);
}

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function normalizeInstagramHandle(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@+/, "");
  return trimmed || null;
}

function normalizeComment(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 32);
}

async function getLatestShowcaseEvent(supabase: ReturnType<typeof getSupabase>, userId: string) {
  const { data, error } = await supabase
    .from("user_events")
    .select("user_id, event_type, metadata, created_at")
    .eq("user_id", userId)
    .in("event_type", [SHOWCASE_OPT_IN, SHOWCASE_OPT_OUT])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as EventRow | null;
}

export async function GET(request: NextRequest) {
  try {
    const session = parseSession(request);
    const styleId = request.nextUrl.searchParams.get("styleId")?.trim();

    if (!styleId) {
      return NextResponse.json({ error: "Missing styleId" }, { status: 400 });
    }

    // Mock 데이터 사용
    if (USE_MOCK) {
      const mockItems = MOCK_BOARD_DATA[styleId] ?? [];
      return NextResponse.json({
        count: mockItems.length,
        items: mockItems.map((item) => ({
          ...item,
          likedByMe: Math.random() > 0.7, // 일부 사용자는 좋아요 표시
        })),
        meEligible: true,
        meEntry: null,
        meInstagramHandle: null,
      });
    }

    const supabase = getSupabase();
    const [{ data: showcaseEvents, error: showcaseError }, { data: entryEvents, error: entryError }, { data: reactionEvents, error: reactionError }] =
      await Promise.all([
        supabase
          .from("user_events")
          .select("user_id, event_type, metadata, created_at")
          .in("event_type", [SHOWCASE_OPT_IN, SHOWCASE_OPT_OUT])
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("user_events")
          .select("user_id, event_type, metadata, created_at")
          .in("event_type", [ENTRY_UPSERT, ENTRY_REMOVE])
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("user_events")
          .select("user_id, event_type, metadata, created_at")
          .in("event_type", [STORY_LIKE, STORY_UNLIKE])
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);

    if (showcaseError || entryError || reactionError) {
      return NextResponse.json(
        { error: showcaseError?.message ?? entryError?.message ?? reactionError?.message ?? "Unknown error" },
        { status: 500 },
      );
    }

    const latestShowcaseByUser = new Map<string, EventRow>();
    for (const event of (showcaseEvents ?? []) as EventRow[]) {
      if (!event.user_id || latestShowcaseByUser.has(event.user_id)) continue;
      latestShowcaseByUser.set(event.user_id, event);
    }

    const activeShowcaseByUser = new Map<string, EventRow>();
    for (const [userId, event] of latestShowcaseByUser.entries()) {
      const eventStyleId = typeof event.metadata?.style_id === "string" ? event.metadata.style_id : null;
      const imageUrl = typeof event.metadata?.image_url === "string" ? event.metadata.image_url : null;
      if (event.event_type === SHOWCASE_OPT_IN && eventStyleId === styleId && imageUrl) {
        activeShowcaseByUser.set(userId, event);
      }
    }

    const latestEntryByUser = new Map<string, EventRow>();
    for (const event of (entryEvents ?? []) as EventRow[]) {
      if (!event.user_id || latestEntryByUser.has(event.user_id)) continue;
      const eventStyleId = typeof event.metadata?.style_id === "string" ? event.metadata.style_id : null;
      if (eventStyleId !== styleId) continue;
      latestEntryByUser.set(event.user_id, event);
    }

    const participantUserIds = [...latestEntryByUser.entries()]
      .filter(([userId, event]) => {
        const comment = normalizeComment(event.metadata?.comment);
        return event.event_type === ENTRY_UPSERT && comment && activeShowcaseByUser.has(userId);
      })
      .map(([userId]) => userId);

    const { data: users, error: usersError } = participantUserIds.length
      ? await supabase.from("users").select("id, nickname, profile_image").in("id", participantUserIds)
      : { data: [], error: null };

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const userMap = new Map((users ?? []).map((user) => [user.id, user]));
    const latestReactionByPair = new Map<string, boolean>();

    for (const event of (reactionEvents ?? []) as EventRow[]) {
      if (!event.user_id) continue;
      const targetUserId = typeof event.metadata?.target_user_id === "string" ? event.metadata.target_user_id : null;
      if (!targetUserId || !participantUserIds.includes(targetUserId)) continue;
      const key = `${event.user_id}:${targetUserId}`;
      if (latestReactionByPair.has(key)) continue;
      latestReactionByPair.set(key, event.event_type === STORY_LIKE);
    }

    const likeCounts = new Map<string, number>();
    for (const targetUserId of participantUserIds) {
      likeCounts.set(targetUserId, 0);
    }

    for (const [pairKey, liked] of latestReactionByPair.entries()) {
      if (!liked) continue;
      const [, targetUserId] = pairKey.split(":");
      likeCounts.set(targetUserId, (likeCounts.get(targetUserId) ?? 0) + 1);
    }

    const items = participantUserIds
      .map((userId) => {
        const entry = latestEntryByUser.get(userId);
        const showcase = activeShowcaseByUser.get(userId);
        const user = userMap.get(userId);
        if (!entry || !showcase) return null;

        return {
          userId,
          nickname: user?.nickname ?? "익명 사용자",
          profileImage: user?.profile_image ?? null,
          imageUrl: typeof showcase.metadata?.image_url === "string" ? showcase.metadata.image_url : null,
          comment: normalizeComment(entry.metadata?.comment),
          instagramHandle: normalizeInstagramHandle(entry.metadata?.instagram_handle),
          likeCount: likeCounts.get(userId) ?? 0,
          likedByMe: session ? latestReactionByPair.get(`${session.id}:${userId}`) === true : false,
          createdAt: entry.created_at,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item?.imageUrl && item.comment))
      .sort((a, b) => {
        if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const meShowcase = session ? activeShowcaseByUser.get(session.id) : null;
    const meEntry = session ? latestEntryByUser.get(session.id) : null;

    return NextResponse.json({
      count: items.length,
      items,
      meEligible: Boolean(meShowcase),
      meEntry:
        meEntry?.event_type === ENTRY_UPSERT
          ? {
              comment: normalizeComment(meEntry.metadata?.comment),
              instagramHandle: normalizeInstagramHandle(meEntry.metadata?.instagram_handle),
            }
          : null,
      meInstagramHandle: normalizeInstagramHandle(
        meEntry?.metadata?.instagram_handle ??
          meShowcase?.metadata?.instagram_handle,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const styleId = typeof body.styleId === "string" ? body.styleId.trim() : "";
    const comment = normalizeComment(body.comment);
    const instagramHandle = normalizeInstagramHandle(body.instagramHandle);

    if (!styleId || !comment) {
      return NextResponse.json({ error: "Missing styleId or comment" }, { status: 400 });
    }

    const supabase = getSupabase();
    const showcaseEvent = await getLatestShowcaseEvent(supabase, session.id);
    const showcaseStyleId = typeof showcaseEvent?.metadata?.style_id === "string" ? showcaseEvent.metadata.style_id : null;
    const showcaseImage = typeof showcaseEvent?.metadata?.image_url === "string" ? showcaseEvent.metadata.image_url : null;

    if (showcaseEvent?.event_type !== SHOWCASE_OPT_IN || showcaseStyleId !== styleId || !showcaseImage) {
      return NextResponse.json({ error: "해당 카드를 공개한 사용자만 참여할 수 있어요." }, { status: 400 });
    }

    const { error } = await supabase.from("user_events").insert({
      user_id: session.id,
      event_type: ENTRY_UPSERT,
      metadata: {
        style_id: styleId,
        comment,
        instagram_handle: instagramHandle,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = parseSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const styleId = request.nextUrl.searchParams.get("styleId")?.trim();
    if (!styleId) {
      return NextResponse.json({ error: "Missing styleId" }, { status: 400 });
    }

    const { error } = await getSupabase().from("user_events").insert({
      user_id: session.id,
      event_type: ENTRY_REMOVE,
      metadata: {
        style_id: styleId,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
