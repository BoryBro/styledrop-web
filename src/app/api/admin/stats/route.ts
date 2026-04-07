import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGenerationErrorOverview } from "@/lib/generation-errors.server";
import { loadStyleControls } from "@/lib/style-controls.server";
import { applyStyleControl } from "@/lib/style-controls";
import { getGeminiBillingSnapshot, hasGeminiBillingConfig } from "@/lib/google-billing.server";
import { ALL_STYLES, STYLE_LABELS } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

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

  const [eventsRes, todayEventsRes, usersRes, todaySignupRes, todayUsageRes, todayUsageRowsRes, paymentsRes, todayPaymentsRes, userListRes,
    marUsageRes, aprUsageRes, marAuditionRes, aprAuditionRes, marAuditionStillRes, aprAuditionStillRes,
    aprRefUsageRes, aprRefAuditionRes, aprRefAuditionStillRes,
    marRevenueRes, aprRevenueRes,
    aprShareKakaoRes, aprShareLinkRes, aprSaveRes, aprAuditionShareKakaoRes, aprAuditionShareLinkRes,
    marBillingSnapshot, aprBillingSnapshot,
    styleControls,
    generationErrorOverview,
  ] = await Promise.all([
    // metadata 포함해서 공유 이벤트의 style_id 집계 가능하도록
    supabase.from("user_events").select("event_type, metadata"),
    supabase.from("user_events").select("event_type, metadata").gte("created_at", todayIso),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("style_usage").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("style_usage").select("style_id").gte("created_at", todayIso),
    supabase.from("payments").select("id, amount, credits, user_id, status, created_at").order("created_at", { ascending: false }),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", todayIso),
    supabase.from("users").select("id, nickname, created_at, last_login_at").order("created_at", { ascending: false }).limit(500),
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
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", currentMonthStartIso).lte("created_at", nowIso),
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

  if (usageRes.error || eventsRes.error) {
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 500 });
  }

  // 결제 통계
  const payments = paymentsRes.data ?? [];
  const paidPayments = payments.filter(p => p.status === "paid");
  const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const totalPaymentCount = paidPayments.length;
  const todayRevenue = (todayPaymentsRes.data ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const usage = usageRes.data ?? [];
  const events = eventsRes.data ?? [];
  const todayEvents = todayEventsRes.data ?? [];
  const todayUsageRows = todayUsageRowsRes.data ?? [];

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

  return NextResponse.json({
    userList: userListRes.data ?? [],
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
    totalUsers: usersRes.count ?? 0,
    todaySignupCount: todaySignupRes.count ?? 0,
    uniqueLoggedInUsers,
    shareKakao: eventCounts["share_kakao"] ?? 0,
    shareLinkCopy: eventCounts["share_link_copy"] ?? 0,
    saveImage: eventCounts["save_image"] ?? 0,
    shareByStyleList,
    stylePerformanceList,
    stylePerformance24hList,
    transformEvents: eventCounts["transform"] ?? 0,
    auditionShareKakao: eventCounts["audition_share_kakao"] ?? 0,
    auditionShareLinkCopy: eventCounts["audition_share_link_copy"] ?? 0,
    totalRevenue,
    totalPaymentCount,
    todayRevenue,
    monthlyCosts: {
      "2026-03": {
        styleCount: marStyleCount,
        auditionCount: marAuditionCount,
        auditionStillCount: marAuditionStillCount,
        apiCost: marResolvedApiCost,
        revenue: (marRevenueRes.data ?? []).reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0),
        costSource: marCostSource,
        currency: marBillingSnapshot?.currency ?? "KRW",
      },
      "2026-04": {
        styleCount: aprStyleCount,
        auditionCount: aprAuditionCount,
        auditionStillCount: aprAuditionStillCount,
        apiCost: aprResolvedApiCost,
        revenue: (aprRevenueRes.data ?? []).reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0),
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
