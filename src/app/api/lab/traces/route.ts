import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  buildTracePoint,
  buildTraceRegionKey,
  formatTraceRegion,
  getSidoOption,
  normalizeRegionPart,
  normalizeSido,
} from "@/lib/lab-traces";

export const dynamic = "force-dynamic";

const TRACE_EVENT_TYPE = "lab_trace_join";

type Session = { id: string; nickname?: string; profileImage?: string | null } | null;
type SelectableImage = {
  id: string;
  style_id: string;
  result_image_url: string;
  created_at: string;
};

function parseSession(request: NextRequest): Session {
  return readSessionFromRequest(request);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanInstagramHandle(value: unknown) {
  return safeString(value).replace(/^@+/, "").trim();
}

function parseTraceRecord(row: {
  user_id: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}) {
  const metadata = row.metadata ?? {};
  const sido = normalizeSido(safeString(metadata.sido));
  const sigungu = normalizeRegionPart(safeString(metadata.sigungu));
  const dong = normalizeRegionPart(safeString(metadata.dong));
  const x = safeNumber(metadata.x);
  const y = safeNumber(metadata.y);
  const regionKey = safeString(metadata.region_key) || buildTraceRegionKey(sido, sigungu, dong);
  const regionLabel = safeString(metadata.region_label) || formatTraceRegion(sido, sigungu, dong);
  const publicImageUrl = safeString(metadata.public_image_url) || null;
  const publicImagePath = safeString(metadata.public_image_path) || null;
  const instagramHandle = cleanInstagramHandle(metadata.instagram_handle) || null;

  if (!row.user_id || !sido || !sigungu || !dong || x === null || y === null) return null;

  return {
    user_id: row.user_id,
    sido,
    sigungu,
    dong,
    x,
    y,
    regionKey,
    regionLabel,
    publicImageUrl,
    publicImagePath,
    instagramHandle,
    created_at: row.created_at ?? null,
  };
}

function summarizeTraces(
  traces: Array<{
    regionKey: string;
    regionLabel: string;
  }>,
) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const trace of traces) {
    const current = counts.get(trace.regionKey);
    if (current) {
      current.count += 1;
      continue;
    }
    counts.set(trace.regionKey, { label: trace.regionLabel, count: 1 });
  }

  const hottest = [...counts.values()].sort((left, right) => right.count - left.count)[0] ?? null;

  return {
    totalParticipants: traces.length,
    totalRegions: counts.size,
    hottestRegion: hottest ? { label: hottest.label, count: hottest.count } : null,
  };
}

