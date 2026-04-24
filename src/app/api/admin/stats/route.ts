import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGenerationErrorOverview } from "@/lib/generation-errors.server";
import { loadStyleControls } from "@/lib/style-controls.server";
import { applyStyleControl } from "@/lib/style-controls";
import { getGeminiBillingSnapshot, hasGeminiBillingConfig } from "@/lib/google-billing.server";
import { ALL_STYLES, STYLE_LABELS } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";
import { getNetRevenueAmount } from "@/lib/payment-policy";

type PaymentRow = {
  id: string;
  amount: number;
  credits: number;
  user_id: string;
  status: string;
  created_at: string;
  refunded_amount?: number | null;
  refunded_at?: string | null;
  refund_type?: string | null;
};

type RefundEventRow = {
  id: string | number;
  user_id: string | null;
  created_at: string;
  metadata: {
    style_id?: string;
    variant?: string | null;
    credits?: number | string;
    reason?: string | null;
    message?: string | null;
  } | null;
};

type UserActivityRow = {
  user_id: string | null;
  created_at: string;
  event_type?: string | null;
};

type AdminEventRow = {
  user_id: string | null;
  event_type: string;
  created_at: string;
  metadata: {
    style_id?: string;
    variant?: string | null;
    credits?: number | string;
    reason?: string | null;
    message?: string | null;
    request_key?: string | null;
    duration_ms?: number | string | null;
  } | null;
};

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const nowIso = new Date().toISOString();
  const todayIso = new Date(Date.now() - 24 * 3600000).toISOString();
  const currentMonthStartIso = "2026-04-01";

  const MAR_ACTUAL_API_COST = 16313; // 3월 Google 청구서 실측값 (세전)
  const APR_REFERENCE_BILLING = {
    from: "2026-04-01",
    to: "2026-04-07T23:59:59",
    actualCost: 15999,
  } as const;
  const COST_WEIGHTS = {
    style: 1,
    auditionAnalyze: 2,
    auditionStill: 1,
  } as const;

  const calcWeightedOps = (styleCount: number, auditionAnalyzeCount: number, auditionStillCount: number) =>
    styleCount * COST_WEIGHTS.style
    + auditionAnalyzeCount * COST_WEIGHTS.auditionAnalyze
    + auditionStillCount * COST_WEIGHTS.auditionStill;

  // variant 컬럼이 없을 수 있으므로 먼저 시도, 실패하면 fallback
  const usageWithVariant = await supabase.from("style_usage").select("style_id, style_name, user_id, variant");
  const hasVariantCol = !usageWithVariant.error;
  const usageRes = hasVariantCol
    ? usageWithVariant
    : await supabase.from("style_usage").select("style_id, style_name, user_id");

  const [eventsRes, todayEventsRes, refundEventsRes, usersRes, todaySignupRes, todayUsageRes, todayUsageRowsRes, paymentsRes, todayPaymentsRes, userListRes,
    marUsageRes, aprUsageRes, marAuditionRes, aprAuditionRes, marAuditionStillRes, aprAuditionStillRes,
    aprRefUsageRes, aprRefAuditionRes, aprRefAuditionStillRes,
    marRevenueRes, aprRevenueRes,
    aprShareKakaoRes, aprShareLinkRes, aprSaveRes, aprAuditionShareKakaoRes, aprAuditionShareLinkRes,
    marBillingSnapshot, aprBillingSnapshot,
    styleControls,
    generationErrorOverview,
  ] = await Promise.all([
    // metadata 포함해서 공유 이벤트의 style_id 집계 가능하도록
    supabase.from("user_events").select("event_type, metadata, created_at"),
    supabase.from("user_events").select("event_type, metadata, user_id, created_at").gte("created_at", todayIso),
    supabase
      .from("user_events")
      .select("id, user_id, metadata, created_at")
      .eq("event_type", "generation_credit_refund")
      .gte("created_at", todayIso)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("style_usage").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("style_usage").select("style_id").gte("created_at", todayIso),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").gte("created_at", todayIso),
    supabase
      .from("users")
      .select("id, nickname, created_at, last_login_at")
      .order("last_login_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500),
    // 월별 스타일 변환
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).neq("style_id", "audition").gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).neq("style_id", "audition").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    // 월별 오디션 — audition_history 테이블 사용 (처음부터 기록됨)
    supabase.from("audition_history").select("id", { count: "exact", head: true }).gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("audition_history").select("id", { count: "exact", head: true }).gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    // 월별 오디션 스틸컷 — style_usage의 audition 행
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).eq("style_id", "audition").gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).eq("style_id", "audition").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    // 4/1~4/7 실제 청구서 보정 기준
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).neq("style_id", "audition").gte("created_at", APR_REFERENCE_BILLING.from).lte("created_at", APR_REFERENCE_BILLING.to),
    supabase.from("audition_history").select("id", { count: "exact", head: true }).gte("created_at", APR_REFERENCE_BILLING.from).lte("created_at", APR_REFERENCE_BILLING.to),
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).eq("style_id", "audition").gte("created_at", APR_REFERENCE_BILLING.from).lte("created_at", APR_REFERENCE_BILLING.to),
    // 월별 매출
    supabase.from("payments").select("*").gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("payments").select("*").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    // 4월 공유/저장 이벤트 카운트
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "share_kakao").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "share_link_copy").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "save_image").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "audition_share_kakao").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "audition_share_link_copy").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
    hasGeminiBillingConfig()
      ? getGeminiBillingSnapshot({ from: "2026-03-01", to: "2026-03-31T23:59:59" }).catch(() => null)
      : Promise.resolve(null),
    hasGeminiBillingConfig()
      ? getGeminiBillingSnapshot({ from: currentMonthStartIso, to: nowIso }).catch(() => null)
      : Promise.resolve(null),
    loadStyleControls(),
    getGenerationErrorOverview(),
  ]);

  if (usageRes.error || eventsRes.error || todayEventsRes.error || refundEventsRes.error) {
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 500 });
  }

  // 결제 통계
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const completedPayments = payments.filter((payment) =>
    payment.status === "paid" || payment.status === "refunded" || payment.status === "partially_refunded"
  );
  const totalRevenue = completedPayments.reduce((sum, payment) => sum + getNetRevenueAmount(payment), 0);
  const totalPaymentCount = completedPayments.length;
  const totalPaidUsers = new Set(completedPayments.map((p) => p.user_id)).size;
  const todayRevenue = ((todayPaymentsRes.data ?? []) as PaymentRow[]).reduce(
    (sum, payment) => sum + getNetRevenueAmount(payment),
    0,
  );

  const usage = usageRes.data ?? [];
  const events = (eventsRes.data ?? []) as AdminEventRow[];
  const todayEvents = (todayEventsRes.data ?? []) as AdminEventRow[];
  const refundEvents = (refundEventsRes.data ?? []) as RefundEventRow[];
  const todayUsageRows = todayUsageRowsRes.data ?? [];

  const requestEventTypes = new Set([
    "generation_request_started",
    "generation_request_succeeded",
    "generation_request_failed",
    "audition_request_started",
    "audition_request_succeeded",
    "audition_request_failed",
  ]);

  const parseDuration = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const processingWindowMs = 15 * 60 * 1000;
  const recentRequestWindowMs = 10 * 60 * 1000;
  const requestNow = Date.now();

  const requestMap = new Map<string, {
    scope: "generate" | "audition";
    startedAt: number | null;
    finishedAt: number | null;
    finalType: "success" | "failed" | null;
    durationMs: number | null;
  }>();

  for (const event of todayEvents) {
    if (!requestEventTypes.has(event.event_type)) continue;

    const metadata = event.metadata ?? {};
    const requestKey = typeof metadata.request_key === "string" ? metadata.request_key : null;
    if (!requestKey) continue;

    const scope = event.event_type.startsWith("audition_") ? "audition" : "generate";
    const mapKey = `${scope}:${requestKey}`;
    const current = requestMap.get(mapKey) ?? {
      scope,
      startedAt: null,
      finishedAt: null,
      finalType: null,
      durationMs: null,
    };

    const createdAtTs = Date.parse(event.created_at);
    const durationMs = parseDuration(metadata.duration_ms);

    if (event.event_type.endsWith("_started")) {
      current.startedAt = Number.isNaN(createdAtTs)
        ? current.startedAt
        : current.startedAt === null
          ? createdAtTs
          : Math.min(current.startedAt, createdAtTs);
    }

    if (event.event_type.endsWith("_succeeded")) {
      current.finalType = "success";
      current.finishedAt = Number.isNaN(createdAtTs)
        ? current.finishedAt
        : current.finishedAt === null
          ? createdAtTs
          : Math.max(current.finishedAt, createdAtTs);
      current.durationMs = durationMs;
    }

    if (event.event_type.endsWith("_failed")) {
      current.finalType = "failed";
      current.finishedAt = Number.isNaN(createdAtTs)
        ? current.finishedAt
        : current.finishedAt === null
          ? createdAtTs
          : Math.max(current.finishedAt, createdAtTs);
      current.durationMs = durationMs;
    }

    requestMap.set(mapKey, current);
  }

  const requestSummaries = Array.from(requestMap.values());
  const requestsLast10m = requestSummaries.filter((item) =>
    item.startedAt !== null && requestNow - item.startedAt <= recentRequestWindowMs
  ).length;
  const processingNowEstimate = requestSummaries.filter((item) =>
    item.startedAt !== null &&
    requestNow - item.startedAt <= processingWindowMs &&
    item.finalType === null
  ).length;
  const completedRequests24h = requestSummaries.filter((item) => item.finalType !== null);
  const failedRequests24h = completedRequests24h.filter((item) => item.finalType === "failed").length;
  const requestFailureRate24h = completedRequests24h.length > 0
    ? Math.round((failedRequests24h / completedRequests24h.length) * 1000) / 10
    : 0;
  const durationValues = completedRequests24h
    .map((item) => item.durationMs)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const avgRequestDurationMs24h = durationValues.length > 0
    ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
    : 0;
  const requestCompleted24h = completedRequests24h.length;
  const generateCompleted24h = completedRequests24h.filter((item) => item.scope === "generate").length;
  const auditionCompleted24h = completedRequests24h.filter((item) => item.scope === "audition").length;

  const requestLoadStatus = (
    processingNowEstimate >= 6 ||
    requestsLast10m >= 18 ||
    requestFailureRate24h >= 12 ||
    avgRequestDurationMs24h >= 45000
  )
    ? "queue_recommended"
    : (
      processingNowEstimate >= 3 ||
      requestsLast10m >= 8 ||
      requestFailureRate24h >= 5 ||
      avgRequestDurationMs24h >= 25000
    )
      ? "watch"
      : "stable";

  // 전체 / 스타일별
  const total = usage.length;
  const todayTotal = todayUsageRes.count ?? 0;
  const guestCount = usage.filter(r => !r.user_id).length;
  const userCount = usage.filter(r => !!r.user_id).length;
  const uniqueLoggedInUsers = new Set(usage.filter(r => !!r.user_id).map(r => r.user_id)).size;

  const validStyleIds = new Set(ALL_STYLES.map(s => s.id));
  const counts: Record<string, { style_name: string; count: number }> = {};
  for (const row of usage) {
    if (!validStyleIds.has(row.style_id)) continue;
    if (!counts[row.style_id]) counts[row.style_id] = { style_name: STYLE_LABELS[row.style_id] ?? row.style_name, count: 0 };
    counts[row.style_id].count++;
  }
  const byStyle = Object.entries(counts).map(([style_id, v]) => ({
    style_id,
    style_name: v.style_name,
    count: v.count,
  })).sort((a, b) => b.count - a.count);

  const todayStyleCounts: Record<string, number> = {};
  for (const row of todayUsageRows) {
    if (!validStyleIds.has(row.style_id)) continue;
    todayStyleCounts[row.style_id] = (todayStyleCounts[row.style_id] ?? 0) + 1;
  }

  // 스타일별 베리에이션 집계
  const byStyleVariants: Record<string, Record<string, number>> = {};
  if (hasVariantCol) {
    for (const row of usage) {
      if (!validStyleIds.has(row.style_id)) continue;
      const v = (row as { style_id: string; variant?: string | null }).variant ?? "default";
      if (!byStyleVariants[row.style_id]) byStyleVariants[row.style_id] = {};
      byStyleVariants[row.style_id][v] = (byStyleVariants[row.style_id][v] ?? 0) + 1;
    }
  }

  // 이벤트 집계 + 스타일별 저장/공유 집계
  const eventCounts: Record<string, number> = {};
  const styleEvents: Record<string, { kakao: number; link: number; save: number }> = {};

  for (const e of events) {
    eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1;

    const styleId = (e.metadata as { style_id?: string } | null)?.style_id;
    if (!styleId || !validStyleIds.has(styleId)) continue;

    if (!styleEvents[styleId]) {
      styleEvents[styleId] = { kakao: 0, link: 0, save: 0 };
    }

    if (e.event_type === "share_kakao") {
      styleEvents[styleId].kakao++;
    } else if (e.event_type === "share_link_copy") {
      styleEvents[styleId].link++;
    } else if (e.event_type === "save_image") {
      styleEvents[styleId].save++;
    }
  }

  const todayEventCounts: Record<string, number> = {};
  for (const e of todayEvents) {
    todayEventCounts[e.event_type] = (todayEventCounts[e.event_type] ?? 0) + 1;
  }

  const labExperiments = [
    {
      key: "audition",
      label: "AI 오디션",
      totalParticipants: eventCounts["audition_request_started"] ?? eventCounts["audition_request_succeeded"] ?? 0,
      todayParticipants: todayEventCounts["audition_request_started"] ?? todayEventCounts["audition_request_succeeded"] ?? 0,
      completedCount: eventCounts["audition_request_succeeded"] ?? 0,
      todayCompletedCount: todayEventCounts["audition_request_succeeded"] ?? 0,
      unlockCount: (eventCounts["audition_share_kakao"] ?? 0) + (eventCounts["audition_share_link_copy"] ?? 0),
      todayUnlockCount: (todayEventCounts["audition_share_kakao"] ?? 0) + (todayEventCounts["audition_share_link_copy"] ?? 0),
      completedLabel: "분석 완료",
      unlockLabel: "공유",
      extraLabel: "스틸컷 생성",
      extraCount: usage.filter((row) => row.style_id === "audition").length,
      todayExtraCount: todayUsageRows.filter((row) => row.style_id === "audition").length,
    },
    {
      key: "personal_color",
      label: "퍼스널 컬러",
      totalParticipants: eventCounts["lab_personal_color_completed"] ?? 0,
      todayParticipants: todayEventCounts["lab_personal_color_completed"] ?? 0,
      completedCount: eventCounts["lab_personal_color_completed"] ?? 0,
      todayCompletedCount: todayEventCounts["lab_personal_color_completed"] ?? 0,
      unlockCount: 0,
      todayUnlockCount: 0,
      completedLabel: "완료",
      unlockLabel: null,
    },
    {
      key: "nabo",
      label: "내가 보는 너",
      totalParticipants: eventCounts["lab_nabo_room_created"] ?? 0,
      todayParticipants: todayEventCounts["lab_nabo_room_created"] ?? 0,
      completedCount: eventCounts["lab_nabo_response_completed"] ?? 0,
      todayCompletedCount: todayEventCounts["lab_nabo_response_completed"] ?? 0,
      unlockCount: eventCounts["lab_nabo_premium_access"] ?? 0,
      todayUnlockCount: todayEventCounts["lab_nabo_premium_access"] ?? 0,
      completedLabel: "응답 완료",
      unlockLabel: "상세 공개",
    },
    {
      key: "travel_together",
      label: "여행을 같이 간다면",
      totalParticipants: eventCounts["lab_travel_room_created"] ?? 0,
      todayParticipants: todayEventCounts["lab_travel_room_created"] ?? 0,
      completedCount: eventCounts["lab_travel_response_completed"] ?? 0,
      todayCompletedCount: todayEventCounts["lab_travel_response_completed"] ?? 0,
      unlockCount: eventCounts["lab_travel_unlock"] ?? 0,
      todayUnlockCount: todayEventCounts["lab_travel_unlock"] ?? 0,
      completedLabel: "응답 완료",
      unlockLabel: "상세 공개",
      extraLabel: "상대 응답 완료",
      extraCount: eventCounts["lab_travel_partner_ready"] ?? 0,
      todayExtraCount: todayEventCounts["lab_travel_partner_ready"] ?? 0,
    },
  ];

  // 스타일 이름 붙여서 배열로 변환 (공유 많은 순)
  const shareByStyleList = Object.entries(styleEvents).map(([style_id, v]) => ({
    style_id,
    style_name: STYLE_LABELS[style_id] ?? style_id,
    kakao: v.kakao,
    link: v.link,
    total: v.kakao + v.link,
  })).sort((a, b) => b.total - a.total);

  const todayStyleEvents: Record<string, { kakao: number; link: number; save: number }> = {};
  for (const e of todayEvents) {
    const styleId = (e.metadata as { style_id?: string } | null)?.style_id;
    if (!styleId || !validStyleIds.has(styleId)) continue;

    if (!todayStyleEvents[styleId]) {
      todayStyleEvents[styleId] = { kakao: 0, link: 0, save: 0 };
    }

    if (e.event_type === "share_kakao") {
      todayStyleEvents[styleId].kakao++;
    } else if (e.event_type === "share_link_copy") {
      todayStyleEvents[styleId].link++;
    } else if (e.event_type === "save_image") {
      todayStyleEvents[styleId].save++;
    }
  }

  const styleControlMap = Object.fromEntries(styleControls.map((row) => [row.style_id, row]));
  const usageCountMap = Object.fromEntries(byStyle.map((item) => [item.style_id, item.count]));
  const baseVisibleStyles = ALL_STYLES
    .map((style) => applyStyleControl(style, styleControlMap[style.id]))
    .filter((style) => !style.hidden);
  const styleOrder = baseVisibleStyles.reduce<Record<string, number>>((acc, style, index) => {
    acc[style.id] = index;
    return acc;
  }, {});
  const sortedVisibleStyles = [...baseVisibleStyles].sort((a, b) => {
    const aHasOptions = (STYLE_VARIANTS[a.id]?.length ?? 0) > 1;
    const bHasOptions = (STYLE_VARIANTS[b.id]?.length ?? 0) > 1;

    if (a.popular && b.popular) {
      const usageDiff = (usageCountMap[b.id] ?? 0) - (usageCountMap[a.id] ?? 0);
      if (usageDiff !== 0) return usageDiff;
      return styleOrder[a.id] - styleOrder[b.id];
    }
    if (a.popular) return -1;
    if (b.popular) return 1;
    if (aHasOptions && !bHasOptions) return -1;
    if (!aHasOptions && bHasOptions) return 1;
    return styleOrder[a.id] - styleOrder[b.id];
  });

  const stylePerformanceList = sortedVisibleStyles.map((style) => {
    const count = usageCountMap[style.id] ?? 0;
    const event = styleEvents[style.id] ?? { kakao: 0, link: 0, save: 0 };
    const shareCount = event.kakao + event.link;
    const saveRate = count > 0 ? Math.round((event.save / count) * 100) : 0;
    const shareRate = count > 0 ? Math.round((shareCount / count) * 100) : 0;
    return {
      style_id: style.id,
      style_name: style.name,
      count,
      saveCount: event.save,
      shareCount,
      saveRate,
      shareRate,
    };
  });

  const stylePerformance24hList = Object.entries(todayStyleCounts)
    .map(([style_id, count]) => {
      const event = todayStyleEvents[style_id] ?? { kakao: 0, link: 0, save: 0 };
      const shareCount = event.kakao + event.link;
      const saveRate = count > 0 ? Math.round((event.save / count) * 100) : 0;
      const shareRate = count > 0 ? Math.round((shareCount / count) * 100) : 0;
      return {
        style_id,
        style_name: STYLE_LABELS[style_id] ?? style_id,
        count,
        saveCount: event.save,
        shareCount,
        saveRate,
        shareRate,
      };
    })
    .sort((a, b) => b.count - a.count);

  const multiSourceStyleIds = new Set(
    ALL_STYLES.filter((style) => style.tag === "2인").map((style) => style.id)
  );
  const generalCardRows = usage.filter((row) => row.style_id !== "audition" && !multiSourceStyleIds.has(row.style_id));
  const multiSourceRows = usage.filter((row) => multiSourceStyleIds.has(row.style_id));
  const auditionStillRows = usage.filter((row) => row.style_id === "audition");
  const auditionAnalyzeRows = events.filter((event) => event.event_type === "audition_request_succeeded");
  const naboRoomRows = events.filter((event) => event.event_type === "lab_nabo_room_created");
  const travelRoomRows = events.filter((event) => event.event_type === "lab_travel_room_created");
  const personalColorRows = events.filter((event) => event.event_type === "lab_personal_color_completed");

  const collectUniqueUsers = (rows: Array<{ user_id: string | null }>) =>
    new Set(
      rows
        .map((row) => row.user_id)
        .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
    );

  const apiUsageBreakdownBase = [
    {
      key: "general-card",
      label: "일반",
      note: "기본 카드",
      count: generalCardRows.length,
      uniqueUsers: collectUniqueUsers(generalCardRows).size,
    },
    {
      key: "multi-card",
      label: "2인",
      note: "두 사람 카드",
      count: multiSourceRows.length,
      uniqueUsers: collectUniqueUsers(multiSourceRows).size,
    },
    {
      key: "audition",
      label: "오디션",
      note: "분석 + 스틸컷",
      count: auditionAnalyzeRows.length + auditionStillRows.length,
      uniqueUsers: new Set([
        ...collectUniqueUsers(auditionAnalyzeRows),
        ...collectUniqueUsers(auditionStillRows),
      ]).size,
    },
    {
      key: "nabo",
      label: "내가 보는 너",
      note: "실험실 관계 리포트",
      count: naboRoomRows.length,
      uniqueUsers: collectUniqueUsers(naboRoomRows).size,
    },
    {
      key: "travel_together",
      label: "여행",
      note: "실험실 여행 궁합",
      count: travelRoomRows.length,
      uniqueUsers: collectUniqueUsers(travelRoomRows).size,
    },
    {
      key: "personal_color",
      label: "퍼스널 컬러",
      note: "브라우저 분석 완료",
      count: personalColorRows.length,
      uniqueUsers: collectUniqueUsers(personalColorRows).size,
    },
  ] as const;
  const trackedApiUsageTotal = apiUsageBreakdownBase.reduce((sum, item) => sum + item.count, 0);
  const apiUsageBreakdown = apiUsageBreakdownBase.map((item) => ({
    ...item,
    userRatio: (usersRes.count ?? 0) > 0 ? Math.round((item.uniqueUsers / (usersRes.count ?? 0)) * 1000) / 10 : 0,
    usageRatio: trackedApiUsageTotal > 0 ? Math.round((item.count / trackedApiUsageTotal) * 1000) / 10 : 0,
  }));

  const marStyleCount = marUsageRes.count ?? 0;
  const aprStyleCount = aprUsageRes.count ?? 0;
  const marAuditionCount = marAuditionRes.count ?? 0;
  const aprAuditionCount = aprAuditionRes.count ?? 0;
  const marAuditionStillCount = marAuditionStillRes.count ?? 0;
  const aprAuditionStillCount = aprAuditionStillRes.count ?? 0;

  const aprReferenceStyleCount = aprRefUsageRes.count ?? 0;
  const aprReferenceAuditionCount = aprRefAuditionRes.count ?? 0;
  const aprReferenceAuditionStillCount = aprRefAuditionStillRes.count ?? 0;
  const aprReferenceWeightedOps = calcWeightedOps(
    aprReferenceStyleCount,
    aprReferenceAuditionCount,
    aprReferenceAuditionStillCount,
  );
  const calibratedUnitCost = aprReferenceWeightedOps > 0
    ? APR_REFERENCE_BILLING.actualCost / aprReferenceWeightedOps
    : 0;
  const aprEstimatedApiCost = Math.round(
    calcWeightedOps(aprStyleCount, aprAuditionCount, aprAuditionStillCount) * calibratedUnitCost
  );
  const marResolvedApiCost = marBillingSnapshot?.amount ?? MAR_ACTUAL_API_COST;
  const aprResolvedApiCost = aprBillingSnapshot?.amount ?? aprEstimatedApiCost;
  const marCostSource = marBillingSnapshot ? "bigquery_actual" : "manual_actual";
  const aprCostSource = aprBillingSnapshot ? "bigquery_actual" : "reference_weighted_estimate";

  const userList = [...(userListRes.data ?? [])];

  const userIds = userList.map((user) => user.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  const activityMap = new Map<string, string>();

  const setLatestActivity = (userId: string | null, createdAt: string | null | undefined) => {
    if (!userId || !createdAt) return;
    const prev = activityMap.get(userId);
    if (!prev || new Date(createdAt).getTime() > new Date(prev).getTime()) {
      activityMap.set(userId, createdAt);
    }
  };

  if (userIds.length > 0) {
    const [usageActivityRes, auditionActivityRes, eventActivityRes] = await Promise.all([
      supabase
        .from("style_usage")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("audition_history")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("user_events")
        .select("user_id, created_at, event_type")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    for (const row of (usageActivityRes.data ?? []) as UserActivityRow[]) {
      setLatestActivity(row.user_id, row.created_at);
    }

    for (const row of (auditionActivityRes.data ?? []) as UserActivityRow[]) {
      setLatestActivity(row.user_id, row.created_at);
    }

    for (const row of (eventActivityRes.data ?? []) as UserActivityRow[]) {
      if (row.event_type === "login" || row.event_type === "signup_bonus") continue;
      setLatestActivity(row.user_id, row.created_at);
    }
  }

  const userListWithActivity = userList
    .map((user) => {
      const actualActivityAt = activityMap.get(user.id) ?? null;
      const lastSeenAt = [actualActivityAt, user.last_login_at, user.created_at]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

      return {
        ...user,
        last_activity_at: lastSeenAt,
      };
    })
    .sort((left, right) => {
      const leftActivity = left.last_activity_at ? new Date(left.last_activity_at).getTime() : 0;
      const rightActivity = right.last_activity_at ? new Date(right.last_activity_at).getTime() : 0;
      if (rightActivity !== leftActivity) return rightActivity - leftActivity;

      const leftCreated = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightCreated = right.created_at ? new Date(right.created_at).getTime() : 0;
      return rightCreated - leftCreated;
    });

  const refundEvents24h = todayEvents.filter((event) => event.event_type === "generation_credit_refund");
  const generationRefundTotal24h = refundEvents24h.length;
  const generationRefundCredits24h = refundEvents24h.reduce((sum, event) => {
    const rawCredits = (event.metadata as { credits?: number | string } | null)?.credits ?? 0;
    const credits = typeof rawCredits === "number" ? rawCredits : Number(rawCredits);
    return sum + (Number.isFinite(credits) ? credits : 0);
  }, 0);
  const generationRefundUserCount24h = new Set(
    refundEvents24h
      .map((event) => event.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  ).size;

  const refundNicknameMap = new Map(userListWithActivity.map((user) => [user.id, user.nickname]));
  const missingRefundUserIds = Array.from(
    new Set(
      refundEvents
        .map((event) => event.user_id)
        .filter((userId): userId is string => typeof userId === "string" && userId.length > 0 && !refundNicknameMap.has(userId))
    )
  );

  if (missingRefundUserIds.length > 0) {
    const { data: extraRefundUsers } = await supabase
      .from("users")
      .select("id, nickname")
      .in("id", missingRefundUserIds);

    for (const user of extraRefundUsers ?? []) {
      refundNicknameMap.set(user.id, user.nickname);
    }
  }

  const recentGenerationRefunds = refundEvents.map((event) => {
    const metadata = event.metadata ?? {};
    const rawCredits = metadata.credits ?? 0;
    const credits = typeof rawCredits === "number" ? rawCredits : Number(rawCredits);
    const styleId = typeof metadata.style_id === "string" ? metadata.style_id : "unknown";

    return {
      id: String(event.id),
      user_id: event.user_id,
      nickname: event.user_id ? (refundNicknameMap.get(event.user_id) ?? null) : null,
      style_id: styleId,
      style_name: STYLE_LABELS[styleId] ?? styleId,
      credits: Number.isFinite(credits) ? credits : 0,
      reason: typeof metadata.reason === "string" ? metadata.reason : null,
      message: typeof metadata.message === "string" ? metadata.message : null,
      created_at: event.created_at,
    };
  });

  return NextResponse.json({
    userList: userListWithActivity,
    paymentList: payments,
    total,
    todayTotal,
    guestCount,
    userCount,
    guestRatio: total > 0 ? Math.round((guestCount / total) * 100) : 0,
    userRatio: total > 0 ? Math.round((userCount / total) * 100) : 0,
    byStyle,
    byStyleVariants,
    styleControls,
    ...generationErrorOverview,
    requestLoadStatus,
    requestsLast10m,
    processingNowEstimate,
    requestFailureRate24h,
    avgRequestDurationMs24h,
    requestCompleted24h,
    generateCompleted24h,
    auditionCompleted24h,
    generationRefundTotal24h,
    generationRefundCredits24h,
    generationRefundUserCount24h,
    recentGenerationRefunds,
    apiUsageBreakdown,
    totalUsers: usersRes.count ?? 0,
    todaySignupCount: todaySignupRes.count ?? 0,
    uniqueLoggedInUsers,
    shareKakao: eventCounts["share_kakao"] ?? 0,
    shareLinkCopy: eventCounts["share_link_copy"] ?? 0,
    saveImage: eventCounts["save_image"] ?? 0,
    labExperiments,
    shareByStyleList,
    stylePerformanceList,
    stylePerformance24hList,
    transformEvents: eventCounts["transform"] ?? 0,
    auditionShareKakao: eventCounts["audition_share_kakao"] ?? 0,
    auditionShareLinkCopy: eventCounts["audition_share_link_copy"] ?? 0,
    labNaboShareKakao: eventCounts["lab_nabo_share_kakao"] ?? 0,
    totalRevenue,
    totalPaymentCount,
    totalPaidUsers,
    todayRevenue,
    monthlyCosts: {
      "2026-03": {
        styleCount: marStyleCount,
        auditionCount: marAuditionCount,
        auditionStillCount: marAuditionStillCount,
        apiCost: marResolvedApiCost,
        revenue: ((marRevenueRes.data ?? []) as PaymentRow[]).reduce((sum, payment) => sum + getNetRevenueAmount(payment), 0),
        costSource: marCostSource,
        currency: marBillingSnapshot?.currency ?? "KRW",
      },
      "2026-04": {
        styleCount: aprStyleCount,
        auditionCount: aprAuditionCount,
        auditionStillCount: aprAuditionStillCount,
        apiCost: aprResolvedApiCost,
        revenue: ((aprRevenueRes.data ?? []) as PaymentRow[]).reduce((sum, payment) => sum + getNetRevenueAmount(payment), 0),
        shareKakao: aprShareKakaoRes.count ?? 0,
        shareLink: aprShareLinkRes.count ?? 0,
        saveImage: aprSaveRes.count ?? 0,
        auditionShareKakao: aprAuditionShareKakaoRes.count ?? 0,
        auditionShareLink: aprAuditionShareLinkRes.count ?? 0,
        estimateMode: "reference-weighted",
        costSource: aprCostSource,
        currency: aprBillingSnapshot?.currency ?? "KRW",
        weightUnitCost: Math.round(calibratedUnitCost * 100) / 100,
        weights: COST_WEIGHTS,
        referenceWindow: {
          from: APR_REFERENCE_BILLING.from,
          to: APR_REFERENCE_BILLING.to,
          actualCost: APR_REFERENCE_BILLING.actualCost,
          styleCount: aprReferenceStyleCount,
          auditionCount: aprReferenceAuditionCount,
          auditionStillCount: aprReferenceAuditionStillCount,
          weightedOps: aprReferenceWeightedOps,
          matchedEstimate: Math.round(aprReferenceWeightedOps * calibratedUnitCost),
        },
      },
    },
  });
}
