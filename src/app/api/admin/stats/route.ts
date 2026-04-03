import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ALL_STYLES, STYLE_LABELS } from "@/lib/styles";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const todayIso = new Date(Date.now() - 24 * 3600000).toISOString();

  // ── 월별 비용 & 손익 계산 상수 ──────────────────────────────────────
  const STYLE_UNIT_COST = 117;    // ₩/건 (3월 실측 역산)
  const AUDITION_UNIT_COST = 468; // ₩/건 (Gemini 4회 호출 기준)
  const MAR_ACTUAL_API_COST = 16313; // 3월 Google 청구서 실측값 (세전)

  // variant 컬럼이 없을 수 있으므로 먼저 시도, 실패하면 fallback
  const usageWithVariant = await supabase.from("style_usage").select("style_id, style_name, user_id, variant");
  const hasVariantCol = !usageWithVariant.error;
  const usageRes = hasVariantCol
    ? usageWithVariant
    : await supabase.from("style_usage").select("style_id, style_name, user_id");

  const [eventsRes, usersRes, todayUsageRes, paymentsRes, todayPaymentsRes, userListRes,
    marUsageRes, aprUsageRes, marAuditionRes, aprAuditionRes, marRevenueRes, aprRevenueRes] = await Promise.all([
    supabase.from("user_events").select("event_type"),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("style_usage").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("payments").select("id, amount, credits, user_id, status, created_at").order("created_at", { ascending: false }),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", todayIso),
    supabase.from("users").select("id, nickname").order("created_at", { ascending: false }).limit(500),
    // 월별 스타일 변환
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("style_usage").select("style_id", { count: "exact", head: true }).gte("created_at", "2026-04-01").lte("created_at", "2026-04-30T23:59:59"),
    // 월별 오디션
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "audition_complete").gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("user_events").select("event_type", { count: "exact", head: true }).eq("event_type", "audition_complete").gte("created_at", "2026-04-01").lte("created_at", "2026-04-30T23:59:59"),
    // 월별 매출
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", "2026-03-01").lte("created_at", "2026-03-31T23:59:59"),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", "2026-04-01").lte("created_at", "2026-04-30T23:59:59"),
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

  // 전체 / 스타일별
  const total = usage.length;
  const todayTotal = todayUsageRes.count ?? 0;
  const guestCount = usage.filter(r => !r.user_id).length;
  const userCount = usage.filter(r => !!r.user_id).length;
  const uniqueLoggedInUsers = new Set(usage.filter(r => !!r.user_id).map(r => r.user_id)).size;

  const validStyleIds = new Set(ALL_STYLES.map(s => s.id));
  const counts: Record<string, { style_name: string; count: number }> = {};
  for (const row of usage) {
    if (!validStyleIds.has(row.style_id)) continue; // 삭제된 테스트 스타일 제외
    if (!counts[row.style_id]) counts[row.style_id] = { style_name: STYLE_LABELS[row.style_id] ?? row.style_name, count: 0 };
    counts[row.style_id].count++;
  }
  const byStyle = Object.entries(counts).map(([style_id, v]) => ({
    style_id,
    style_name: v.style_name,
    count: v.count,
  })).sort((a, b) => b.count - a.count);

  // 스타일별 베리에이션 집계 (variant 컬럼이 없으면 전부 "default"로 처리)
  const byStyleVariants: Record<string, Record<string, number>> = {};
  if (hasVariantCol) {
    for (const row of usage) {
      if (!validStyleIds.has(row.style_id)) continue;
      const v = (row as { style_id: string; variant?: string | null }).variant ?? "default";
      if (!byStyleVariants[row.style_id]) byStyleVariants[row.style_id] = {};
      byStyleVariants[row.style_id][v] = (byStyleVariants[row.style_id][v] ?? 0) + 1;
    }
  }

  // 이벤트 집계
  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1;
  }

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
    totalUsers: usersRes.count ?? 0,
    uniqueLoggedInUsers,
    shareKakao: eventCounts["share_kakao"] ?? 0,
    shareLinkCopy: eventCounts["share_link_copy"] ?? 0,
    transformEvents: eventCounts["transform"] ?? 0,
    auditionShareKakao: eventCounts["audition_share_kakao"] ?? 0,
    auditionShareLinkCopy: eventCounts["audition_share_link_copy"] ?? 0,
    totalRevenue,
    totalPaymentCount,
    todayRevenue,
    monthlyCosts: {
      "2026-03": {
        styleCount: marUsageRes.count ?? 0,
        auditionCount: marAuditionRes.count ?? 0,
        apiCost: MAR_ACTUAL_API_COST,
        revenue: (marRevenueRes.data ?? []).reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0),
      },
      "2026-04": {
        styleCount: aprUsageRes.count ?? 0,
        auditionCount: aprAuditionRes.count ?? 0,
        apiCost: Math.round((aprUsageRes.count ?? 0) * STYLE_UNIT_COST + (aprAuditionRes.count ?? 0) * AUDITION_UNIT_COST),
        revenue: (aprRevenueRes.data ?? []).reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0),
      },
    },
  });
}