async function getEligibility(session: NonNullable<Session>) {
  const supabase = getSupabase();
  const [usageRes, auditionRes] = await Promise.all([
    supabase
      .from("style_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id),
    supabase
      .from("audition_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id),
  ]);

  return (usageRes.count ?? 0) > 0 || (auditionRes.count ?? 0) > 0;
}

async function getLatestTransformImage(session: NonNullable<Session>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transform_history")
    .select("result_image_url")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return safeString(data?.result_image_url) || null;
}

async function getSelectableImages(session: NonNullable<Session>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transform_history")
    .select("id, style_id, result_image_url, created_at")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) return [];

  return (data ?? []).filter(
    (item): item is SelectableImage =>
      Boolean(item?.id && item?.style_id && safeString(item.result_image_url) && item?.created_at),
  );
}

async function persistTraceImage(imageUrl: string, userId: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("선택한 이미지를 불러오지 못했어요.");

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : "jpg";
  const path = `lab-traces/${userId}-${Date.now()}.${extension}`;
  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from("shared-images")
    .upload(path, buffer, { contentType, upsert: false, cacheControl: "3600" });

  if (error) throw error;

  const { data } = supabase.storage.from("shared-images").getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  const supabase = getSupabase();

  const traceRes = await supabase
    .from("user_events")
    .select("user_id, metadata, created_at")
    .eq("event_type", TRACE_EVENT_TYPE)
    .order("created_at", { ascending: false });

  if (traceRes.error) {
    return NextResponse.json({ error: traceRes.error.message }, { status: 500 });
  }

  const deduped = new Map<string, ReturnType<typeof parseTraceRecord>>();
  for (const row of traceRes.data ?? []) {
    const parsed = parseTraceRecord(row);
    if (!parsed || deduped.has(parsed.user_id)) continue;
    deduped.set(parsed.user_id, parsed);
  }

  const traces = [...deduped.values()].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const summary = summarizeTraces(traces);

  let me = {
    loggedIn: false,
    eligible: false,
    alreadyJoined: false,
    trace: null as null | (typeof traces)[number],
    latestImageUrl: null as string | null,
    selectableImages: [] as SelectableImage[],
  };

  if (session) {
    const [latestImageUrl, selectableImages] = await Promise.all([
      getLatestTransformImage(session),
      getSelectableImages(session),
    ]);
    const trace = traces.find((item) => item.user_id === session.id) ?? null;
    me = {
      loggedIn: true,
      eligible: await getEligibility(session),
      alreadyJoined: Boolean(trace),
      trace,
      latestImageUrl,
      selectableImages,
    };
  }

  return NextResponse.json({
    traces,
    summary,
    me,
  });
}

export async function POST(request: NextRequest) {
  const session = parseSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sido, sigungu, dong, shareImage, selectedImageId, instagramHandle } = await request.json();
  const normalizedSido = normalizeSido(sido);
  const normalizedSigungu = normalizeRegionPart(sigungu);
  const normalizedDong = normalizeRegionPart(dong);
  const normalizedInstagramHandle = cleanInstagramHandle(instagramHandle);

  if (!getSidoOption(normalizedSido)) {
    return NextResponse.json({ error: "시/도를 선택해주세요." }, { status: 400 });
  }
  if (!normalizedSigungu) {
    return NextResponse.json({ error: "시/구/군을 입력해주세요." }, { status: 400 });
  }
  if (!normalizedDong) {
    return NextResponse.json({ error: "동/읍/면을 입력해주세요." }, { status: 400 });
  }

  const eligible = await getEligibility(session);
  if (!eligible) {
    return NextResponse.json({ error: "이미지를 한 번 만든 계정만 참여할 수 있어요." }, { status: 403 });
  }

  const supabase = getSupabase();
  const existingRes = await supabase
    .from("user_events")
    .select("user_id, metadata, created_at")
    .eq("user_id", session.id)
    .eq("event_type", TRACE_EVENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingRes.error) {
    return NextResponse.json({ error: existingRes.error.message }, { status: 500 });
  }

  const existing = (existingRes.data ?? [])
    .map((row) => parseTraceRecord(row))
    .find((item): item is NonNullable<typeof item> => Boolean(item));

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyJoined: true,
      trace: existing,
    });
  }

  const selectableImages = shareImage ? await getSelectableImages(session) : [];
  const selectedImage = shareImage
    ? selectableImages.find((item) => item.id === safeString(selectedImageId)) ?? null
    : null;

  if (shareImage && !selectedImage) {
    return NextResponse.json({ error: "공개할 이미지를 선택해주세요." }, { status: 400 });
  }

  const persistedImage = selectedImage ? await persistTraceImage(selectedImage.result_image_url, session.id) : null;

  const point = buildTracePoint({
    sido: normalizedSido,
    sigungu: normalizedSigungu,
    dong: normalizedDong,
    userId: session.id,
  });

  const trace = {
    user_id: session.id,
    sido: normalizedSido,
    sigungu: normalizedSigungu,
    dong: normalizedDong,
    x: point.x,
    y: point.y,
    regionKey: buildTraceRegionKey(normalizedSido, normalizedSigungu, normalizedDong),
    regionLabel: formatTraceRegion(normalizedSido, normalizedSigungu, normalizedDong),
    publicImageUrl: persistedImage?.publicUrl ?? null,
    publicImagePath: persistedImage?.path ?? null,
    instagramHandle: normalizedInstagramHandle || null,
    created_at: new Date().toISOString(),
  };

  const insertRes = await supabase.from("user_events").insert({
    user_id: session.id,
    event_type: TRACE_EVENT_TYPE,
    metadata: {
      sido: trace.sido,
      sigungu: trace.sigungu,
      dong: trace.dong,
      x: trace.x,
      y: trace.y,
      region_key: trace.regionKey,
      region_label: trace.regionLabel,
      public_image_url: trace.publicImageUrl,
      public_image_path: trace.publicImagePath,
      instagram_handle: trace.instagramHandle,
    },
  });

  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alreadyJoined: false,
    trace,
  });
}

export async function DELETE(request: NextRequest) {
  const session = parseSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const existingRes = await supabase
    .from("user_events")
    .select("metadata")
    .eq("user_id", session.id)
    .eq("event_type", TRACE_EVENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const publicImagePath = safeString(existingRes.data?.metadata?.public_image_path);
  const deleteRes = await supabase
    .from("user_events")
    .delete()
    .eq("user_id", session.id)
    .eq("event_type", TRACE_EVENT_TYPE);

  if (deleteRes.error) {
    return NextResponse.json({ error: deleteRes.error.message }, { status: 500 });
  }

  if (publicImagePath) {
    await supabase.storage.from("shared-images").remove([publicImagePath]);
  }

  return NextResponse.json({ ok: true });
}
