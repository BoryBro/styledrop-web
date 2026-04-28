"use client";

import { useState, useEffect, useRef } from "react";
import {
  AUDITION_CONTROL_ID,
  BALANCE_100_CONTROL_ID,
  MAGAZINE_CONTROL_ID,
  NABO_CONTROL_ID,
  NABO_PREDICT_CONTROL_ID,
  PERSONAL_COLOR_CONTROL_ID,
  TRAVEL_TOGETHER_CONTROL_ID,
  applyStyleControl,
  type StyleControlState,
} from "@/lib/style-controls";
import { PAYMENT_PACKAGES, REFUND_UNIT_PRICE } from "@/lib/payment-policy";
import {
  REFERRAL_GENERATION_REWARD_CREDITS,
  REFERRAL_GENERATION_THRESHOLD,
  REFERRAL_MONTHLY_REWARD_CAP_CREDITS,
  REFERRAL_PAYMENT_REWARD_CREDITS,
  REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS,
} from "@/lib/referral";
import { ALL_STYLES } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

const ADMIN_UI_VERSION = "v2.12.0-console-admin";

type AdminTab = "dashboard" | "ops" | "metrics" | "revenue" | "users" | "analytics";

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
type ApiUsageBreakdownItem = {
  key: string;
  label: string;
  note: string;
  count: number;
  uniqueUsers: number;
  userRatio: number;
  usageRatio: number;
};
type LabExperimentStat = {
  key: string;
  label: string;
  totalParticipants: number;
  todayParticipants: number;
  completedCount: number;
  todayCompletedCount: number;
  unlockCount: number;
  todayUnlockCount: number;
  completedLabel?: string;
  unlockLabel?: string | null;
  extraLabel?: string;
  extraCount?: number;
  todayExtraCount?: number;
  paidParticipants: number;
};
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
type GenerationHistoryItem = {
  id: string;
  user_id: string;
  nickname: string | null;
  style_id: string;
  style_name: string;
  created_at: string;
  success: boolean;
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
  apiUsageBreakdown: ApiUsageBreakdownItem[];
  labExperiments: LabExperimentStat[];
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
  labNaboShareKakao: number;
  shareByStyleList: { style_id: string; style_name: string; kakao: number; link: number; total: number }[];
  totalRevenue: number;
  totalPaymentCount: number;
  totalPaidUsers: number;
  todayRevenue: number;
  monthlyCosts: Record<string, {
    styleCount: number;
    auditionCount: number;
    auditionStillCount?: number;
    duoSubmissionCount?: number;
    apiCost: number;
    revenue: number;
    soldCredits?: number;
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
  styleCount: number; auditionCount: number; auditionStillCount?: number; duoSubmissionCount?: number; apiCost: number; revenue: number; soldCredits?: number;
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

const ESTIMATED_KAKAOPAY_FEE_RATE = 0.032;
const VAT_DIVISOR = 11;
const CONSERVATIVE_CREDIT_COST_KRW = 130;
const MEASURED_CREDIT_COST_RANGE_TEXT = "111~133원";

function estimateVat(amount: number) {
  return Math.round(amount / VAT_DIVISOR);
}

function estimateKakaoPayFee(amount: number) {
  return Math.round(amount * ESTIMATED_KAKAOPAY_FEE_RATE);
}

function estimateNetPaymentRevenue(amount: number) {
  return Math.max(0, amount - estimateVat(amount) - estimateKakaoPayFee(amount));
}

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
      badgeClass: "text-[#18794E]",
      detail: `오류 이후 ${relativeTime(item.latestSuccessAt)} 다시 성공했습니다.`,
      action: "조치 불필요",
      needsAction: false,
    };
  }

  return {
    label: "미해결",
    badgeClass: "text-red-600",
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

function MonthlyCostSection({ monthlyCosts }: { monthlyCosts: Record<string, MonthlyCost> }) {
  const [activeMonth, setActiveMonth] = useState("2026-04");
  const months = [
    { key: "2026-03", label: "3월", note: "참고" },
    { key: "2026-04", label: "4월", note: "현재" },
  ];
  const m = monthlyCosts?.[activeMonth];
  const duoSubmissionCount = m?.duoSubmissionCount ?? 0;
  const grossRevenue = m?.revenue ?? 0;
  const vatAmount = estimateVat(grossRevenue);
  const supplyRevenue = Math.max(0, grossRevenue - vatAmount);
  const estimatedPgFee = estimateKakaoPayFee(grossRevenue);
  const estimatedProfit = m ? supplyRevenue - estimatedPgFee - m.apiCost : 0;
  const soldCredits = m?.soldCredits ?? 0;
  const fullCreditUseCost = soldCredits * CONSERVATIVE_CREDIT_COST_KRW;
  const fullCreditUseProfit = m ? supplyRevenue - estimatedPgFee - fullCreditUseCost : 0;
  const costRatio = grossRevenue > 0 ? Math.round((m!.apiCost / grossRevenue) * 100) : 0;
  const profitRatio = grossRevenue > 0 ? Math.round((estimatedProfit / grossRevenue) * 100) : 0;
  const fullCreditUseProfitRatio = grossRevenue > 0 ? Math.round((fullCreditUseProfit / grossRevenue) * 100) : 0;
  const weightedCalls = m
    ? m.styleCount + (m.auditionCount * 2) + (m.auditionStillCount ?? 0) + duoSubmissionCount
    : 0;
  const realizedCostPerCall = weightedCalls > 0 && m ? Math.round(m.apiCost / weightedCalls) : null;

  const isActual = m?.costSource === "bigquery_actual" || m?.costSource === "manual_actual";

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">추정 순이익 계산기</p>
      <div className="flex overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        {months.map(({ key, label, note }) => (
          <button
            key={key}
            onClick={() => setActiveMonth(key)}
            className={`flex-1 border-r border-[#F0F0F0] py-3 text-[14px] font-bold transition-colors last:border-r-0 ${
              activeMonth === key ? "text-[#C9571A]" : "text-[#8A8A8A]"
            }`}
          >
            {label} <span className="text-[12px] font-normal opacity-60">{note}</span>
          </button>
        ))}
      </div>
      {m && (
        <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-gray-900">
                {activeMonth === "2026-04" ? "이번 달 추정 순이익" : "3월 추정 순이익"}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                실결제액에서 VAT, 카카오 수수료, Gemini 비용을 차감합니다.
              </p>
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {isActual ? "실제 청구서 기준" : "실제 청구서 보정 추정"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <MiniCard label="실결제 매출" value={`₩${grossRevenue.toLocaleString()}`} accent />
            <MiniCard label="VAT 제외 매출" value={`₩${supplyRevenue.toLocaleString()}`} />
            <MiniCard label="카카오 수수료" value={`-₩${estimatedPgFee.toLocaleString()}`} />
            <MiniCard label="Gemini 비용" value={`-₩${m.apiCost.toLocaleString()}`} />
            <MiniCard label="실사용 기준 순이익" value={`${estimatedProfit >= 0 ? "+" : ""}₩${estimatedProfit.toLocaleString()}`} accent={estimatedProfit >= 0} />
            <MiniCard label="실사용 기준 이익률" value={grossRevenue > 0 ? `${profitRatio}%` : "—"} />
            <MiniCard label="보수 원가 기준" value={`₩${CONSERVATIVE_CREDIT_COST_KRW}/크레딧`} />
            <MiniCard label="실측 원가 범위" value={MEASURED_CREDIT_COST_RANGE_TEXT} />
            <MiniCard label="판매 크레딧" value={`${soldCredits.toLocaleString()}개`} />
            <MiniCard label="전량 소진 비용" value={`-₩${fullCreditUseCost.toLocaleString()}`} />
            <MiniCard label="전량 소진 순이익" value={`${fullCreditUseProfit >= 0 ? "+" : ""}₩${fullCreditUseProfit.toLocaleString()}`} accent={fullCreditUseProfit >= 0} />
            <MiniCard label="전량 소진 이익률" value={grossRevenue > 0 ? `${fullCreditUseProfitRatio}%` : "—"} />
          </div>

          <div className="flex flex-col gap-2 border-y border-[#F0F0F0] py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">VAT 차감액</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                -₩{vatAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">AI 원가율</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {grossRevenue > 0 ? `${costRatio}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-2">
              <span className="text-[13px] text-gray-500">호출 집계</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.styleCount + m.auditionCount + (m.auditionStillCount ?? 0) + duoSubmissionCount}건
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">해당 월 판매 크레딧</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {soldCredits.toLocaleString()}개
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">보정 호출당 원가</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {realizedCostPerCall ? `약 ${realizedCostPerCall.toLocaleString()}원` : "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-y border-[#F0F0F0] py-3">
            <p className="text-[13px] font-bold text-gray-900">기능별 사용량</p>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">스타일 카드</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.styleCount}건
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">AI 오디션 분석</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.auditionCount}건
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">오디션 스틸컷</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {m.auditionStillCount ?? 0}건
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500">친구 배틀 평가</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                {duoSubmissionCount}건
              </span>
            </div>
          </div>

          {activeMonth === "2026-04" && !isActual && m.referenceWindow && (
            <div className="flex flex-col gap-2 border-y border-[#F0D5C6] bg-[#FFF9F5] py-3">
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
              <p className="text-[11px] text-gray-500 leading-relaxed">
                이 보정은 총비용 추정용입니다. 기능별 개별 원가를 확정하는 숫자는 아닙니다.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-y border-[#E5E7EB] bg-[#FAFAFA] py-3">
            <p className="text-[13px] font-bold text-gray-900">공식 가격표 기준</p>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-500">실사용 모델</span>
              <span className="text-[12px] font-medium text-gray-900">gemini-3.1-flash-image-preview</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-500">이미지 생성 1회 공식 단가</span>
              <span className="text-[12px] font-medium text-gray-900">$0.045~$0.151</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-500">운영 판단 원가</span>
              <span className="text-[12px] font-medium text-gray-900">1크레딧 약 {CONSERVATIVE_CREDIT_COST_KRW}원</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              실제 청구 기준 3월 약 133원, 4월 보정 약 111원이라 보수적으로 130원으로 봅니다.
            </p>
          </div>

          <div className="text-[11px] text-gray-400 px-1 leading-relaxed">
            <p>매출은 payments 기준 실결제 순매출만 잡습니다.</p>
            <p>무료크레딧, 가입 보너스, 수동 지급, 환불 지급분은 매출에 포함되지 않습니다.</p>
            <p>전량 소진 순이익은 해당 월에 판매된 크레딧이 모두 사용된다고 보고 130원씩 차감합니다.</p>
            <p>VAT는 실결제액의 1/11로 계산합니다.</p>
            <p>카카오 수수료는 현재 3.2% 가정으로 계산합니다.</p>
            <p>AI 비용 = {isActual ? "Google Billing export 실제값" : "실청구 보정 추정값"}</p>
            {isActual
              ? <p>{activeMonth} 비용은 실제 Gemini 청구 데이터 기준입니다.</p>
              : <p>4월은 4/1~4/7 실제 청구서 15,999원을 기준으로 보정한 추정치입니다.</p>}
            <p>기능별 정확한 KRW 원가 배분은 현재 토큰 로그가 없어, 판매 판단은 130원/크레딧 보수 기준으로 봅니다.</p>
            <p>광고비, 인건비, 기타 운영비는 아직 제외하지 않았습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiUsageBreakdownSection({ stats }: { stats: Stats }) {
  const accentByKey: Record<string, string> = {
    "general-card": "#C9571A",
    "multi-card": "#7C5CFA",
    audition: "#111827",
    nabo: "#22C55E",
    travel_together: "#3B82F6",
    personal_color: "#8DAEFF",
    balance_100: "#E11D48",
  };
  const trackedTotal = stats.apiUsageBreakdown.reduce((sum, item) => sum + item.count, 0);
  const activeUsers = Math.max(...stats.apiUsageBreakdown.map((item) => item.uniqueUsers), 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">기능별 사용</p>
      <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="grid grid-cols-3 gap-2">
          <MiniCard label="전체 가입" value={`${stats.totalUsers}명`} accent />
          <MiniCard label="총 사용" value={`${trackedTotal}회`} />
          <MiniCard label="최대 이용자" value={`${activeUsers}명`} />
        </div>

        <div className="overflow-hidden border-y border-[#E7E7E7]">
          <div className="grid grid-cols-[1.4fr_0.72fr_0.72fr_0.72fr] gap-2 bg-[#FAFAFA] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
            <span>종류</span>
            <span className="text-right">횟수</span>
            <span className="text-right">사람</span>
            <span className="text-right">가입자 중</span>
          </div>

          {stats.apiUsageBreakdown.map((item) => {
            const accent = accentByKey[item.key] ?? "#C9571A";

            return (
              <div key={item.key} className="border-t border-gray-100 px-3 py-4 first:border-t-0">
                <div className="grid grid-cols-[1.4fr_0.72fr_0.72fr_0.72fr] gap-2 items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 flex-shrink-0" style={{ backgroundColor: accent }} />
                      <p className="text-[14px] font-bold text-gray-900 truncate">{item.label}</p>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-gray-500">{item.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-extrabold tabular-nums text-gray-900">{item.count}회</p>
                    <p className="text-[11px] text-gray-400">전체 중 {item.usageRatio}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-extrabold tabular-nums text-gray-900">{item.uniqueUsers}명</p>
                    <p className="text-[11px] text-gray-400">사용한 사람</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-extrabold tabular-nums" style={{ color: accent }}>{item.userRatio}%</p>
                    <p className="text-[11px] text-gray-400">가입자 중</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <div className="bg-[#FAFAFA] px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>가입자 중 사용</span>
                      <span>{item.userRatio}%</span>
                    </div>
                    <Bar ratio={item.userRatio} color={accent} />
                  </div>
                  <div className="bg-[#FAFAFA] px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>전체 사용 중</span>
                      <span>{item.usageRatio}%</span>
                    </div>
                    <Bar ratio={item.usageRatio} color={accent} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] leading-relaxed text-gray-400 px-1">
          일반/2인/오디션은 AI 호출 기준, 실험실은 참여 이벤트 기준입니다.
        </p>
      </div>
    </div>
  );
}

const PROFIT_PACKAGES = [
  { id: "basic", label: "Basic", credits: PAYMENT_PACKAGES.basic.credits, price: PAYMENT_PACKAGES.basic.amount, priceStr: "1,900" },
  { id: "plus",  label: "Plus",  credits: PAYMENT_PACKAGES.plus.credits, price: PAYMENT_PACKAGES.plus.amount, priceStr: "4,900" },
  { id: "pro",   label: "Pro",   credits: PAYMENT_PACKAGES.pro.credits, price: PAYMENT_PACKAGES.pro.amount, priceStr: "9,900" },
] as const;

function CostFactSection() {
  const packageRows = PROFIT_PACKAGES.map((pkg) => ({
    ...pkg,
    grossCreditUnit: Math.round(pkg.price / pkg.credits),
    netRevenue: estimateNetPaymentRevenue(pkg.price),
    netCreditUnit: Math.round(estimateNetPaymentRevenue(pkg.price) / pkg.credits),
    conservativeAiCost: pkg.credits * CONSERVATIVE_CREDIT_COST_KRW,
    estimatedPackageProfit: estimateNetPaymentRevenue(pkg.price) - (pkg.credits * CONSERVATIVE_CREDIT_COST_KRW),
    unitMargin: Math.round(estimateNetPaymentRevenue(pkg.price) / pkg.credits) - CONSERVATIVE_CREDIT_COST_KRW,
  }));
  const generationRewardCost =
    (REFERRAL_GENERATION_THRESHOLD + REFERRAL_GENERATION_REWARD_CREDITS) * CONSERVATIVE_CREDIT_COST_KRW;
  const generationRewardCostPerFriend = Math.round(generationRewardCost / REFERRAL_GENERATION_THRESHOLD);
  const firstPaymentRewardCredits = REFERRAL_PAYMENT_REWARD_CREDITS + REFERRAL_REFERRED_PAYMENT_BONUS_CREDITS;
  const firstPaymentRewardCost = firstPaymentRewardCredits * CONSERVATIVE_CREDIT_COST_KRW;
  const monthlyCapCost = REFERRAL_MONTHLY_REWARD_CAP_CREDITS * CONSERVATIVE_CREDIT_COST_KRW;

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">패키지 · 추천 손익 기준</p>
      <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-bold text-gray-900">현재 판매/보상 기준</p>
          <p className="text-[12px] leading-relaxed text-gray-500">
            판매가는 유지하고 지급 크레딧은 10/28/60으로 계산합니다. 원가는 보수적으로 1크레딧 130원으로 봅니다.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="border-y border-[#F0F0F0] py-3">
            <p className="text-[13px] font-bold text-gray-900">이미지 생성 계열</p>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              일반 카드, 옵션 카드, 2인 카드, 오디션 스틸컷
            </p>
            <p className="mt-2 text-[12px] font-medium text-gray-900">실측 {MEASURED_CREDIT_COST_RANGE_TEXT} · 보수 {CONSERVATIVE_CREDIT_COST_KRW}원</p>
          </div>
          <div className="border-y border-[#F0F0F0] py-3">
            <p className="text-[13px] font-bold text-gray-900">텍스트 평가 계열</p>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              AI 오디션 분석, 친구 배틀 평가
            </p>
            <p className="mt-2 text-[12px] font-medium text-gray-900">토큰량 기준 · 이미지 생성보다 낮음</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-y border-[#F0F0F0] py-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">실사용 모델</span>
            <span className="text-[12px] font-medium text-gray-900">gemini-3.1-flash-image-preview</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">AI 원가 직접 발생 기능</span>
            <span className="text-[12px] font-medium text-gray-900">일반 · 2인 · 오디션 · 친구 배틀</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">현재 직접 제외 기능</span>
            <span className="text-[12px] font-medium text-gray-900">퍼스널 컬러 · 내가 보는 너 · 여행</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-y border-[#F0F0F0] py-3">
          <p className="text-[13px] font-bold text-gray-900">패키지 단가 메모</p>
          {packageRows.map((pkg) => (
            <div key={pkg.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-gray-900">{pkg.label}</p>
                <p className="text-[11px] text-gray-400">
                  {pkg.price.toLocaleString()}원 · {pkg.credits}크레딧 · 표시 단가 {pkg.grossCreditUnit}원
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`text-[12px] font-bold ${pkg.estimatedPackageProfit >= 0 ? "text-[#18794E]" : "text-red-600"}`}>
                  예상 {pkg.estimatedPackageProfit >= 0 ? "+" : ""}{pkg.estimatedPackageProfit.toLocaleString()}원
                </p>
                <p className="text-[11px] text-gray-400">
                  수수료 후 {pkg.netCreditUnit}원/개 · 마진 {pkg.unitMargin}원/개
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-y border-[#F0F0F0] py-3">
          <p className="text-[13px] font-bold text-gray-900">추천 보상 원가</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-gray-500">친구 3명 첫 결과 생성</span>
            <span className="text-[12px] font-medium text-gray-900">
              약 {generationRewardCost.toLocaleString()}원 · 1명당 {generationRewardCostPerFriend.toLocaleString()}원
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-gray-500">친구 첫 결제 보상</span>
            <span className="text-[12px] font-medium text-gray-900">
              {firstPaymentRewardCredits}크레딧 · 약 {firstPaymentRewardCost.toLocaleString()}원
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-gray-500">추천인 월 한도 비용</span>
            <span className="text-[12px] font-medium text-gray-900">
              {REFERRAL_MONTHLY_REWARD_CAP_CREDITS}크레딧 · 약 {monthlyCapCost.toLocaleString()}원
            </span>
          </div>
        </div>

        <div className="text-[11px] leading-relaxed text-gray-400">
          <p>친구 배틀은 방 생성 때가 아니라 제출 성공 시 5크레딧이 차감됩니다.</p>
          <p>오디션은 시작 5크레딧 패키지에 분석과 스틸컷 흐름이 같이 포함됩니다.</p>
          <p>패키지 마진은 VAT와 카카오 수수료를 차감한 뒤, 모든 크레딧이 사용된다고 가정한 보수 계산입니다.</p>
        </div>
      </div>
    </div>
  );
}

type ProfitUsageKey = "general" | "lab2" | "lab5" | "audition";

function ProfitCalculator() {
  const [pkgId, setPkgId] = useState<"basic" | "plus" | "pro">("plus");
  const [buyers, setBuyers] = useState(100);
  const [usageMix, setUsageMix] = useState<Record<ProfitUsageKey, number>>({
    general: 65,
    lab2: 15,
    lab5: 10,
    audition: 10,
  });

  const pkg = PROFIT_PACKAGES.find((item) => item.id === pkgId)!;
  const totalCredits = buyers * pkg.credits;
  const totalGrossRevenue = buyers * pkg.price;
  const totalNetRevenue = buyers * estimateNetPaymentRevenue(pkg.price);

  const handleUsageChange = (key: ProfitUsageKey, value: number) => {
    const nextValue = Math.min(100, Math.max(0, value));
    const keys = Object.keys(usageMix) as ProfitUsageKey[];
    const otherKeys = keys.filter((item) => item !== key);
    const otherTotal = otherKeys.reduce((sum, item) => sum + usageMix[item], 0);
    const rest = 100 - nextValue;
    const next: Record<ProfitUsageKey, number> = { ...usageMix, [key]: nextValue };

    if (otherTotal <= 0) {
      const base = Math.floor(rest / otherKeys.length);
      let used = 0;
      otherKeys.forEach((item, index) => {
        const amount = index === otherKeys.length - 1 ? rest - used : base;
        next[item] = amount;
        used += amount;
      });
    } else {
      let used = 0;
      otherKeys.forEach((item, index) => {
        const amount = index === otherKeys.length - 1
          ? rest - used
          : Math.round(rest * (usageMix[item] / otherTotal));
        next[item] = amount;
        used += amount;
      });
    }

    setUsageMix(next);
  };

  const usageRows = [
    {
      key: "general" as const,
      label: "일반 카드",
      note: "2cr -> 1 이미지 호출",
      creditCost: 2,
      apiCostPerUse: CONSERVATIVE_CREDIT_COST_KRW,
      color: "bg-[#C9571A]",
    },
    {
      key: "lab2" as const,
      label: "실험실 2크레딧",
      note: "2cr -> 직접 AI 원가 없음",
      creditCost: 2,
      apiCostPerUse: 0,
      color: "bg-[#3B82F6]",
    },
    {
      key: "lab5" as const,
      label: "실험실 5크레딧",
      note: "5cr -> 직접 AI 원가 없음",
      creditCost: 5,
      apiCostPerUse: 0,
      color: "bg-[#22C55E]",
    },
    {
      key: "audition" as const,
      label: "AI 오디션",
      note: "5cr -> 분석+스틸 원가",
      creditCost: 5,
      apiCostPerUse: CONSERVATIVE_CREDIT_COST_KRW * 3,
      color: "bg-[#111827]",
    },
  ].map((row) => {
    const allocatedCredits = totalCredits * (usageMix[row.key] / 100);
    const uses = allocatedCredits / row.creditCost;
    const apiCost = Math.round(uses * row.apiCostPerUse);
    return {
      ...row,
      pct: usageMix[row.key],
      allocatedCredits,
      uses,
      apiCost,
    };
  });

  const totalApiCost = usageRows.reduce((sum, row) => sum + row.apiCost, 0);
  const totalProfit = totalNetRevenue - totalApiCost;
  const margin = totalNetRevenue > 0 ? Math.round((totalProfit / totalNetRevenue) * 100) : 0;
  const quickBuyerOptions = [10, 100, 1000, 10000];

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">순수익 시뮬레이터</p>
      <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-gray-900">구매자 수별 예상 순수익</p>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              구매자 수와 사용 패턴을 바꿔서 VAT, 카카오 수수료, 호출비용 차감 후 남는 돈을 봅니다.
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-[#FFF8F3] px-2.5 py-1 text-[11px] font-bold text-[#C9571A]">
            10/28/60 기준
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PROFIT_PACKAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPkgId(item.id)}
              className={`border px-3 py-3 text-left transition-colors ${
                pkgId === item.id
                  ? "border-[#C9571A] bg-[#FFF8F3] text-[#C9571A]"
                  : "border-[#E5E7EB] bg-[#FAFAFA] text-gray-600 hover:border-[#D1D5DB]"
              }`}
            >
              <p className="text-[13px] font-black">{item.label}</p>
              <p className="mt-0.5 text-[11px] font-medium">
                {item.priceStr}원 · {item.credits}cr
              </p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-700">구매자 수</span>
            <span className="text-[18px] font-black text-gray-900 tabular-nums">{buyers.toLocaleString()}명</span>
          </div>
          <input
            type="range"
            min={1}
            max={10000}
            value={buyers}
            onChange={(event) => setBuyers(Number(event.target.value))}
            className="w-full accent-[#C9571A]"
          />
          <div className="flex flex-wrap gap-1.5">
            {quickBuyerOptions.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setBuyers(count)}
                className="border border-[#E5E7EB] bg-[#FAFAFA] px-2.5 py-1 text-[11px] font-bold text-gray-500 transition-colors hover:border-[#C9571A]/40 hover:text-[#C9571A]"
              >
                {count.toLocaleString()}명
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-700">사용 패턴</span>
            <span className="text-[11px] text-gray-400">합계 100%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
            {usageRows.map((row) => (
              <div key={row.key} className={`${row.color} transition-all`} style={{ width: `${row.pct}%` }} />
            ))}
          </div>
          {usageRows.map((row) => (
            <div key={row.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${row.color}`} />
                  <span className="font-bold text-gray-800">{row.label}</span>
                  <span className="truncate text-gray-400">{row.note}</span>
                </div>
                <span className="flex-shrink-0 font-black text-gray-900 tabular-nums">{row.pct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={row.pct}
                onChange={(event) => handleUsageChange(row.key, Number(event.target.value))}
                className="w-full accent-[#C9571A]"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-y border-[#F0F0F0] bg-[#FAFAFA] py-3">
          <div className="flex items-center justify-between px-3 text-[13px]">
            <span className="text-gray-500">총 결제액</span>
            <span className="font-bold text-gray-900">+{totalGrossRevenue.toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between px-3 text-[13px]">
            <span className="text-gray-500">순수취액</span>
            <span className="font-bold text-gray-900">+{totalNetRevenue.toLocaleString()}원</span>
          </div>
          {usageRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 px-3 text-[12px]">
              <span className="min-w-0 text-gray-400">
                {row.label} 약 {Math.round(row.uses).toLocaleString()}회 · {Math.round(row.allocatedCredits).toLocaleString()}cr
              </span>
              <span className="flex-shrink-0 font-medium text-red-400">-{row.apiCost.toLocaleString()}원</span>
            </div>
          ))}
          <div className="mx-3 h-px bg-[#E5E7EB]" />
          <div className="flex items-center justify-between gap-3 px-3">
            <span className="text-[14px] font-black text-gray-900">예상 순수익</span>
            <div className="text-right">
              <p className={`text-[23px] font-black tabular-nums ${totalProfit >= 0 ? "text-[#C9571A]" : "text-red-500"}`}>
                {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()}원
              </p>
              <p className="text-[12px] font-medium text-gray-400">마진 {margin}%</p>
            </div>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-gray-400">
          일반 카드는 2크레딧당 이미지 호출 1회, AI 오디션은 5크레딧당 보정 호출 3회로 계산합니다. 실험실 2/5크레딧은 현재 직접 Gemini 호출비용 0원 기준입니다.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, note, highlight }: { label: string; value: string | number; note?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#F0F0F0] py-3 last:border-0">
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
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">{title}</p>
      <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {children}
      </div>
    </div>
  );
}

function Bar({ ratio, color = "#C9571A" }: { ratio: number; color?: string }) {
  return (
    <div className="mt-1 h-1 w-full bg-[#E7E7E7]">
      <div className="h-1 transition-all duration-500" style={{ width: `${ratio}%`, backgroundColor: color }} />
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
    <div className="flex items-center gap-3 border-b border-[#F0F0F0] py-3 last:border-0">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center ${iconBg}`}>
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
    <div className="flex flex-col gap-0.5 border border-[#E5E7EB] bg-white px-3 py-3">
      <span className="text-[11px] font-bold leading-snug text-[#6B7280]">{label}</span>
      <span className={`text-[20px] font-black tabular-nums leading-tight ${accent ? "text-[#C9571A]" : "text-[#111827]"}`}>{value}</span>
    </div>
  );
}

function LabExperimentTabs({ items }: { items: LabExperimentStat[] }) {
  if (!items.length) {
    return <p className="py-5 text-[13px] text-gray-500">실험실 지표 데이터가 아직 없어요.</p>;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[#E7E7E7] pt-3">
      {items.map((item) => {
        const conversionRate = item.totalParticipants > 0 && item.paidParticipants > 0
          ? Math.round((item.paidParticipants / item.totalParticipants) * 100)
          : 0;
        return (
          <div key={item.key} className="flex items-center justify-between py-2 border-b border-[#EEF0F2] last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-gray-900 text-[13px] font-bold">{item.label}</p>
            </div>
            <div className="text-right text-[12px] text-gray-600 flex-shrink-0">
              <span className="font-semibold">참여 {item.totalParticipants}</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="font-semibold">결제 {item.paidParticipants}</span>
              <span className="text-[#C9571A] font-bold ml-2">({conversionRate}%)</span>
            </div>
          </div>
        );
      })}
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
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#E5E7EB]"
          : "text-[#4B5563] hover:bg-white/70 hover:text-[#111827]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? "bg-[#F06B35]" : "bg-[#CBD5E1]"}`} />
      <span className="min-w-0">
        <span className="block text-[14px] font-extrabold tracking-[-0.02em]">{label}</span>
        <span className={`mt-0.5 block text-[11px] ${active ? "text-[#6B7280]" : "text-[#9CA3AF]"}`}>{note}</span>
      </span>
    </button>
  );
}

function ShareViralSection({ stats, shareTotal, shareRatio }: {
  stats: Stats; shareTotal: number; shareRatio: number;
}) {
  const [tab, setTab] = useState<"style" | "audition" | "lab">("style");
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">공유 & 바이럴</p>
      {/* 탭 버튼 */}
      <div className="flex overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <button
          type="button"
          onClick={() => setTab("style")}
          className={`flex-1 border-r border-[#F0F0F0] py-2 text-[12px] font-bold transition-colors ${tab === "style" ? "text-[#C9571A]" : "text-gray-500"}`}
        >
          스타일 카드
        </button>
        <button
          type="button"
          onClick={() => setTab("audition")}
          className={`flex-1 border-r border-[#F0F0F0] py-2 text-[12px] font-bold transition-colors ${tab === "audition" ? "text-[#C9571A]" : "text-gray-500"}`}
        >
          AI 오디션
        </button>
        <button
          type="button"
          onClick={() => setTab("lab")}
          className={`flex-1 py-2 text-[12px] font-bold transition-colors ${tab === "lab" ? "text-[#C9571A]" : "text-gray-500"}`}
        >
          실험실
        </button>
      </div>

      {/* 스타일 카드 탭 */}
      {tab === "style" && (
        <div className="flex flex-col gap-0.5">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-5">
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
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-5">
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

      {tab === "lab" && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-5">
          <ShareRow
            icon={<KakaoIcon />} iconBg="bg-[#FEE500]"
            label="내가 보는 너 초대 공유" count={`${stats.labNaboShareKakao}회`}
          />
          <ShareRow
            icon={<RatioIcon />} iconBg="bg-orange-50"
            label="실험실 공유 합계" count={`${stats.labNaboShareKakao}회`}
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
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [styleOpsView, setStyleOpsView] = useState<"cards" | "lab">("cards");
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
  const [generationErrorDeleteLoading, setGenerationErrorDeleteLoading] = useState<string | null>(null);
  const [generationErrorDeleteMsg, setGenerationErrorDeleteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [analyticsSearchUser, setAnalyticsSearchUser] = useState("");
  const [analyticsData, setAnalyticsData] = useState<GenerationHistoryItem[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [analyticsMountTime] = useState(new Date());
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
        localStorage.removeItem("threads_admin_pw");
      } else {
        localStorage.setItem("sd_admin_pw", pw);
        localStorage.setItem("threads_admin_pw", pw);
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

  // 마운트 시 저장된 비밀번호로 자동 로그인 (두 어드민 페이지 SSO)
  useEffect(() => {
    const saved = localStorage.getItem("sd_admin_pw") || localStorage.getItem("threads_admin_pw");
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

  const loadAnalyticsData = async (searchUser: string) => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchUser) params.set("searchUser", searchUser);
      const res = await fetch(`/api/admin/generation-history?${params}`, {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      setAnalyticsData(data.data || []);
    } catch (error) {
      console.error("분석 데이터 로드 실패:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAnalyticsSearch = (value: string) => {
    setAnalyticsSearchUser(value);
    loadAnalyticsData(value);
  };

  const downloadAnalyticsCSV = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/admin/generation-history`, {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      const items: GenerationHistoryItem[] = data.data || [];

      const csv = [
        ["생성 시간", "사용자", "카드명", "결과"].join(","),
        ...items.map((item) =>
          [
            new Date(item.created_at).toLocaleString("ko-KR"),
            item.nickname || "Unknown",
            item.style_name,
            item.success ? "성공" : "실패",
          ]
            .map((v) => `"${v}"`)
            .join(",")
        ),
      ].join("\n");

      const now = new Date();
      const month = now.getMonth() + 1;
      const week = Math.ceil(now.getDate() / 7);
      const fileName = `${month}월-${week}주차-카드생성기록.csv`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.click();
    } catch (error) {
      console.error("CSV 다운로드 실패:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analytics" && stats && analyticsData.length === 0) {
      loadAnalyticsData("");
    }
  }, [activeTab, stats]);

  useEffect(() => {
    if (activeTab === "analytics") {
      const deleteTime = new Date(analyticsMountTime.getTime() + 7 * 24 * 60 * 60 * 1000);

      const updateCountdown = () => {
        const now = new Date();
        const diff = deleteTime.getTime() - now.getTime();

        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setDeleteCountdown({ days, hours, minutes, seconds });
        } else {
          setDeleteCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);

      return () => clearInterval(interval);
    }
  }, [activeTab, analyticsMountTime]);

  if (!stats) {
    return (
      <main className="flex min-h-screen w-full flex-col bg-[#F7F6F3]">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-20">
        <h1 className="mb-6 text-2xl font-black tracking-[-0.04em] text-[#111827]">Admin</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="w-full border-y border-[#E7E7E7] bg-white px-4 py-4 text-[15px] text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-[#C9571A]"
            autoFocus
          />
          {error && <p className="text-[#C9571A] text-[15px] font-medium">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-[#111827] py-4 font-bold text-white transition-colors disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isLoading ? "확인 중..." : "확인"}
          </button>
        </form>
        </div>
      </main>
    );
  }

  const shareTotal = stats.shareKakao + stats.shareLinkCopy;
  const shareRatio = stats.total > 0 ? Math.round((shareTotal / stats.total) * 100) : 0;
  const auditionControl = styleControls.find((row) => row.style_id === AUDITION_CONTROL_ID);
  const personalColorControl = styleControls.find((row) => row.style_id === PERSONAL_COLOR_CONTROL_ID);
  const naboControl = styleControls.find((row) => row.style_id === NABO_CONTROL_ID);
  const naboPredictControl = styleControls.find((row) => row.style_id === NABO_PREDICT_CONTROL_ID);
  const travelTogetherControl = styleControls.find((row) => row.style_id === TRAVEL_TOGETHER_CONTROL_ID);
  const balance100Control = styleControls.find((row) => row.style_id === BALANCE_100_CONTROL_ID);
  const magazineControl = styleControls.find((row) => row.style_id === MAGAZINE_CONTROL_ID);
  const specialFeatureControls = [
    auditionControl ? { title: "AI 오디션", control: auditionControl } : null,
    personalColorControl ? { title: "퍼스널 컬러", control: personalColorControl } : null,
    naboControl ? { title: "내가 보는 너", control: naboControl } : null,
    naboPredictControl ? { title: "너라면 그럴 줄 알았어", control: naboPredictControl } : null,
    travelTogetherControl ? { title: "여행을 같이 간다면", control: travelTogetherControl } : null,
    balance100Control ? { title: "극악 밸런스 100", control: balance100Control } : null,
    magazineControl ? { title: "매거진", control: magazineControl } : null,
  ].filter((item): item is { title: string; control: StyleControlState } => Boolean(item));
  const specialFeatureControlIds = new Set(specialFeatureControls.map((item) => item.control.style_id));
  const cardStyleControls = styleControls.filter(
    (row) => !specialFeatureControlIds.has(row.style_id)
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
  const sortedStylePerformance = sortedVisibleStyles
    .map((style) => {
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
    })
    .sort((a, b) => b.count - a.count);
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
    activeTab === "dashboard"
      ? "오늘 핵심 지표 한눈에 보기"
      : activeTab === "ops"
        ? "공지, 오류, 카드 숨김 같은 운영 대응"
        : activeTab === "metrics"
          ? "사용량, 저장률, 공유율 같은 성과 확인"
          : activeTab === "revenue"
            ? "매출, 비용, 환불 같은 돈 흐름 확인"
            : activeTab === "users"
              ? "크레딧 조정 같은 유저 대응"
              : "카드 생성 기록 조회";
  const pageTitle =
    activeTab === "dashboard"
      ? "대시보드"
      : activeTab === "ops"
        ? "운영 관리"
        : activeTab === "metrics"
          ? "데이터 분석"
          : activeTab === "revenue"
            ? "매출 관리"
            : activeTab === "users"
              ? "유저 관리"
              : "생성 기록";
  const todayLabel = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const activeSummaryCards =
    activeTab === "dashboard"
      ? []
      : activeTab === "users"
      ? [
          { label: "전체 가입 유저", value: `${stats.totalUsers}명`, accent: true },
          { label: "오늘 가입", value: `${stats.todaySignupCount}명` },
          { label: "변환한 유저", value: `${stats.uniqueLoggedInUsers}명` },
          { label: "로그인 변환 비율", value: `${stats.userRatio}%` },
        ]
      : activeTab === "revenue"
        ? [
            { label: "누적 매출", value: `${stats.totalRevenue.toLocaleString()}원`, accent: true },
            { label: "오늘 매출", value: `${stats.todayRevenue.toLocaleString()}원` },
            { label: "결제 건수", value: `${stats.totalPaymentCount}건` },
            { label: "자동 환불", value: `${stats.generationRefundTotal24h}건` },
          ]
        : activeTab === "metrics"
          ? [
              { label: "누적 변환", value: `${stats.total}회`, accent: true },
              { label: "오늘 변환", value: `${stats.todayTotal}회` },
              { label: "공유 합계", value: `${shareTotal}회` },
              { label: "공유 전환율", value: `${shareRatio}%` },
            ]
          : [
              { label: "24h 오류", value: `${stats.generationErrorTotal24h}건`, accent: stats.generationErrorTotal24h > 0 },
              { label: "미해결 카드", value: `${unresolvedErrorStyles.length}개` },
              { label: "10분 요청", value: `${stats.requestsLast10m}건` },
              { label: "자동 환불", value: `${stats.generationRefundTotal24h}건` },
            ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F5F6F8] text-[#111827]">
      <div className="min-h-screen overflow-x-hidden">
        <aside className="hidden w-[220px] shrink-0 border-r border-[#E5E7EB] bg-[#F1F3F5] lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
          <div className="border-b border-[#E5E7EB] px-5 py-5">
            <p className="text-[12px] font-bold text-[#6B7280]">StyleDrop</p>
            <p className="mt-1 text-[15px] font-black tracking-[-0.03em] text-[#111827]">관리자 콘솔</p>
            <p className="mt-1 text-[10px] font-bold text-[#9CA3AF]">{ADMIN_UI_VERSION}</p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            <AdminTabButton label="대시보드" note="오늘 핵심 요약" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
            <div className="my-2 h-px bg-[#E5E7EB]" />
            <AdminTabButton label="운영 관리" note="공지 · 오류 · 긴급 대응" active={activeTab === "ops"} onClick={() => setActiveTab("ops")} />
            <AdminTabButton label="데이터 분석" note="사용량 · 저장 · 공유" active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")} />
            <AdminTabButton label="매출 관리" note="비용 · 결제 · 환불" active={activeTab === "revenue"} onClick={() => setActiveTab("revenue")} />
            <AdminTabButton label="유저 관리" note="크레딧 대응" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
            <AdminTabButton label="생성 기록" note="카드 생성 히스토리" active={activeTab === "analytics"} onClick={() => { setActiveTab("analytics"); loadAnalyticsData(""); }} />
            <div className="my-3 h-px bg-[#E5E7EB]" />
            <a
              href="/admin/threads"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[#4B5563] transition-colors hover:bg-white/70 hover:text-[#111827]"
            >
              <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
              <span>
                <span className="block text-[14px] font-extrabold tracking-[-0.02em]">Threads 관리</span>
                <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">자동 발행 큐</span>
              </span>
            </a>
          </nav>

          <div className="border-t border-[#E5E7EB] p-3">
            <button
              onClick={() => doLogin(password)}
              disabled={isLoading || !password}
              className="mb-2 w-full rounded-md bg-[#273142] px-3 py-3 text-[13px] font-black text-white transition-colors hover:bg-[#1F2937] disabled:bg-gray-300"
            >
              {isLoading ? "새로고침 중..." : "전체 새로고침"}
            </button>
            <button
              onClick={() => { setStats(null); setPassword(""); localStorage.removeItem("sd_admin_pw"); localStorage.removeItem("threads_admin_pw"); if (timerRef.current) clearInterval(timerRef.current); }}
              className="w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-[12px] font-bold text-[#4B5563] transition-colors hover:text-[#111827]"
            >
              로그아웃
            </button>
          </div>
        </aside>

        <div className="min-h-screen min-w-0 lg:ml-[220px]">
          <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white">
            <div className="flex min-h-[58px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex min-w-0 items-center gap-4">
                <span className="text-[13px] font-black text-[#111827]">홈</span>
                <div className="h-4 w-px bg-[#E5E7EB]" />
                <span className="truncate text-[13px] font-bold text-[#9CA3AF]">{todayLabel}</span>
                {liveClock && (
                  <span className="font-mono text-[12px] text-[#9CA3AF] tabular-nums">
                    {liveClock.toTimeString().slice(0, 8)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/admin/threads"
                  className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#111827] transition-colors hover:bg-[#F9FAFB]"
                >
                  Threads 관리 ↗
                </a>
                <button
                  onClick={() => doLogin(password)}
                  disabled={isLoading || !password}
                  className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#111827] transition-colors hover:bg-[#F9FAFB] disabled:text-gray-300"
                >
                  {isLoading ? "새로고침 중..." : "새로고침"}
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-[1680px] min-w-0 flex-col gap-3 px-4 py-4 lg:px-6">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E5E7EB] bg-[#F1F3F5] p-2 lg:hidden">
              <AdminTabButton label="운영" note="공지 · 오류" active={activeTab === "ops"} onClick={() => setActiveTab("ops")} />
              <AdminTabButton label="지표" note="사용량 · 공유" active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")} />
              <AdminTabButton label="매출" note="비용 · 결제" active={activeTab === "revenue"} onClick={() => setActiveTab("revenue")} />
              <AdminTabButton label="유저" note="크레딧 대응" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
              <AdminTabButton label="분석" note="생성 기록" active={activeTab === "analytics"} onClick={() => { setActiveTab("analytics"); loadAnalyticsData(""); }} />
            </div>

            <section className="rounded-xl border border-[#EAECF0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[#EEF0F2]">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-bold text-[#9CA3AF]">대시보드</p>
                  <span className="h-3 w-px bg-[#E5E7EB]" />
                  <h1 className="text-[15px] font-black tracking-[-0.03em] text-[#111827]">{pageTitle}</h1>
                </div>
                <p className="text-[12px] text-[#9CA3AF] hidden lg:block">{tabSummary}</p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden bg-[#EEF0F2] md:grid-cols-4">
                {activeSummaryCards.map((card) => (
                  <div key={card.label} className="bg-white px-4 py-3">
                    <p className="text-[11px] font-bold text-[#6B7280]">{card.label}</p>
                    <p className={`mt-1 text-[24px] font-black tracking-[-0.05em] tabular-nums ${card.accent ? "text-[#C9571A]" : "text-[#111827]"}`}>
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

      {activeTab === "dashboard" && stats && (() => {
        const todayRefundCount = stats.paymentList.filter(p =>
          (p.status === "refunded" || p.status === "partially_refunded") &&
          p.refunded_at && new Date(p.refunded_at).toDateString() === new Date().toDateString()
        ).length;
        const top24hCard = stats.stylePerformance24hList?.[0];
        const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

        return (
          <div className="flex flex-col gap-3">
            <p className="px-1 text-[12px] text-gray-400">{today}</p>

            {/* 오늘 핵심 지표 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 [&>*]:min-w-0">
              <div className="flex flex-col gap-1 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">오늘 가입</span>
                <span className="text-[28px] font-black text-gray-900">{stats.todaySignupCount}<span className="text-[14px] font-normal text-gray-400 ml-1">명</span></span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">오늘 매출</span>
                <span className="text-[28px] font-black text-[#C9571A]">{stats.todayRevenue.toLocaleString()}<span className="text-[14px] font-normal text-gray-400 ml-1">원</span></span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">오늘 생성</span>
                <span className="text-[28px] font-black text-gray-900">{stats.todayTotal}<span className="text-[14px] font-normal text-gray-400 ml-1">회</span></span>
              </div>
              <div className={`flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${stats.generationErrorTotal24h > 0 ? "border-red-200" : "border-[#E5E7EB]"}`}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">24h 오류</span>
                <span className={`text-[28px] font-black ${stats.generationErrorTotal24h > 0 ? "text-red-500" : "text-gray-900"}`}>{stats.generationErrorTotal24h}<span className="text-[14px] font-normal text-gray-400 ml-1">건</span></span>
              </div>
            </div>

            {/* 2행 상세 지표 */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 [&>*]:min-w-0">
              {/* 오늘 1위 카드 */}
              <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">오늘 1위 카드</span>
                {top24hCard ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[16px] font-black text-gray-900 truncate">{top24hCard.style_name}</span>
                    <span className="text-[13px] text-gray-400">{top24hCard.count}회 생성</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-gray-400">데이터 없음</span>
                )}
              </div>

              {/* 환불 & 자동환불 */}
              <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">환불</span>
                <div className="flex flex-col gap-0">
                  <div className="flex justify-between items-center py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[12px] text-gray-500">오늘 환불 요청</span>
                    <span className={`text-[13px] font-bold ${todayRefundCount > 0 ? "text-red-500" : "text-gray-900"}`}>{todayRefundCount}건</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[12px] text-gray-500">24h 자동 환불</span>
                    <span className="text-[13px] font-bold text-gray-900">{stats.generationRefundTotal24h}건</span>
                  </div>
                </div>
              </div>

              {/* 로그인 vs 게스트 */}
              <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">로그인 vs 게스트</span>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-700 font-bold">로그인 생성 {stats.userCount}회</span>
                    <span className="text-gray-400">게스트 생성 {stats.guestCount}회</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full bg-[#C9571A]" style={{ width: `${stats.userRatio}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-400">이미지 생성 기준 · 로그인 {stats.userRatio}%</span>
                </div>
              </div>
            </div>

            {/* 방문자 수 — Vercel Analytics 연동 후 추가 예정 */}
            <div className="rounded-xl border border-dashed border-[#E5E7EB] px-5 py-4">
              <p className="text-[12px] text-gray-400">방문자 수는 Vercel Analytics 데이터가 쌓이면 여기에 표시됩니다.</p>
            </div>
          </div>
        );
      })()}

      {activeTab === "ops" && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          {/* 공지 관리 */}
          <div className="flex flex-col gap-1">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">공지 관리</p>
            <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
                    className="flex-1 border-y border-[#E7E7E7] bg-[#FAFAFA] px-3 py-2 text-[14px] font-mono text-gray-900 transition-colors focus:border-[#C9571A]/50 focus:outline-none"
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
                className="w-full bg-[#111827] py-3 text-[14px] font-bold text-white transition-colors disabled:bg-gray-200"
              >
                {noticesSaving ? "저장 중..." : noticesSaved ? "✓ 저장됨" : "저장하기"}
              </button>
            </div>
          </div>

          {/* 오류 모니터링 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3 px-1 mb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">오류 모니터링</p>
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
                  className="inline-flex items-center border-b border-red-300 px-1 py-1 text-[11px] font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generationErrorDeleteLoading === "bulk" ? "삭제 중..." : `미해결 기록 삭제 ${unresolvedRecentGenerationErrors.length}건`}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MiniCard label="최근 24시간 오류" value={`${stats.generationErrorTotal24h}건`} accent={stats.generationErrorTotal24h > 0} />
                <MiniCard label="미해결 카드" value={`${unresolvedErrorStyles.length}개`} accent={unresolvedErrorStyles.length > 0} />
                <MiniCard label="복구됨 카드" value={`${resolvedErrorStyles.length}개`} accent={resolvedErrorStyles.length > 0} />
                <MiniCard label="자동 환불" value={`${stats.generationRefundTotal24h}건`} accent={stats.generationRefundTotal24h > 0} />
              </div>

              {generationErrorDeleteMsg && (
                <div
                  className={`border-y px-3 py-2 text-[12px] font-medium ${
                    generationErrorDeleteMsg.ok
                      ? "border border-[#B7E1C4] bg-[#EEF8F1] text-[#18794E]"
                      : "border border-red-200 bg-red-50 text-red-600"
                  }`}
                >
                  {generationErrorDeleteMsg.text}
                </div>
              )}

              {stats.generationErrorSummary.length > 0 ? (
                <div className="overflow-hidden border-y border-[#E7E7E7]">
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
                                  <span className={`text-[10px] px-1 py-0.5 font-bold ${issue.badgeClass}`}>
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
                                  className="inline-flex items-center border-b border-[#F3D2BF] px-1 py-1 text-[11px] font-bold text-[#C9571A]"
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
                <div className="border-y border-[#E7E7E7] bg-[#FAFAFA] px-3 py-3 text-[13px] text-gray-500">
                  최근 24시간 기준 기록된 생성 오류가 없어요.
                </div>
              )}

              {stats.recentGenerationErrors.length > 0 && (
                <div className="overflow-hidden border-y border-[#E7E7E7]">
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
                              <span className={`text-[10px] px-1 py-0.5 font-bold ${issue.badgeClass}`}>
                                {issue.label}
                              </span>
                              {parsed.code !== null && (
                                <span className="border-b border-gray-200 px-1 py-0.5 text-[10px] text-gray-600">
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
                                <pre className="mt-2 overflow-x-auto border-y border-[#E7E7E7] bg-[#FAFAFA] px-3 py-3 text-[11px] leading-5 text-gray-600 whitespace-pre-wrap break-all">
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
                                  className="inline-flex items-center border-b border-[#F3D2BF] px-1 py-1 text-[11px] font-bold text-[#C9571A]"
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
                              className="inline-flex items-center border-b border-gray-300 px-1 py-1 text-[10px] font-bold text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="overflow-hidden border-y border-[#F3D2BF]">
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
                <div className="border-y border-[#E7E7E7] bg-[#FAFAFA] px-3 py-3 text-[13px] text-gray-500">
                  최근 24시간 기준 자동 환불된 생성 실패가 없어요.
                </div>
              )}
            </div>
          </div>

          {/* 긴급 대응 · 스타일 운영 */}
          <div id="style-ops" className="flex flex-col gap-1">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">긴급 대응 · 스타일 운영</p>
            <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900">카드별 즉시 숨김 / 생성 중지</p>
                  <p className="text-[12px] text-gray-500 mt-1">저장 즉시 반영</p>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  일반 {cardStyleControls.length} · 실험실 {specialFeatureControls.length}
                </span>
              </div>

              {styleControlMsg && (
                <div className={`border-y px-3 py-2 text-[12px] ${
                  styleControlMsg.ok
                    ? "text-[#C9571A] bg-[#FFF7F2] border-[#F3D2BF]"
                    : "text-red-600 bg-red-50 border-red-200"
                }`}>
                  {styleControlMsg.text}
                </div>
              )}

              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setStyleOpsView("cards")}
                  className={`py-3 text-[13px] font-bold transition-colors ${
                    styleOpsView === "cards" ? "text-[#C9571A]" : "text-gray-500"
                  }`}
                >
                  일반 카드 {cardStyleControls.length}
                </button>
                <button
                  type="button"
                  onClick={() => setStyleOpsView("lab")}
                  className={`py-3 text-[13px] font-bold transition-colors ${
                    styleOpsView === "lab" ? "text-[#C9571A]" : "text-gray-500"
                  }`}
                >
                  실험실/기능 {specialFeatureControls.length}
                </button>
              </div>

              {styleOpsView === "lab" ? (
                <div className="overflow-hidden border-y border-[#E7E7E7]">
                  {specialFeatureControls.length > 0 ? (
                    specialFeatureControls.map(({ title, control }) => {
                      const isSaving = styleSavingId === control.style_id;
                      const isMagazineControl = control.style_id === MAGAZINE_CONTROL_ID;
                      const activeText = isMagazineControl ? "매거진 경로 공개" : "실험실 진입 가능";
                      const inactiveText = isMagazineControl ? "현재 숨김 또는 차단" : "현재 숨김 또는 중지";
                      const enabledText = isMagazineControl ? "접속" : "생성";
                      const disabledText = isMagazineControl ? "차단" : "중지";
                      return (
                        <div key={control.style_id} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-gray-900 truncate">{title}</p>
                            <p className="text-[11px] text-gray-500">
                              {control.is_visible && control.is_enabled ? activeText : inactiveText}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateStyleControl(control.style_id, { is_visible: !control.is_visible })}
                              disabled={isSaving}
                              className={`h-8 border-b px-2 text-[12px] font-bold transition-colors ${
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
                              className={`h-8 border-b px-2 text-[12px] font-bold transition-colors ${
                                control.is_enabled
                                  ? "bg-[#FFF4ED] text-[#C9571A] border border-[#F3D2BF]"
                                  : "bg-white text-gray-600 border border-gray-300"
                              } disabled:opacity-50`}
                            >
                              {control.is_enabled ? enabledText : disabledText}
                            </button>
                          </div>
                          <div className="w-10 text-right">
                            {isSaving && <span className="text-[10px] text-gray-400">저장</span>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="px-3 py-4 text-[13px] text-gray-500">실험실 운영 항목이 아직 없어요.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden border-y border-[#E7E7E7]">
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
                            className={`h-8 border-b px-2 text-[12px] font-bold transition-colors ${
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
                            className={`h-8 border-b px-2 text-[12px] font-bold transition-colors ${
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
              )}
            </div>
          </div>

          {/* 자동 하이라이트 */}
          <div className="flex flex-col gap-1">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">자동 하이라이트 (24시간)</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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

              <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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

              <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
        </div>
      )}

      {activeTab === "metrics" && (
        <div className="flex flex-col gap-3">
          {/* 상단 3개 섹션 한 줄 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 [&>*]:min-w-0">
            {/* 핵심 지표 + 로그인/게스트 통합 */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">핵심 지표</p>
              <div className="flex flex-col gap-0">
                <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                  <span className="text-gray-500 text-[12px]">가입 유저</span>
                  <span className="text-gray-900 font-bold text-[13px]">{stats.totalUsers}명</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                  <span className="text-gray-500 text-[12px]">변환 유저</span>
                  <span className="text-gray-900 font-bold text-[13px]">{stats.uniqueLoggedInUsers}명</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                  <span className="text-gray-500 text-[12px]">결제 유저</span>
                  <span className="text-[#C9571A] font-bold text-[13px]">{stats.totalPaidUsers}명</span>
                </div>
                <div className="flex flex-col gap-1.5 pt-3">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>로그인 {stats.userCount}회 · {stats.userRatio}%</span>
                    <span>게스트 {stats.guestCount}회 · {stats.guestRatio}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full bg-[#C9571A]" style={{ width: `${stats.userRatio}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 유료 상품 현황 */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">유료 상품</p>
              <div className="flex flex-col gap-0 text-[12px]">
                {stats.labExperiments.slice(0, 3).map((item) => (
                  <div key={item.key} className="flex justify-between items-center py-2 border-b border-[#F3F4F6] last:border-0">
                    <span className="text-gray-700 truncate flex-1">{item.label}</span>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className="text-gray-400">참여 {item.totalParticipants}</span>
                      <span className="text-[#C9571A] font-bold">결제 {item.paidParticipants}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 공유 & 바이럴 */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">공유 & 바이럴</p>
              <div className="flex flex-col gap-0 text-[12px]">
                <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                  <span className="text-gray-500">카카오 공유</span>
                  <span className="text-gray-900 font-bold">{stats.shareKakao}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                  <span className="text-gray-500">링크 복사</span>
                  <span className="text-gray-900 font-bold">{stats.shareLinkCopy}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-500">공유율</span>
                  <span className="text-[#C9571A] font-bold">{shareRatio}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 스타일별 성과 */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">스타일별 성과</p>
            {sortedStylePerformance.length === 0 ? (
              <p className="text-gray-400 text-[13px]">데이터 없음</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {sortedStylePerformance.map((s) => {
                  const isProblem = issueIds.has(s.style_id);
                  const isHighShare = highShareSet.has(s.style_id);
                  const isLowSave = lowSaveSet.has(s.style_id);
                  return (
                    <div key={s.style_id} className="flex flex-col gap-1 p-2.5 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA]">
                      <span className="text-gray-900 text-[12px] font-bold truncate">{s.style_name}</span>
                      <span className="text-gray-600 text-[13px] font-bold">{s.count}회</span>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {isProblem && <span className="text-[9px] text-red-400">문제</span>}
                        {isHighShare && <span className="text-[9px] text-[#C9571A]">공유강세</span>}
                        {isLowSave && <span className="text-[9px] text-gray-400">저장약세</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          {/* API 비용 & 손익 */}
          <MonthlyCostSection monthlyCosts={stats.monthlyCosts ?? {}} />

          {/* 구매자 수 기반 시뮬레이터 */}
          <ProfitCalculator />

          <ApiUsageBreakdownSection stats={stats} />

          {/* 결제 현황 */}
          <Section title="결제 현황">
            <Row label="누적 매출" value={`${stats.totalRevenue.toLocaleString()}원`} highlight />
            <Row label="오늘 매출" value={`${stats.todayRevenue.toLocaleString()}원`} />
            <Row label="결제 건수" value={`${stats.totalPaymentCount}건`} />
            <Row label="현재 패키지" value={`${PAYMENT_PACKAGES.basic.credits}/${PAYMENT_PACKAGES.plus.credits}/${PAYMENT_PACKAGES.pro.credits} 크레딧`} />
            <Row label="보수 원가" value={`${CONSERVATIVE_CREDIT_COST_KRW}원/크레딧`} />
          </Section>

          {/* 원가 기준 메모 */}
          <CostFactSection />

          {/* 결제 목록 & 원클릭 환불 */}
          {stats.paymentList.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">결제 목록 & 환불</p>
              <div className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white px-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
                          className="flex-shrink-0 border-b border-gray-300 px-1 py-1.5 text-[12px] text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:opacity-40"
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
        </div>
      )}

      {activeTab === "users" && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          {/* 크레딧 조정 */}
          <div className="flex flex-col gap-1">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">크레딧 조정</p>
            <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
                  className="w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-[14px] font-bold text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#F06B35] focus:outline-none"
                />
                {showUserDropdown && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-[#E5E7EB] bg-white shadow-md">
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
                          className={`w-full px-3 py-2 text-left text-[14px] font-bold transition-colors hover:bg-gray-50 ${
                            creditUserId === u.id ? "text-[#C9571A]" : "text-[#374151]"
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
                    className={`flex-1 rounded-md border py-2 text-[13px] font-black transition-colors ${creditAmount === String(n) ? "border-[#F06B35] bg-[#FFF7F2] text-[#C9571A]" : "border-[#D1D5DB] bg-white text-[#4B5563] hover:text-[#111827]"}`}
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
                className="w-full rounded-md bg-[#273142] py-3 text-[14px] font-black text-white transition-colors hover:bg-[#1F2937]"
              >
                크레딧 추가
              </button>
              {creditMsg && <p className={`text-[13px] text-center ${creditMsg.startsWith("✓") ? "text-[#C9571A]" : "text-red-500"}`}>{creditMsg}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">가입 유저 목록</p>
            <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={userListSearch}
                  onChange={(e) => setUserListSearch(e.target.value)}
                  placeholder="닉네임 또는 ID 검색..."
                  className="flex-1 rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-[14px] font-bold text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#F06B35] focus:outline-none"
                />
                <span className="whitespace-nowrap text-[11px] font-bold text-[#6B7280]">최근 활동순</span>
              </div>

              <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
                {filteredUsers.length === 0 ? (
                  <div className="px-3 py-4 text-[13px] text-gray-500">검색 결과 없음</div>
                ) : (
                  filteredUsers.slice(0, 100).map((user) => (
                    <div key={user.id} className="flex items-start justify-between gap-3 border-b border-gray-100 px-3 py-3 last:border-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="truncate text-[14px] font-black text-[#111827]">{user.nickname ?? "닉네임 없음"}</p>
                          <button
                            type="button"
                            onClick={() => toggleUserIdVisibility(user.id)}
                            className="flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-700"
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
                        <p className="text-[11px] font-bold text-[#6B7280]">가입 {formatDateTime(user.created_at)}</p>
                        <p className="mt-0.5 text-[11px] font-bold text-[#9CA3AF]">
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

        </div>
      )}

      {activeTab === "analytics" && (
        <div className="flex flex-col gap-3">
          {(() => {
            const styleStats: Record<string, number> = {};
            let successCount = 0;
            let failCount = 0;

            analyticsData.forEach(item => {
              styleStats[item.style_name] = (styleStats[item.style_name] || 0) + 1;
              if (item.success) successCount++;
              else failCount++;
            });

            const totalCount = analyticsData.length;
            const sortedStyles = Object.entries(styleStats)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10);
            const maxCount = sortedStyles.length > 0 ? sortedStyles[0][1] : 0;

            return (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 [&>*]:min-w-0">
                {/* 요약 통계 */}
                <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">7일 요약</p>
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-gray-400">총 생성</span>
                      <span className="text-[20px] font-bold text-gray-900">{totalCount}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-gray-400">성공</span>
                      <span className="text-[20px] font-bold text-[#18794E]">{successCount} <span className="text-[12px] text-gray-400 font-normal">{totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0}%</span></span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-gray-400">실패</span>
                      <span className="text-[20px] font-bold text-red-500">{failCount} <span className="text-[12px] text-gray-400 font-normal">{totalCount > 0 ? Math.round((failCount / totalCount) * 100) : 0}%</span></span>
                    </div>
                  </div>
                </div>

                {/* 7일 카드 인기순위 */}
                <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">인기순위</p>
                  {sortedStyles.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {sortedStyles.map(([name, count], idx) => (
                        <div key={name} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#C9571A] w-4 text-center">{idx + 1}</span>
                          <span className="text-[12px] text-gray-700 w-32 truncate">{name}</span>
                          <div className="flex-1 bg-[#F3F4F6] h-4 rounded-sm overflow-hidden">
                            <div className="h-full bg-[#C9571A] transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-[12px] font-bold text-gray-700 w-6 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-400">데이터 없음</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 생성 기록 테이블 */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">생성 기록</p>
              {deleteCountdown && (
                <span className="text-[11px] text-orange-500 font-mono">
                  삭제까지 {deleteCountdown.days}일 {deleteCountdown.hours.toString().padStart(2, "0")}:{deleteCountdown.minutes.toString().padStart(2, "0")}:{deleteCountdown.seconds.toString().padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="사용자명 검색..."
                value={analyticsSearchUser}
                onChange={(e) => handleAnalyticsSearch(e.target.value)}
                className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[13px] focus:outline-none focus:border-[#C9571A]"
              />
              <button
                onClick={downloadAnalyticsCSV}
                disabled={analyticsLoading}
                className="rounded-lg border border-[#C9571A] text-[#C9571A] hover:bg-[#FFF5F0] disabled:border-gray-200 disabled:text-gray-300 px-3 py-2 text-[12px] font-bold transition-colors"
              >
                CSV
              </button>
              {analyticsLoading && <span className="text-[12px] text-gray-400">로딩 중...</span>}
            </div>

            {analyticsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F3F4F6] text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                      <th className="text-left py-2 px-1">시간</th>
                      <th className="text-left py-2 px-1">사용자</th>
                      <th className="text-left py-2 px-1">카드</th>
                      <th className="text-center py-2 px-1">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.map((item) => (
                      <tr key={item.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]">
                        <td className="py-2 px-1 text-[11px] text-gray-400">
                          {new Date(item.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-1 text-[12px] text-gray-900 font-medium">{item.nickname || "Unknown"}</td>
                        <td className="py-2 px-1 text-[12px] text-gray-600 max-w-[180px] truncate">{item.style_name}</td>
                        <td className="py-2 px-1 text-center">
                          {item.success ? (
                            <span className="text-[#18794E] font-bold text-[13px]">✓</span>
                          ) : (
                            <span className="text-red-500 font-bold text-[13px]">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-[13px] text-gray-400">
                {analyticsLoading ? "데이터를 불러오는 중..." : "최근 7일 생성 기록이 없습니다."}
              </div>
            )}
            <p className="text-[11px] text-gray-300">최근 7일 · 최대 50개</p>
          </div>
        </div>
      )}
      </div>
      </div>
      </div>
    </main>
  );
}
