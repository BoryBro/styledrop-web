"use client";

import { useState, useEffect, useRef } from "react";
import {
  AUDITION_CONTROL_ID,
  PERSONAL_COLOR_CONTROL_ID,
  applyStyleControl,
  type StyleControlState,
} from "@/lib/style-controls";
import { REFUND_UNIT_PRICE } from "@/lib/payment-policy";
import { ALL_STYLES } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

const ADMIN_UI_VERSION = "v2.7.0-audition-ops";

type AdminTab = "ops" | "metrics" | "revenue" | "users";

type Notice = { id: number; text: string; active: boolean };
type UserItem = {
  id: string;
  nickname: string | null;
  created_at: string | null;
  last_login_at: string | null;
  last_activity_at?: string | null;
};
type PaymentItem = {
  id: string;
  user_id: string;
  amount: number;
  credits: number;
  status: string;
  created_at: string;
  refunded_amount?: number | null;
  refunded_at?: string | null;
  refund_type?: string | null;
};
type StyleStat = { style_id: string; style_name: string; count: number };
type GenerationErrorSummary = {
  style_id: string;
  style_name: string;
  errorCount: number;
  successCount24h: number;
  errorRate: number;
  topErrorType: string;
  lastErrorAt: string;
  latestSuccessAt: string | null;
  isResolved: boolean;
};
type RecentGenerationError = {
  id: number;
  style_id: string;
  style_name: string;
  variant: string | null;
  error_type: string;
  message: string | null;
  finish_reason: string | null;
  created_at: string;
  latestSuccessAt: string | null;
  isResolved: boolean;
};
type RecentGenerationRefund = {
  id: string;
  user_id: string | null;
  nickname: string | null;
  style_id: string;
  style_name: string;
  credits: number;
  reason: string | null;
  message: string | null;
  created_at: string;
};
type Stats = {
  styleControls: StyleControlState[];
  requestLoadStatus: "stable" | "watch" | "queue_recommended";
  requestsLast10m: number;
  processingNowEstimate: number;
  requestFailureRate24h: number;
  avgRequestDurationMs24h: number;
  requestCompleted24h: number;
  generateCompleted24h: number;
  auditionCompleted24h: number;
  generationErrorTotal24h: number;
  generationErrorSummary: GenerationErrorSummary[];
  recentGenerationErrors: RecentGenerationError[];
  generationRefundTotal24h: number;
  generationRefundCredits24h: number;
  generationRefundUserCount24h: number;
  recentGenerationRefunds: RecentGenerationRefund[];
  ghostUserCount: number;
  ghostUsersPreview: UserItem[];
  stylePerformanceList: {
    style_id: string;
    style_name: string;
    count: number;
    saveCount: number;
    shareCount: number;
    saveRate: number;
    shareRate: number;
  }[];
  stylePerformance24hList: {
    style_id: string;
    style_name: string;
    count: number;
    saveCount: number;
    shareCount: number;
    saveRate: number;
    shareRate: number;
  }[];
  userList: UserItem[];
  paymentList: PaymentItem[];
  total: number;
  todayTotal: number;
  guestCount: number;
  userCount: number;
  guestRatio: number;
  userRatio: number;
  byStyle: StyleStat[];
  byStyleVariants: Record<string, Record<string, number>>;
  totalUsers: number;
  todaySignupCount: number;
  uniqueLoggedInUsers: number;
  shareKakao: number;
  shareLinkCopy: number;
  saveImage: number;
  transformEvents: number;
  auditionShareKakao: number;
  auditionShareLinkCopy: number;
  shareByStyleList: { style_id: string; style_name: string; kakao: number; link: number; total: number }[];
  totalRevenue: number;
  totalPaymentCount: number;
  todayRevenue: number;
  monthlyCosts: Record<string, {
    styleCount: number;
    auditionCount: number;
    auditionStillCount?: number;
    apiCost: number;
    revenue: number;
    costSource?: string;
    currency?: string | null;
    estimateMode?: string;
    weightUnitCost?: number;
    weights?: {
      style: number;
      auditionAnalyze: number;
      auditionStill: number;
    };
    referenceWindow?: {
      from: string;
      to: string;
      actualCost: number;
      styleCount: number;
      auditionCount: number;
      auditionStillCount: number;
      weightedOps: number;
      matchedEstimate: number;
    };
  }>;
};

