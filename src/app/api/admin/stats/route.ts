import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const [usageRes, eventsRes, usersRes, todayUsageRes, paymentsRes, todayPaymentsRes, userListRes] = await Promise.all([
    supabase.from("style_usage").select("style_id, style_name, user_id"),
    supabase.from("user_events").select("event_type"),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("style_usage").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
    supabase.from("payments").select("id, amount, credits, user_id, status, created_at").order("created_at", { ascending: false }),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", todayIso),
    supabase.from("users").select("id, nickname").order("created_at", { ascending: false }).limit(50),
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

  const counts: Record<string, { style_name: string; count: number }> = {};
  for (const row of usage) {
    if (!counts[row.style_id]) counts[row.style_id] = { style_name: row.style_name, count: 0 };
    counts[row.style_id].count++;
  }
  const byStyle = Object.entries(counts).map(([style_id, v]) => ({
    style_id,
    style_name: v.style_name,
    count: v.count,
  }));

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
    totalUsers: usersRes.count ?? 0,
    shareKakao: eventCounts["share_kakao"] ?? 0,
    shareLinkCopy: eventCounts["share_link_copy"] ?? 0,
    revisit: eventCounts["revisit"] ?? 0,
    transformEvents: eventCounts["transform"] ?? 0,
    totalRevenue,
    totalPaymentCount,
    todayRevenue,
  });
}