type MonthlyCost = {
  styleCount: number; auditionCount: number; auditionStillCount?: number; apiCost: number; revenue: number;
  costSource?: string;
  currency?: string | null;
  shareKakao?: number; shareLink?: number; saveImage?: number;
  auditionShareKakao?: number; auditionShareLink?: number;
  estimateMode?: string;
  weightUnitCost?: number;
  weights?: {
    style: number;
    auditionAnalyze: number;
    auditionStill: number;
  };
  referenceWindow?: {
    from: string;
    to: string;
    actualCost: number;
    styleCount: number;
    auditionCount: number;
    auditionStillCount: number;
    weightedOps: number;
    matchedEstimate: number;
  };
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function refundReasonLabel(reason?: string | null) {
  if (reason === "no_image") return "이미지 미생성";
  if (reason === "exception") return "예외";
  return "실패";
}

function generationErrorTypeLabel(errorType?: string | null) {
  if (errorType === "exception") return "예외";
  if (errorType === "no_image") return "이미지 미생성";
  if (!errorType || errorType === "unknown") return "알 수 없음";
  return errorType;
}

function parseGenerationErrorMessage(message?: string | null) {
  if (!message) {
    return {
      summary: "상세 메시지가 남지 않았습니다.",
      code: null as number | null,
      pretty: null as string | null,
    };
  }

  try {
    const parsed = JSON.parse(message) as {
      error?: { code?: number; message?: string; status?: string };
    };
    const code = typeof parsed?.error?.code === "number" ? parsed.error.code : null;
    const parts = [
      code ? `코드 ${code}` : null,
      parsed?.error?.status ? String(parsed.error.status) : null,
      parsed?.error?.message ? String(parsed.error.message) : null,
    ].filter((part): part is string => Boolean(part));

    return {
      summary: parts.length > 0 ? parts.join(" · ") : message,
      code,
      pretty: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return {
      summary: message,
      code: null as number | null,
      pretty: null as string | null,
    };
  }
}

function getGenerationIssueMeta(item: {
  isResolved: boolean;
  latestSuccessAt?: string | null;
  lastErrorAt: string;
  errorRate?: number;
}) {
  if (item.isResolved && item.latestSuccessAt) {
    return {
      label: "복구됨",
      badgeClass: "bg-[#EEF8F1] text-[#18794E] border border-[#B7E1C4]",
      detail: `오류 이후 ${relativeTime(item.latestSuccessAt)} 다시 성공했습니다.`,
      action: "조치 불필요",
      needsAction: false,
    };
  }

  return {
    label: "미해결",
    badgeClass: "bg-red-50 text-red-600 border border-red-200",
    detail: item.errorRate === 100
      ? "오류 이후 성공 기록이 없습니다. 생성 중지 검토가 필요합니다."
      : "오류 이후 성공 기록이 없어 재현 확인이 필요합니다.",
    action: item.errorRate === 100 ? "생성 중지 검토" : "재현 확인",
    needsAction: true,
  };
}

function compactUserLabel(nickname?: string | null, userId?: string | null) {
  if (nickname && nickname.trim().length > 0) return nickname.trim();
  if (!userId) return "알 수 없음";
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMs(ms?: number) {
  if (!ms || ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}초`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.round(seconds % 60);
  return `${minutes}분 ${remainSeconds}초`;
}

function getRequestLoadMeta(status: Stats["requestLoadStatus"]) {
  if (status === "queue_recommended") {
    return {
      label: "큐 준비 권장",
      className: "bg-[#FFF4ED] text-[#C9571A] border border-[#F3D2BF]",
      description: "지금은 요청이 몰릴 때를 대비한 대기열 설계를 시작하는 게 안전합니다.",
    };
  }

  if (status === "watch") {
    return {
      label: "관찰 단계",
      className: "bg-[#FFF9E8] text-[#9A6700] border border-[#F3E2A9]",
      description: "아직 급한 수준은 아니지만, 실패율과 처리 시간을 계속 보면서 준비해야 합니다.",
    };
  }

  return {
    label: "안정",
    className: "bg-[#EEF8F1] text-[#18794E] border border-[#B7E1C4]",
    description: "지금은 중복 방지와 환불 보호만으로도 운영 가능한 수준입니다.",
  };
}

function MonthlyCostSection({ monthlyCosts }: { monthlyCosts: Record<string, MonthlyCost> }) {
  const [activeMonth, setActiveMonth] = useState("2026-04");
  const months = [
    { key: "2026-03", label: "3월", note: "참고" },
    { key: "2026-04", label: "4월", note: "현재" },
  ];
  const m = monthlyCosts?.[activeMonth];
  const isMar = activeMonth === "2026-03";
  const unitCost = m?.weightUnitCost ?? 0;
  const styleCost = isMar ? null : m ? Math.round(m.styleCount * unitCost * (m.weights?.style ?? 1)) : 0;
  const auditionCost = isMar ? null : m ? Math.round(m.auditionCount * unitCost * (m.weights?.auditionAnalyze ?? 2)) : 0;
  const auditionStillCost = isMar ? null : m ? Math.round((m.auditionStillCount ?? 0) * unitCost * (m.weights?.auditionStill ?? 1)) : 0;
  const profit = m ? m.revenue - m.apiCost : 0;
  const costRatio = m && m.revenue > 0 ? Math.round((m.apiCost / m.revenue) * 100) : 0;
  const profitRatio = m && m.revenue > 0 ? Math.round((profit / m.revenue) * 100) : 0;

  const isActual = m?.costSource === "bigquery_actual" || m?.costSource === "manual_actual";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1">비용 · 매출 · 남는 돈</p>
      <div className="flex gap-2">
        {months.map(({ key, label, note }) => (
          <button
            key={key}
            onClick={() => setActiveMonth(key)}
            className={`flex-1 py-2 rounded-xl text-[14px] font-bold transition-colors border ${
              activeMonth === key ? "bg-[#C9571A] border-[#C9571A] text-white" : "bg-gray-100 border-gray-200 text-gray-600"
            }`}
          >
            {label} <span className="text-[12px] font-normal opacity-60">{note}</span>
          </button>
        ))}
      </div>
      {m && (
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-gray-900">
                {activeMonth === "2026-04" ? "이번 달 손익 요약" : "3월 참고 손익"}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                매출에서 AI 비용만 뺀 금액입니다.
              </p>
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {isActual ? "실제 청구서 기준" : "실제 청구서 보정 추정"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniCard label="들어온 돈" value={`₩${m.revenue.toLocaleString()}`} accent />
            <MiniCard label="AI 비용" value={`₩${m.apiCost.toLocaleString()}`} />
            <MiniCard label="남는 돈" value={`${profit >= 0 ? "+" : ""}₩${profit.toLocaleString()}`} accent={profit >= 0} />
            <MiniCard label="AI 원가율" value={m.revenue > 0 ? `${costRatio}%` : "—"} />
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">스타일 카드</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.styleCount}건
                {!isMar && <span className="text-gray-500 font-medium"> · ₩{(styleCost ?? 0).toLocaleString()}</span>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">AI 오디션</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.auditionCount}건
                {!isMar && <span className="text-gray-500 font-medium"> · ₩{(auditionCost ?? 0).toLocaleString()}</span>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">오디션 스틸컷</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.auditionStillCount ?? 0}건
                {!isMar && <span className="text-gray-500 font-medium"> · ₩{(auditionStillCost ?? 0).toLocaleString()}</span>}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
              <span className="text-[13px] text-gray-500">남는 비율</span>
              <span className={`text-[13px] font-bold tabular-nums ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                {m.revenue > 0 ? `${profitRatio}%` : "—"}
              </span>
            </div>
          </div>

          {!isMar && !isActual && m.referenceWindow && (
            <div className="rounded-xl bg-[#FFF7F2] border border-[#F0D5C6] px-3 py-3 flex flex-col gap-2">
              <p className="text-[13px] font-bold text-gray-900">실측 보정 기준</p>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">4/1~4/7 실제 Gemini 청구서</span>
                <span className="text-[13px] font-bold text-[#C9571A]">₩{m.referenceWindow.actualCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">같은 기간 사용량</span>
                <span className="text-[12px] font-medium text-gray-900">
                  스타일 {m.referenceWindow.styleCount} · 오디션 {m.referenceWindow.auditionCount} · 스틸컷 {m.referenceWindow.auditionStillCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">보정 1유닛 단가</span>
                <span className="text-[12px] font-medium text-gray-900">₩{(m.weightUnitCost ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                스타일 1x, 오디션 분석 2x, 오디션 스틸컷 1x 가중치로 계산합니다.
              </p>
            </div>
          )}

          <div className="text-[11px] text-gray-400 px-1 leading-relaxed">
            <p>매출 = 결제 완료 금액 기준</p>
            <p>AI 비용 = {isActual ? "Google Billing export 실제값" : "기능별 사용량 x 실측 청구서 보정 단가"}</p>
            {isActual
              ? <p>{activeMonth} 비용은 실제 Gemini 청구 데이터 기준입니다.</p>
              : <p>4월은 4/1~4/7 실제 청구서 15,999원을 기준으로 보정한 추정치입니다.</p>}
            <p>이 숫자는 PG 수수료, 광고비, 인건비 제외 기준입니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const PROFIT_PACKAGES = [
  { id: "basic", label: "Basic", credits: 10, price: 1900, priceStr: "1,900" },
  { id: "plus",  label: "Plus",  credits: 30, price: 4900, priceStr: "4,900" },
  { id: "pro",   label: "Pro",   credits: 70, price: 9900, priceStr: "9,900" },
] as const;
// 실측 기준 API 단가
const API_UNIT_COST = 111.1;          // 일반 1크레딧 → 1 API call
const API_COST_COUPLE = 111.1;        // 2인+ 2크레딧 → 1 API call (크레딧당 55.5원)
const API_COST_AUDITION = 333.3;      // 오디션 5크레딧 → analyze(2)+still(1) = 3 weighted ops
const KAKAO_FEE_RATE = 0.032;
const VAT_RATE = 0.10;

function ProfitCalculator() {
  const [pkgId, setPkgId] = useState<"basic" | "plus" | "pro">("plus");
  const [buyers, setBuyers] = useState(10);
  // 사용 분포: 세 값의 합 = 100
  const [pctNormal, setPctNormal] = useState(60);
  const [pctCouple, setPctCouple] = useState(20);
  const [pctAudition, setPctAudition] = useState(20);

  const pkg = PROFIT_PACKAGES.find((p) => p.id === pkgId)!;
  const netPerSale = (pkg.price / (1 + VAT_RATE)) - (pkg.price * KAKAO_FEE_RATE);
  const totalCredits = buyers * pkg.credits;

  // 크레딧 분배
  const normalCredits   = totalCredits * (pctNormal / 100);
  const coupleCredits   = totalCredits * (pctCouple / 100);
  const auditionCredits = totalCredits * (pctAudition / 100);

  // API 호출 수 (크레딧 → 호출)
  const normalCalls   = normalCredits * 1;          // 1크레딧 = 1호출
  const coupleCalls   = coupleCredits / 2;           // 2크레딧 = 1호출
  const auditionCalls = auditionCredits / 5;         // 5크레딧 = 1호출

  const totalApiCost = Math.round(
    normalCalls * API_UNIT_COST +
    coupleCalls * API_COST_COUPLE +
    auditionCalls * API_COST_AUDITION
  );
  const totalRevenue = Math.round(netPerSale * buyers);
  const totalProfit  = totalRevenue - totalApiCost;
  const margin       = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  // 분포 슬라이더 핸들러 (합 100 유지)
  const handlePctChange = (type: "normal" | "couple" | "audition", val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    if (type === "normal") {
      const rest = 100 - clamped;
      const ratio = (pctCouple + pctAudition) > 0 ? pctCouple / (pctCouple + pctAudition) : 0.5;
      setPctNormal(clamped);
      setPctCouple(Math.round(rest * ratio));
      setPctAudition(100 - clamped - Math.round(rest * ratio));
    } else if (type === "couple") {
      const rest = 100 - clamped;
      const ratio = (pctNormal + pctAudition) > 0 ? pctNormal / (pctNormal + pctAudition) : 0.5;
      setPctCouple(clamped);
      setPctNormal(Math.round(rest * ratio));
      setPctAudition(100 - clamped - Math.round(rest * ratio));
    } else {
      const rest = 100 - clamped;
      const ratio = (pctNormal + pctCouple) > 0 ? pctNormal / (pctNormal + pctCouple) : 0.5;
      setPctAudition(clamped);
      setPctNormal(Math.round(rest * ratio));
      setPctCouple(100 - clamped - Math.round(rest * ratio));
    }
  };

  const usageRows = [
    { label: "일반 변환", note: "1cr → 1호출", pct: pctNormal, calls: Math.round(normalCalls), cost: Math.round(normalCalls * API_UNIT_COST), type: "normal" as const, color: "bg-blue-400" },
    { label: "2인+ 변환", note: "2cr → 1호출", pct: pctCouple, calls: Math.round(coupleCalls), cost: Math.round(coupleCalls * API_COST_COUPLE), type: "couple" as const, color: "bg-purple-400" },
    { label: "AI 오디션", note: "5cr → 1호출", pct: pctAudition, calls: Math.round(auditionCalls), cost: Math.round(auditionCalls * API_COST_AUDITION), type: "audition" as const, color: "bg-[#C9571A]" },
  ];

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">순이익 시뮬레이터</p>
      <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-4">

        {/* 패키지 선택 */}
        <div className="flex gap-2">
          {PROFIT_PACKAGES.map((p) => (
            <button key={p.id} onClick={() => setPkgId(p.id)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors border ${
                pkgId === p.id ? "bg-[#C9571A] border-[#C9571A] text-white" : "bg-gray-100 border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {p.label}<br />
              <span className="text-[11px] font-normal opacity-70">{p.priceStr}원 · {p.credits}회</span>
            </button>
          ))}
        </div>

        {/* 구매자 수 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500">구매자 수</span>
            <span className="text-[17px] font-bold text-gray-900 tabular-nums">{buyers}명</span>
          </div>
          <input type="range" min={1} max={10000} value={buyers}
            onChange={(e) => setBuyers(Number(e.target.value))}
            className="w-full accent-[#C9571A]" />
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>1명</span><span>2,500명</span><span>5,000명</span><span>1만명</span>
          </div>
        </div>

        {/* 사용 분포 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500">사용 패턴 분포</span>
            <span className="text-[11px] text-gray-400">합계 100%</span>
          </div>
          {/* 분포 바 */}
          <div className="flex h-2 rounded-full overflow-hidden gap-px">
            <div className="bg-blue-400 transition-all" style={{ width: `${pctNormal}%` }} />
            <div className="bg-purple-400 transition-all" style={{ width: `${pctCouple}%` }} />
            <div className="bg-[#C9571A] transition-all" style={{ width: `${pctAudition}%` }} />
          </div>
          {usageRows.map((row) => (
            <div key={row.type} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${row.color}`} />
                  <span className="font-semibold text-gray-700">{row.label}</span>
                  <span className="text-gray-400">{row.note}</span>
                </div>
                <span className="font-bold text-gray-900 tabular-nums">{row.pct}%</span>
              </div>
              <input type="range" min={0} max={100} value={row.pct}
                onChange={(e) => handlePctChange(row.type, Number(e.target.value))}
                className="w-full accent-[#C9571A] h-1" />
            </div>
          ))}
        </div>

        {/* 결과 */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-2 border border-gray-100">
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">순수취액 (VAT·수수료 제외)</span>
            <span className="font-bold text-gray-700">+{totalRevenue.toLocaleString()}원</span>
          </div>
          <div className="h-px bg-gray-100" />
          {usageRows.map((row) => (
            <div key={row.type} className="flex justify-between text-[12px]">
              <span className="text-gray-400 flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${row.color}`} />
                {row.label} {row.calls}호출
              </span>
              <span className="text-red-400">−{row.cost.toLocaleString()}원</span>
            </div>
          ))}
          <div className="h-px bg-gray-200 mt-1" />
          <div className="flex justify-between items-center">
            <span className="text-[14px] font-bold text-gray-900">순이익</span>
            <div className="text-right">
              <span className={`text-[22px] font-extrabold tabular-nums ${totalProfit >= 0 ? "text-[#C9571A]" : "text-red-500"}`}>
                {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()}원
              </span>
              <span className="text-[12px] text-gray-400 ml-2">마진 {margin}%</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          * API 단가 111원/회 실측 · 오디션=333원/회(분석+스틸) · 카카오페이 3.2% · 부가세 10%
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, note, highlight }: { label: string; value: string | number; note?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-[15px]">{label}</span>
      <div className="flex items-center gap-2">
        {note && <span className="text-gray-500 text-[13px] font-medium">{note}</span>}
        <span className={`text-[17px] font-bold tabular-nums ${highlight ? "text-[#C9571A]" : "text-gray-900"}`}>{value}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">{title}</p>
      <div className="bg-white rounded-2xl px-4 border border-gray-200">
        {children}
      </div>
    </div>
  );
}

function Bar({ ratio, color = "#C9571A" }: { ratio: number; color?: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${ratio}%`, backgroundColor: color }} />
    </div>
  );
}

function KakaoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#3C1E1E">
      <path d="M12 3C6.477 3 2 6.58 2 11.1c0 2.9 1.6 5.45 4.05 7.02l-.97 3.63a.25.25 0 00.38.28l4.2-2.74c.75.1 1.53.15 2.34.15 5.523 0 10-3.58 10-8.1S17.523 3 12 3z"/>
    </svg>
  );
}

function LinkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
  );
}

function SaveIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function RatioIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/>
      <path d="M6 18L18 6"/>
    </svg>
  );
}

function ShareRow({ icon, iconBg, label, count, ratio, highlight }: {
  icon: React.ReactNode; iconBg: string; label: string;
  count: string | number; ratio?: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <span className="flex-1 text-gray-600 text-[15px]">{label}</span>
      {ratio !== undefined && <span className="text-gray-600 text-[13px] font-semibold tabular-nums">{ratio}</span>}
      <span className={`font-bold text-[17px] tabular-nums ${highlight ? "text-[#C9571A]" : "text-gray-900"}`}>{count}</span>
    </div>
  );
}

function MiniCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
      <span className="text-gray-500 text-[13px]">{label}</span>
      <span className={`text-[20px] font-extrabold tabular-nums leading-tight ${accent ? "text-[#C9571A]" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function AdminTabButton({
  label,
  note,
  active,
  onClick,
}: {
  label: string;
  note: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
        active
          ? "border-[#C9571A] bg-[#FFF4ED] text-[#C9571A]"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      <p className="text-[14px] font-extrabold">{label}</p>
      <p className={`text-[11px] mt-1 ${active ? "text-[#C9571A]/80" : "text-gray-400"}`}>{note}</p>
    </button>
  );
}

function ShareViralSection({ stats, shareTotal, shareRatio }: {
  stats: Stats; shareTotal: number; shareRatio: number;
}) {
  const [tab, setTab] = useState<"style" | "audition">("style");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1">공유 & 바이럴</p>
      {/* 탭 버튼 */}
      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab("style")}
          className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${tab === "style" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          스타일 카드
        </button>
        <button
          onClick={() => setTab("audition")}
          className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${tab === "audition" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          AI 오디션
        </button>
      </div>

      {/* 스타일 카드 탭 */}
      {tab === "style" && (
        <div className="flex flex-col gap-1">
          <div className="bg-white rounded-2xl px-4 border border-gray-200">
            <ShareRow
              icon={<KakaoIcon size={15} />} iconBg="bg-[#FEE500]"
              label="카카오 공유" count={`${stats.shareKakao}회`}
              ratio={`${stats.total > 0 ? Math.round((stats.shareKakao / stats.total) * 100) : 0}%`}
            />
            <ShareRow
              icon={<LinkIcon size={15} />} iconBg="bg-gray-200"
              label="링크 복사" count={`${stats.shareLinkCopy}회`}
              ratio={`${stats.total > 0 ? Math.round((stats.shareLinkCopy / stats.total) * 100) : 0}%`}
            />
            <ShareRow
              icon={<SaveIcon size={15} />} iconBg="bg-gray-200"
              label="사진 저장" count={`${stats.saveImage ?? 0}회`}
              ratio={`${stats.total > 0 ? Math.round(((stats.saveImage ?? 0) / stats.total) * 100) : 0}%`}
            />
            <ShareRow
              icon={<RatioIcon size={15} />} iconBg="bg-orange-100"
              label="공유 전환율" count={`${shareRatio}%`}
              ratio={`${shareTotal}회`} highlight
            />
          </div>
          <p className="text-[11px] text-gray-400 px-1">스타일별 저장률/공유율은 아래 스타일별 성과에서 확인</p>
        </div>
      )}

      {/* AI 오디션 탭 */}
      {tab === "audition" && (
        <div className="bg-white rounded-2xl px-4 border border-gray-200">
          <ShareRow
            icon={<KakaoIcon />} iconBg="bg-[#FEE500]"
            label="카카오 공유" count={`${stats.auditionShareKakao}회`}
          />
          <ShareRow
            icon={<LinkIcon />} iconBg="bg-gray-100"
            label="링크 복사" count={`${stats.auditionShareLinkCopy}회`}
          />
          <ShareRow
            icon={<RatioIcon />} iconBg="bg-orange-50"
            label="합계" count={`${stats.auditionShareKakao + stats.auditionShareLinkCopy}회`}
            highlight
          />
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("ops");
  const [styleControls, setStyleControls] = useState<StyleControlState[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesSaving, setNoticesSaving] = useState(false);
  const [noticesSaved, setNoticesSaved] = useState(false);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("3");
  const [creditMsg, setCreditMsg] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundMsg, setRefundMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [creditSearch, setCreditSearch] = useState("");
  const [userListSearch, setUserListSearch] = useState("");
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [styleSavingId, setStyleSavingId] = useState<string | null>(null);
  const [styleControlMsg, setStyleControlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ghostDeleteLoading, setGhostDeleteLoading] = useState(false);
  const [ghostDeleteMsg, setGhostDeleteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [generationErrorDeleteLoading, setGenerationErrorDeleteLoading] = useState<string | null>(null);
  const [generationErrorDeleteMsg, setGenerationErrorDeleteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const liveClock = fetchedAt ? new Date(fetchedAt.getTime() + elapsed * 1000) : null;

  const doLogin = async (pw: string) => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "오류가 발생했습니다.");
        localStorage.removeItem("sd_admin_pw");
      } else {
        localStorage.setItem("sd_admin_pw", pw);
        setStats(data);
        setStyleControls(data.styleControls ?? []);
        const now = new Date();
        setFetchedAt(now);
        setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
        fetch("/api/notices").then(r => r.json()).then(d => setNotices(d.notices ?? [])).catch(() => {});
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 마운트 시 저장된 비밀번호로 자동 로그인
  useEffect(() => {
    const saved = localStorage.getItem("sd_admin_pw");
    if (saved) {
      setPassword(saved);
      doLogin(saved);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(password);
  };

  const deleteGenerationErrors = async (ids: number[], successText: string, loadingKey: string) => {
    if (ids.length === 0) return;

    setGenerationErrorDeleteLoading(loadingKey);
    setGenerationErrorDeleteMsg(null);
    try {
      const res = await fetch("/api/admin/generation-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 기록 삭제 실패");
      setGenerationErrorDeleteMsg({
        ok: true,
        text: successText.replace("{count}", String(data.deletedCount ?? ids.length)),
      });
      await doLogin(password);
    } catch (error) {
      setGenerationErrorDeleteMsg({
        ok: false,
        text: error instanceof Error ? error.message : "오류 기록 삭제 실패",
      });
    } finally {
      setGenerationErrorDeleteLoading(null);
    }
  };

  const persistStyleControls = async (nextControls: StyleControlState[], savingId: string) => {
    setStyleSavingId(savingId);
    setStyleControlMsg(null);
    setStyleControls(nextControls);

    try {
      const response = await fetch("/api/admin/style-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, controls: nextControls }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장 실패");
      setStats((prev) => (prev ? { ...prev, styleControls: nextControls } : prev));
      setStyleControlMsg({ ok: true, text: "스타일 운영 상태가 저장됐어요." });
    } catch (error) {
      setStyleControlMsg({
        ok: false,
        text: error instanceof Error ? error.message : "스타일 운영 상태 저장 실패",
      });
      if (stats) setStyleControls(stats.styleControls ?? []);
    } finally {
      setStyleSavingId(null);
    }
  };

  const updateStyleControl = (styleId: string, patch: Partial<StyleControlState>) => {
    const nextControls = styleControls.map((control) =>
      control.style_id === styleId
        ? {
            ...control,
            ...patch,
          }
        : control
    );
    void persistStyleControls(nextControls, styleId);
  };

  if (!stats) {
    return (
      <main className="w-full max-w-sm mx-auto px-4 py-20 flex flex-col gap-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-extrabold text-gray-900">Admin</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-[15px] focus:outline-none focus:border-[#C9571A] transition-colors"
            autoFocus
          />
          {error && <p className="text-[#C9571A] text-[15px] font-medium">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {isLoading ? "확인 중..." : "확인"}
          </button>
        </form>
      </main>
    );
  }

  const shareTotal = stats.shareKakao + stats.shareLinkCopy;
  const shareRatio = stats.total > 0 ? Math.round((shareTotal / stats.total) * 100) : 0;
  const auditionControl = styleControls.find((row) => row.style_id === AUDITION_CONTROL_ID);
  const personalColorControl = styleControls.find((row) => row.style_id === PERSONAL_COLOR_CONTROL_ID);
  const specialFeatureControls = [
    auditionControl ? { title: "AI 오디션", control: auditionControl } : null,
    personalColorControl ? { title: "퍼스널 컬러", control: personalColorControl } : null,
  ].filter((item): item is { title: string; control: StyleControlState } => Boolean(item));
  const cardStyleControls = styleControls.filter(
    (row) => row.style_id !== AUDITION_CONTROL_ID && row.style_id !== PERSONAL_COLOR_CONTROL_ID
  );
  const sortedStyleControls = [...cardStyleControls].sort((a, b) => {
    const aIssue = Number(!a.is_visible || !a.is_enabled);
    const bIssue = Number(!b.is_visible || !b.is_enabled);
    if (bIssue !== aIssue) return bIssue - aIssue;
    const usageA = stats.byStyle.find((item) => item.style_id === a.style_id)?.count ?? 0;
    const usageB = stats.byStyle.find((item) => item.style_id === b.style_id)?.count ?? 0;
    if (usageB !== usageA) return usageB - usageA;
    return a.style_name.localeCompare(b.style_name, "ko");
  });
  const errorMap = new Map(stats.generationErrorSummary.map((item) => [item.style_id, item]));
  const unresolvedErrorStyles = stats.generationErrorSummary.filter((item) => !item.isResolved);
  const resolvedErrorStyles = stats.generationErrorSummary.filter((item) => item.isResolved);
  const unresolvedRecentGenerationErrors = stats.recentGenerationErrors.filter((item) => !item.isResolved);
  const perf24hMap = new Map(stats.stylePerformance24hList.map((item) => [item.style_id, item]));
  const lowSaveSet = new Set(
    stats.stylePerformance24hList
      .filter((item) => item.count >= 5)
      .sort((a, b) => {
        if (a.saveRate !== b.saveRate) return a.saveRate - b.saveRate;
        return b.count - a.count;
      })
      .slice(0, 3)
      .map((item) => item.style_id)
  );
  const highShareSet = new Set(
    stats.stylePerformance24hList
      .filter((item) => item.count >= 5 && item.shareCount > 0)
      .sort((a, b) => {
        if (b.shareRate !== a.shareRate) return b.shareRate - a.shareRate;
        return b.shareCount - a.shareCount;
      })
      .slice(0, 3)
      .map((item) => item.style_id)
  );
  const issueIds = new Set(
    stats.stylePerformanceList
      .filter((item) => {
        const control = styleControls.find((row) => row.style_id === item.style_id);
        const perf24h = perf24hMap.get(item.style_id);
        const hasControlIssue = !!control && (!control.is_visible || !control.is_enabled);
        const hasError = (errorMap.get(item.style_id)?.errorCount ?? 0) > 0;
        const lowSaveIssue = !!perf24h && perf24h.count >= 5 && perf24h.saveRate <= 15;
        return hasControlIssue || hasError || lowSaveIssue;
      })
      .map((item) => item.style_id)
  );
  const highlightedProblems = stats.stylePerformanceList
    .filter((item) => issueIds.has(item.style_id))
    .sort((a, b) => {
      const controlA = styleControls.find((row) => row.style_id === a.style_id);
      const controlB = styleControls.find((row) => row.style_id === b.style_id);
      const controlIssueA = Number(!!controlA && (!controlA.is_visible || !controlA.is_enabled));
      const controlIssueB = Number(!!controlB && (!controlB.is_visible || !controlB.is_enabled));
      if (controlIssueB !== controlIssueA) return controlIssueB - controlIssueA;
      const errorA = errorMap.get(a.style_id)?.errorCount ?? 0;
      const errorB = errorMap.get(b.style_id)?.errorCount ?? 0;
      if (errorB !== errorA) return errorB - errorA;
      const saveA = perf24hMap.get(a.style_id)?.saveRate ?? 999;
      const saveB = perf24hMap.get(b.style_id)?.saveRate ?? 999;
      if (saveA !== saveB) return saveA - saveB;
      return b.count - a.count;
    })
    .slice(0, 3);
  const highlightedLowSave = stats.stylePerformance24hList
    .filter((item) => lowSaveSet.has(item.style_id))
    .slice(0, 3);
  const highlightedHighShare = stats.stylePerformance24hList
    .filter((item) => highShareSet.has(item.style_id))
    .slice(0, 3);
  const styleControlMap = Object.fromEntries(styleControls.map((row) => [row.style_id, row]));
  const usageMap = new Map(stats.byStyle.map((item) => [item.style_id, item.count]));
  const performanceMap = new Map(stats.stylePerformanceList.map((item) => [item.style_id, item]));
  const baseVisibleStyles = ALL_STYLES
    .map((style) => applyStyleControl(style, styleControlMap[style.id]))
    .filter((style) => !style.hidden);
  const baseStyleOrder = baseVisibleStyles.reduce<Record<string, number>>((acc, style, index) => {
    acc[style.id] = index;
    return acc;
  }, {});
  const sortedVisibleStyles = [...baseVisibleStyles].sort((a, b) => {
    const aHasOptions = (STYLE_VARIANTS[a.id]?.length ?? 0) > 1;
    const bHasOptions = (STYLE_VARIANTS[b.id]?.length ?? 0) > 1;

    if (a.popular && b.popular) {
      const usageDiff = (usageMap.get(b.id) ?? 0) - (usageMap.get(a.id) ?? 0);
      if (usageDiff !== 0) return usageDiff;
      return baseStyleOrder[a.id] - baseStyleOrder[b.id];
    }
    if (a.popular) return -1;
    if (b.popular) return 1;
    if (aHasOptions && !bHasOptions) return -1;
    if (!aHasOptions && bHasOptions) return 1;
    return baseStyleOrder[a.id] - baseStyleOrder[b.id];
  });
  const sortedStylePerformance = sortedVisibleStyles.map((style) => {
    const perf = performanceMap.get(style.id);
    return perf ?? {
      style_id: style.id,
      style_name: style.name,
      count: 0,
      saveCount: 0,
      shareCount: 0,
      saveRate: 0,
      shareRate: 0,
    };
  });
  const filteredUsers = stats.userList.filter((user) => {
    if (!userListSearch) return true;
    const q = userListSearch.toLowerCase();
    return user.nickname?.toLowerCase().includes(q) || user.id.toLowerCase().includes(q);
  });
  const toggleUserIdVisibility = (userId: string) => {
    setVisibleUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };
  const tabSummary =
    activeTab === "ops"
      ? "공지, 오류, 카드 숨김 같은 운영 대응"
      : activeTab === "metrics"
        ? "사용량, 저장률, 공유율 같은 성과 확인"
        : activeTab === "revenue"
          ? "매출, 비용, 환불 같은 돈 흐름 확인"
          : "크레딧 조정 같은 유저 대응";

  return (
    <main className="w-full max-w-sm mx-auto px-4 py-10 flex flex-col gap-6 bg-gray-50 min-h-screen">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold text-gray-900">Admin</h1>
          <span className="text-[10px] font-bold text-[#C9571A] bg-[#C9571A]/10 border border-[#C9571A]/20 rounded-full px-2 py-0.5">
            {ADMIN_UI_VERSION}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {liveClock && (
            <span className="text-[12px] text-gray-400 font-mono tabular-nums">
              {liveClock.toTimeString().slice(0, 8)}
            </span>
          )}
          <button
            onClick={() => doLogin(password)}
            disabled={isLoading || !password}
            className="text-[13px] text-[#C9571A] hover:text-[#B34A12] disabled:text-gray-300 transition-colors"
          >
            {isLoading ? "새로고침 중..." : "새로고침"}
          </button>
          <button
            onClick={() => { setStats(null); setPassword(""); localStorage.removeItem("sd_admin_pw"); if (timerRef.current) clearInterval(timerRef.current); }}
            className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-2">
          <AdminTabButton label="운영" note="공지 · 오류 · 긴급 대응" active={activeTab === "ops"} onClick={() => setActiveTab("ops")} />
          <AdminTabButton label="지표" note="사용량 · 저장 · 공유" active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")} />
          <AdminTabButton label="매출" note="비용 · 결제 · 환불" active={activeTab === "revenue"} onClick={() => setActiveTab("revenue")} />
          <AdminTabButton label="유저" note="크레딧 대응" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
        </div>
        <p className="text-[12px] text-gray-500 px-1">{tabSummary}</p>
      </div>

      {activeTab === "ops" && (
        <>
          {/* 공지 관리 */}
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">공지 관리 (터미널)</p>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              {notices.map((n, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => setNotices(prev => prev.map((x, j) => j === i ? { ...x, active: !x.active } : x))}
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors ${n.active ? "bg-[#C9571A] border-[#C9571A]" : "bg-white border-gray-300"}`}
                  >
                    {n.active && <svg viewBox="0 0 10 8" fill="none" className="w-full h-full p-0.5"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                  <input
                    value={n.text}
                    onChange={e => setNotices(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-[14px] font-mono focus:outline-none focus:border-[#C9571A]/50 transition-colors"
                  />
                  <button
                    onClick={() => setNotices(prev => prev.filter((_, j) => j !== i))}
                    className="mt-1 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => setNotices(prev => [...prev, { id: Date.now(), text: "", active: true }])}
                className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors text-left font-mono"
              >+ 공지 추가</button>
              <button
                onClick={async () => {
                  setNoticesSaving(true);
                  setNoticesSaved(false);
                  await fetch("/api/notices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password, notices }),
                  });
                  setNoticesSaving(false);
                  setNoticesSaved(true);
                  setTimeout(() => setNoticesSaved(false), 2000);
                }}
                disabled={noticesSaving}
                className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-gray-200 text-white font-bold py-2.5 rounded-xl transition-colors text-[14px]"
              >
                {noticesSaving ? "저장 중..." : noticesSaved ? "✓ 저장됨" : "저장하기"}
              </button>
            </div>
          </div>

          {/* 오류 모니터링 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3 px-1 mb-1">
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest">오류 모니터링</p>
              {unresolvedRecentGenerationErrors.length > 0 && (
                <button
                  type="button"
                  disabled={generationErrorDeleteLoading !== null}
                  onClick={async () => {
                    const ids = unresolvedRecentGenerationErrors.map((item) => item.id);
                    if (ids.length === 0) return;
                    const ok = window.confirm(`미해결 오류 기록 ${ids.length}건을 삭제할까요?`);
                    if (!ok) return;
                    await deleteGenerationErrors(ids, "미해결 기록 {count}건 삭제됨", "bulk");
                  }}
                  className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generationErrorDeleteLoading === "bulk" ? "삭제 중..." : `미해결 기록 삭제 ${unresolvedRecentGenerationErrors.length}건`}
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniCard label="최근 24시간 오류" value={`${stats.generationErrorTotal24h}건`} accent={stats.generationErrorTotal24h > 0} />
                <MiniCard label="미해결 카드" value={`${unresolvedErrorStyles.length}개`} accent={unresolvedErrorStyles.length > 0} />
                <MiniCard label="복구됨 카드" value={`${resolvedErrorStyles.length}개`} accent={resolvedErrorStyles.length > 0} />
                <MiniCard label="자동 환불" value={`${stats.generationRefundTotal24h}건`} accent={stats.generationRefundTotal24h > 0} />
              </div>

              {generationErrorDeleteMsg && (
                <div
                  className={`rounded-xl px-3 py-2 text-[12px] font-medium ${
                    generationErrorDeleteMsg.ok
                      ? "border border-[#B7E1C4] bg-[#EEF8F1] text-[#18794E]"
                      : "border border-red-200 bg-red-50 text-red-600"
                  }`}
                >
                  {generationErrorDeleteMsg.text}
                </div>
              )}

              {stats.generationErrorSummary.length > 0 ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {stats.generationErrorSummary.slice(0, 6).map((item) => (
                    <div key={item.style_id} className="px-3 py-3 border-b border-gray-100 last:border-0">
                      {(() => {
                        const issue = getGenerationIssueMeta(item);
                        return (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-[13px] font-bold text-gray-900">{item.style_name}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${issue.badgeClass}`}>
                                    {issue.label}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1">
                                  오류 {item.errorCount} · 성공 {item.successCount24h} · 오류율 {item.errorRate}% · {generationErrorTypeLabel(item.topErrorType)}
                                </p>
                                <p className={`text-[11px] mt-1 ${item.isResolved ? "text-[#18794E]" : "text-red-600"}`}>
                                  {issue.detail}
                                </p>
                              </div>
                              <span className="text-[11px] text-gray-400 whitespace-nowrap">{relativeTime(item.lastErrorAt)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <span className="text-[11px] text-gray-400">
                                마지막 오류 {formatDateTime(item.lastErrorAt)}
                              </span>
                              {issue.needsAction ? (
                                <a
                                  href="#style-ops"
                                  className="inline-flex items-center rounded-full border border-[#F3D2BF] bg-[#FFF4ED] px-2.5 py-1 text-[11px] font-bold text-[#C9571A]"
                                >
                                  운영으로 이동
                                </a>
                              ) : (
                                <span className="text-[11px] text-[#18794E] font-bold">{issue.action}</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-[13px] text-gray-500">
                  최근 24시간 기준 기록된 생성 오류가 없어요.
                </div>
              )}

              {stats.recentGenerationErrors.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {stats.recentGenerationErrors.slice(0, 5).map((item) => {
                    const parsed = parseGenerationErrorMessage(item.message);
                    const issue = getGenerationIssueMeta({
                      isResolved: item.isResolved,
                      latestSuccessAt: item.latestSuccessAt,
                      lastErrorAt: item.created_at,
                    });
                    return (
                      <div key={item.id} className="px-3 py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[12px] font-bold text-gray-900">{item.style_name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${issue.badgeClass}`}>
                                {issue.label}
                              </span>
                              {parsed.code !== null && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                  {parsed.code}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {generationErrorTypeLabel(item.error_type)}
                              {item.finish_reason ? ` · ${item.finish_reason}` : ""}
                            </p>
                            <p className="text-[12px] text-gray-700 mt-1 leading-5 break-all">
                              {parsed.summary}
                            </p>
                            {item.message && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[11px] font-bold text-[#C9571A]">
                                  전체 메시지 보기
                                </summary>
                                <pre className="mt-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 text-[11px] leading-5 text-gray-600 whitespace-pre-wrap break-all overflow-x-auto">
                                  {parsed.pretty ?? item.message}
                                </pre>
                              </details>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <span className={`text-[11px] ${item.isResolved ? "text-[#18794E]" : "text-red-600"}`}>
                                {issue.detail}
                              </span>
                              {issue.needsAction && (
                                <a
                                  href="#style-ops"
                                  className="inline-flex items-center rounded-full border border-[#F3D2BF] bg-[#FFF4ED] px-2.5 py-1 text-[11px] font-bold text-[#C9571A]"
                                >
                                  운영으로 이동
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">{relativeTime(item.created_at)}</span>
                            <button
                              type="button"
                              disabled={generationErrorDeleteLoading !== null}
                              onClick={async () => {
                                const ok = window.confirm("이 오류 기록을 숨길까요?");
                                if (!ok) return;
                                await deleteGenerationErrors([item.id], "오류 기록 {count}건 숨김 처리됨", `row:${item.id}`);
                              }}
                              className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {generationErrorDeleteLoading === `row:${item.id}` ? "처리 중..." : "숨기기"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {stats.recentGenerationRefunds.length > 0 ? (
                <div className="rounded-xl border border-[#F3D2BF] overflow-hidden">
                  {stats.recentGenerationRefunds.slice(0, 5).map((item) => (
                    <div key={item.id} className="px-3 py-2.5 border-b border-[#F7E1D2] last:border-0 bg-[#FFFDFC]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-gray-900 truncate">{item.style_name}</span>
                        <span className="text-[11px] text-[#C9571A] font-bold whitespace-nowrap">+{item.credits}크레딧</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {compactUserLabel(item.nickname, item.user_id)} · {refundReasonLabel(item.reason)}
                        {item.message ? ` · ${item.message}` : ""}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[11px] text-gray-400">
                          영향 유저 {stats.generationRefundUserCount24h}명
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">{relativeTime(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-[13px] text-gray-500">
                  최근 24시간 기준 자동 환불된 생성 실패가 없어요.
                </div>
              )}
            </div>
          </div>

          {/* 긴급 대응 · 스타일 운영 */}
          <div id="style-ops" className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">긴급 대응 · 스타일 운영</p>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900">카드별 즉시 숨김 / 생성 중지</p>
                  <p className="text-[12px] text-gray-500 mt-1">저장 즉시 반영</p>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">{cardStyleControls.length}개 카드</span>
              </div>

              {styleControlMsg && (
                <div className={`text-[12px] px-3 py-2 rounded-xl border ${
                  styleControlMsg.ok
                    ? "text-[#C9571A] bg-[#FFF7F2] border-[#F3D2BF]"
                    : "text-red-600 bg-red-50 border-red-200"
                }`}>
                  {styleControlMsg.text}
                </div>
              )}

              {specialFeatureControls.map(({ title, control }) => (
                <div key={control.style_id} className="rounded-xl border border-[#F3D2BF] bg-[#FFF7F2] px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900">{title}</p>
                      <p className="text-[11px] text-gray-500">
                        {control.is_visible && control.is_enabled ? "실험실 진입 가능" : "현재 숨김 또는 중지"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateStyleControl(control.style_id, { is_visible: !control.is_visible })}
                        disabled={styleSavingId === control.style_id}
                        className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${
                          control.is_visible
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-600 border border-gray-300"
                        } disabled:opacity-50`}
                      >
                        {control.is_visible ? "노출" : "숨김"}
                      </button>
                      <button
                        onClick={() => updateStyleControl(control.style_id, { is_enabled: !control.is_enabled })}
                        disabled={styleSavingId === control.style_id}
                        className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${
                          control.is_enabled
                            ? "bg-[#FFF4ED] text-[#C9571A] border border-[#F3D2BF]"
                            : "bg-white text-gray-600 border border-gray-300"
                        } disabled:opacity-50`}
                      >
                        {control.is_enabled ? "생성" : "중지"}
                      </button>
                    </div>
                    <div className="w-10 text-right">
                      {styleSavingId === control.style_id && <span className="text-[10px] text-gray-400">저장</span>}
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                {sortedStyleControls.map((control) => {
                  const usageCount = stats.byStyle.find((item) => item.style_id === control.style_id)?.count ?? 0;
                  const isSaving = styleSavingId === control.style_id;
                  return (
                    <div key={control.style_id} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-gray-900 truncate">{control.style_name}</p>
                        <p className="text-[11px] text-gray-500">
                          사용 {usageCount}회 · {control.is_visible ? "노출" : "숨김"} · {control.is_enabled ? "생성중" : "중지"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateStyleControl(control.style_id, { is_visible: !control.is_visible })}
                          disabled={isSaving}
                          className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${
                            control.is_visible
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-600 border border-gray-300"
                          } disabled:opacity-50`}
                        >
                          {control.is_visible ? "노출" : "숨김"}
                        </button>
                        <button
                          onClick={() => updateStyleControl(control.style_id, { is_enabled: !control.is_enabled })}
                          disabled={isSaving}
                          className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${
                            control.is_enabled
                              ? "bg-[#FFF4ED] text-[#C9571A] border border-[#F3D2BF]"
                              : "bg-white text-gray-600 border border-gray-300"
                          } disabled:opacity-50`}
                        >
                          {control.is_enabled ? "생성" : "중지"}
                        </button>
                      </div>
                      <div className="w-10 text-right">
                        {isSaving && <span className="text-[10px] text-gray-400">저장</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 자동 하이라이트 */}
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">자동 하이라이트 (24시간)</p>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200">
                <p className="text-[12px] font-bold text-red-500 mb-2">주의 필요</p>
                {highlightedProblems.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {highlightedProblems.map((item) => {
                      const control = styleControls.find((row) => row.style_id === item.style_id);
                      const perf24h = perf24hMap.get(item.style_id);
                      const error = errorMap.get(item.style_id);
                      const reason = !control?.is_visible
                        ? "숨김 상태"
                        : control?.is_enabled === false
                          ? "생성 중지"
                          : (error?.errorCount ?? 0) > 0
                            ? `오류 ${error?.errorCount}건`
                            : perf24h
                              ? `저장률 ${perf24h.saveRate}%`
                              : "확인 필요";
                      return (
                        <div key={item.style_id} className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-gray-900 truncate">{item.style_name}</span>
                          <span className="text-[11px] text-red-500 font-semibold whitespace-nowrap">{reason}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500">특이사항 없음</p>
                )}
              </div>

              <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200">
                <p className="text-[12px] font-bold text-[#C9571A] mb-2">공유 강세</p>
                {highlightedHighShare.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {highlightedHighShare.map((item) => (
                      <div key={item.style_id} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-gray-900 truncate">{item.style_name}</span>
                        <span className="text-[11px] text-[#C9571A] font-semibold whitespace-nowrap">공유율 {item.shareRate}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500">아직 공유 데이터 부족</p>
                )}
              </div>

              <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200">
                <p className="text-[12px] font-bold text-gray-700 mb-2">저장 약세</p>
                {highlightedLowSave.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {highlightedLowSave.map((item) => (
                      <div key={item.style_id} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-gray-900 truncate">{item.style_name}</span>
                        <span className="text-[11px] text-gray-600 font-semibold whitespace-nowrap">저장률 {item.saveRate}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500">아직 저장 데이터 부족</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "metrics" && (
        <>
          {/* 사용 현황 */}
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">사용 현황</p>
            <div className="grid grid-cols-2 gap-2">
              <MiniCard label="누적 변환" value={`${stats.total}회`} accent />
              <MiniCard label="오늘 변환" value={`${stats.todayTotal}회`} />
              <MiniCard label="가입 유저 (전체)" value={`${stats.totalUsers}명`} />
              <MiniCard label="변환한 유저 (고유)" value={`${stats.uniqueLoggedInUsers}명`} />
            </div>
          </div>

          {/* 로그인 vs 게스트 */}
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">로그인 vs 게스트</p>
            <p className="text-[12px] text-gray-400 px-1 mb-1">변환 횟수 기준 — 1명이 여러 번 변환하면 중복 집계됨</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-gray-500 text-[13px]">로그인 변환</span>
                <span className="text-gray-900 text-[20px] font-extrabold tabular-nums">{stats.userCount}회</span>
                <span className="text-[#C9571A] text-[14px] font-bold">{stats.userRatio}%</span>
                <Bar ratio={stats.userRatio} />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-gray-500 text-[13px]">게스트 변환</span>
                <span className="text-gray-900 text-[20px] font-extrabold tabular-nums">{stats.guestCount}회</span>
                <span className="text-gray-500 text-[14px] font-bold">{stats.guestRatio}%</span>
                <Bar ratio={stats.guestRatio} color="#9ca3af" />
              </div>
            </div>
          </div>

          {/* 공유 & 바이럴 */}
          <ShareViralSection stats={stats} shareTotal={shareTotal} shareRatio={shareRatio} />

          {/* 스타일별 */}
          <Section title="스타일별 성과">
            {sortedStylePerformance.length === 0 ? (
              <p className="text-gray-400 text-[15px] py-4">데이터 없음</p>
            ) : (
              sortedStylePerformance.map((s) => {
                const variants = STYLE_VARIANTS[s.style_id];
                const errorItem = stats.generationErrorSummary.find((item) => item.style_id === s.style_id);
                const perf24h = perf24hMap.get(s.style_id);
                const isProblem = issueIds.has(s.style_id);
                const isHighShare = highShareSet.has(s.style_id);
                const isLowSave = lowSaveSet.has(s.style_id);
                return (
                  <div key={s.style_id} className="py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-gray-800 text-[14px] font-bold truncate">{s.style_name}</span>
                          {isProblem && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">문제</span>}
                          {isHighShare && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#C9571A] border border-[#F3D2BF]">공유강세</span>}
                          {isLowSave && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">저장약세</span>}
                        </div>
                      </div>
                      <span className="text-gray-900 font-bold text-[14px]">{s.count}회</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-500">
                      <span>저장 {s.saveCount} · {s.saveRate}%</span>
                      <span>공유 {s.shareCount} · {s.shareRate}%</span>
                      {perf24h && <span>24h 저장 {perf24h.saveRate}% · 공유 {perf24h.shareRate}%</span>}
                      {errorItem && (
                        <span className="text-red-500 font-semibold">오류 {errorItem.errorCount} · {errorItem.errorRate}%</span>
                      )}
                    </div>
                    {variants && variants.length > 1 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {variants.map(v => {
                          const cnt = stats.byStyleVariants?.[s.style_id]?.[v.id] ?? 0;
                          return (
                            <span key={v.id} className="text-[12px] text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                              {v.label}{cnt > 0 ? ` · ${cnt}회` : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Section>
        </>
      )}

      {activeTab === "revenue" && (
        <>
          {/* API 비용 & 손익 */}
          <MonthlyCostSection monthlyCosts={stats.monthlyCosts ?? {}} />

          {/* 결제 현황 */}
          <Section title="결제 현황">
            <Row label="누적 매출" value={`${stats.totalRevenue.toLocaleString()}원`} highlight />
            <Row label="오늘 매출" value={`${stats.todayRevenue.toLocaleString()}원`} />
            <Row label="결제 건수" value={`${stats.totalPaymentCount}건`} />
          </Section>

          {/* 순이익 시뮬레이터 */}
          <ProfitCalculator />

          {/* 결제 목록 & 원클릭 환불 */}
          {stats.paymentList.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">결제 목록 & 환불</p>
              <div className="bg-white rounded-2xl px-4 border border-gray-200 flex flex-col">
                {stats.paymentList.slice(0, 20).map((p) => {
                  const user = stats.userList.find(u => u.id === p.user_id);
                  const date = new Date(p.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
                  const isRefunded = p.status === "refunded" || p.status === "partially_refunded";
                  const isLoading = refundingId === p.id;
                  const msg = refundMsg?.id === p.id ? refundMsg : null;
                  const refundBadge =
                    p.status === "partially_refunded"
                      ? `부분환불 ${((p.refunded_amount ?? 0)).toLocaleString()}원`
                      : p.status === "refunded"
                        ? "환불됨"
                        : null;
                  return (
                    <div key={p.id} className="py-3 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-gray-900 text-[14px] font-bold truncate">{user?.nickname ?? p.user_id.slice(0, 8)}</span>
                        <span className="text-gray-500 text-[12px] font-mono">{p.amount.toLocaleString()}원 · {p.credits}크레딧 · {date}</span>
                        {msg && <span className={`text-[12px] ${msg.ok ? "text-[#C9571A]" : "text-red-500"}`}>{msg.msg}</span>}
                      </div>
                      {isRefunded ? (
                        <span className="text-[12px] text-gray-400 flex-shrink-0">{refundBadge}</span>
                      ) : (
                        <button
                          onClick={async () => {
                            setRefundingId(p.id);
                            setRefundMsg(null);
                            const previewRes = await fetch("/api/admin/refund", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password, paymentId: p.id, dryRun: true }),
                            });
                            const preview = await previewRes.json();
                            setRefundingId(null);
                            if (!previewRes.ok) {
                              setRefundMsg({ id: p.id, ok: false, msg: `오류: ${preview.error}` });
                              return;
                            }
                            if (!preview.canRefund) {
                              setRefundMsg({ id: p.id, ok: false, msg: `사용분 공제(${preview.usedCredits}회×${REFUND_UNIT_PRICE}원) 후 환불 가능 금액 없음` });
                              return;
                            }
                            const confirmMsg = preview.wasPartial
                              ? `${user?.nickname ?? "유저"} · 부분환불 ${preview.refundAmount.toLocaleString()}원\n(사용 ${preview.usedCredits}회 × ${REFUND_UNIT_PRICE}원 = ${(preview.usedCredits * REFUND_UNIT_PRICE).toLocaleString()}원 공제)\n\n진행하시겠어요?`
                              : `${user?.nickname ?? "유저"} · 전액환불 ${preview.refundAmount.toLocaleString()}원\n\n진행하시겠어요?`;
                            if (!confirm(confirmMsg)) return;
                            setRefundingId(p.id);
                            const res = await fetch("/api/admin/refund", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password, paymentId: p.id }),
                            });
                            const data = await res.json();
                            setRefundingId(null);
                            setRefundMsg({
                              id: p.id,
                              ok: data.ok,
                              msg: data.ok
                                ? `✓ ${data.refundedAmount.toLocaleString()}원 환불 완료${data.wasPartial ? ` (${data.usedCredits}회 사용분 공제)` : ""}`
                                : `오류: ${data.error}`,
                            });
                            if (data.ok) p.status = "refunded";
                          }}
                          disabled={isLoading}
                          className="flex-shrink-0 text-[12px] px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "처리중..." : "환불"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "users" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <MiniCard label="전체 가입 유저" value={`${stats.totalUsers}명`} accent />
            <MiniCard label="오늘 가입" value={`${stats.todaySignupCount}명`} />
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">유령계정 정리</p>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <MiniCard label="삭제 후보" value={`${stats.ghostUserCount}명`} accent={stats.ghostUserCount > 0} />
                <MiniCard label="기준" value="활동 0" />
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-[12px] text-gray-500">
                생성, 오디션, 결제, 의미 있는 이벤트가 없고 가입 보너스만 받은 계정을 유령계정으로 보고 정리합니다.
              </div>

              {stats.ghostUsersPreview.length > 0 ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {stats.ghostUsersPreview.map((user) => (
                    <div key={user.id} className="px-3 py-2.5 border-b border-gray-100 last:border-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 truncate">{user.nickname ?? "닉네임 없음"}</p>
                        <p className="text-[11px] text-gray-400 font-mono truncate">{user.id}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-gray-500">가입 {formatDateTime(user.created_at)}</p>
                        <p className="text-[11px] text-gray-400">마지막 카카오 로그인 {user.last_login_at ? relativeTime(user.last_login_at) : "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-[13px] text-gray-500">
                  현재 삭제 후보인 유령계정이 없어요.
                </div>
              )}

              <button
                onClick={async () => {
                  if (stats.ghostUserCount <= 0) return;
                  const ok = confirm(
                    `유령계정 ${stats.ghostUserCount}명을 삭제합니다.\n기준: 생성/오디션/결제/의미 있는 이벤트 없음\n\n진행하시겠어요?`
                  );
                  if (!ok) return;

                  setGhostDeleteLoading(true);
                  setGhostDeleteMsg(null);

                  try {
                    const res = await fetch("/api/admin/delete-ghost-users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password }),
                    });
                    const data = await res.json();

                    setGhostDeleteMsg({
                      ok: !!data.ok,
                      text: data.ok
                        ? `✓ 유령계정 ${data.deletedCount}명 삭제 완료`
                        : `오류: ${data.error ?? "삭제 실패"}`,
                    });

                    if (data.ok) {
                      await doLogin(password);
                    }
                  } finally {
                    setGhostDeleteLoading(false);
                  }
                }}
                disabled={ghostDeleteLoading || stats.ghostUserCount <= 0}
                className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2.5 rounded-xl transition-colors text-[14px]"
              >
                {ghostDeleteLoading ? "삭제 중..." : `유령계정 ${stats.ghostUserCount}명 삭제`}
              </button>

              {ghostDeleteMsg && (
                <p className={`text-[13px] text-center ${ghostDeleteMsg.ok ? "text-[#C9571A]" : "text-red-500"}`}>
                  {ghostDeleteMsg.text}
                </p>
              )}
            </div>
          </div>

          {/* 크레딧 조정 */}
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">크레딧 조정</p>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={creditSearch}
                  onChange={e => {
                    setCreditSearch(e.target.value);
                    setShowUserDropdown(true);
                    setCreditUserId("");
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="닉네임 또는 ID로 검색..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-[14px] focus:outline-none focus:border-[#C9571A]/50 transition-colors"
                />
                {showUserDropdown && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto shadow-md">
                    {stats.userList
                      .filter(u => {
                        if (!creditSearch) return true;
                        const q = creditSearch.toLowerCase();
                        return u.nickname?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
                      })
                      .slice(0, 20)
                      .map(u => (
                        <button
                          key={u.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCreditUserId(u.id);
                            setCreditSearch(u.nickname ?? u.id.slice(0, 12));
                            setShowUserDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[14px] hover:bg-gray-50 transition-colors ${
                            creditUserId === u.id ? "text-[#C9571A]" : "text-gray-700"
                          }`}
                        >
                          {u.nickname ?? u.id.slice(0, 8)} — {u.id.slice(0, 12)}...
                        </button>
                      ))}
                    {stats.userList.filter(u => {
                      if (!creditSearch) return true;
                      const q = creditSearch.toLowerCase();
                      return u.nickname?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="px-3 py-2 text-[13px] text-gray-400">검색 결과 없음</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {[0, 1, 3, 5, 10, 30].map(n => (
                  <button
                    key={n}
                    onClick={() => setCreditAmount(String(n))}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-colors ${creditAmount === String(n) ? "bg-[#C9571A] text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                  >{n}</button>
                ))}
              </div>
              <button
                onClick={async () => {
                  if (!creditUserId) { setCreditMsg("유저를 선택해주세요."); return; }
                  setCreditMsg("");
                  const res = await fetch("/api/admin/set-credits", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password, userId: creditUserId, credits: Number(creditAmount) }),
                  });
                  const data = await res.json();
                  setCreditMsg(data.ok ? `✓ ${stats.userList.find(u => u.id === creditUserId)?.nickname ?? creditUserId.slice(0, 8)} +${creditAmount}크레딧 추가됨` : `오류: ${data.error}`);
                  setTimeout(() => setCreditMsg(""), 3000);
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900 font-bold py-2.5 rounded-xl transition-colors text-[14px]"
              >
                크레딧 추가
              </button>
              {creditMsg && <p className={`text-[13px] text-center ${creditMsg.startsWith("✓") ? "text-[#C9571A]" : "text-red-500"}`}>{creditMsg}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">가입 유저 목록</p>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={userListSearch}
                  onChange={(e) => setUserListSearch(e.target.value)}
                  placeholder="닉네임 또는 ID 검색..."
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-[14px] focus:outline-none focus:border-[#C9571A]/50 transition-colors"
                />
                <span className="text-[11px] text-gray-400 whitespace-nowrap">최근 활동순</span>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                {filteredUsers.length === 0 ? (
                  <div className="px-3 py-4 text-[13px] text-gray-500">검색 결과 없음</div>
                ) : (
                  filteredUsers.slice(0, 100).map((user) => (
                    <div key={user.id} className="px-3 py-3 border-b border-gray-100 last:border-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[14px] font-bold text-gray-900 truncate">{user.nickname ?? "닉네임 없음"}</p>
                          <button
                            type="button"
                            onClick={() => toggleUserIdVisibility(user.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-700"
                            aria-label={visibleUserIds.includes(user.id) ? "ID 숨기기" : "ID 보기"}
                            title={visibleUserIds.includes(user.id) ? "ID 숨기기" : "ID 보기"}
                          >
                            {visibleUserIds.includes(user.id) ? (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M1.5 8s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/>
                                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
                                <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M1.5 8s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/>
                                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        {visibleUserIds.includes(user.id) && (
                          <p className="text-[11px] text-gray-400 font-mono mt-1 break-all">{user.id}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-gray-500">가입 {formatDateTime(user.created_at)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          최근 활동 {user.last_activity_at ? relativeTime(user.last_activity_at) : "—"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {filteredUsers.length > 100 && (
                <p className="text-[11px] text-gray-400 px-1">검색 결과가 많아 최근 100명만 보여주고 있어요.</p>
              )}
            </div>
          </div>

        </>
      )}

    </main>
  );
}
