"use client";

import { useState, useEffect, useRef } from "react";
import { AUDITION_CONTROL_ID, type StyleControlState } from "@/lib/style-controls";
import { STYLE_VARIANTS } from "@/lib/variants";

const ADMIN_UI_VERSION = "v2.7.0-audition-ops";

type AdminTab = "ops" | "metrics" | "revenue" | "users";

type Notice = { id: number; text: string; active: boolean };
type UserItem = {
  id: string;
  nickname: string | null;
  created_at: string | null;
  last_login_at: string | null;
};
type PaymentItem = { id: string; user_id: string; amount: number; credits: number; status: string; created_at: string };
type StyleStat = { style_id: string; style_name: string; count: number };
type GenerationErrorSummary = {
  style_id: string;
  style_name: string;
  errorCount: number;
  successCount24h: number;
  errorRate: number;
  topErrorType: string;
  lastErrorAt: string;
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
};
type Stats = {
  styleControls: StyleControlState[];
  generationErrorTotal24h: number;
  generationErrorSummary: GenerationErrorSummary[];
  recentGenerationErrors: RecentGenerationError[];
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
  const cardStyleControls = styleControls.filter((row) => row.style_id !== AUDITION_CONTROL_ID);
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
  const sortedStylePerformance = [...stats.stylePerformanceList].sort((a, b) => {
    const aIssue = Number(issueIds.has(a.style_id));
    const bIssue = Number(issueIds.has(b.style_id));
    if (bIssue !== aIssue) return bIssue - aIssue;
    return b.count - a.count;
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
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">오류 모니터링</p>
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-200 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <MiniCard label="최근 24시간 오류" value={`${stats.generationErrorTotal24h}건`} accent={stats.generationErrorTotal24h > 0} />
                <MiniCard label="문제 카드" value={`${stats.generationErrorSummary.length}개`} accent={stats.generationErrorSummary.length > 0} />
              </div>

              {stats.generationErrorSummary.length > 0 ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {stats.generationErrorSummary.slice(0, 6).map((item) => (
                    <div key={item.style_id} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-gray-900 truncate">{item.style_name}</p>
                        <p className="text-[11px] text-gray-500">
                          오류 {item.errorCount} · 성공 {item.successCount24h} · 오류율 {item.errorRate}% · {item.topErrorType}
                        </p>
                      </div>
                      <span className="text-[11px] text-red-600 font-bold whitespace-nowrap">{relativeTime(item.lastErrorAt)}</span>
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
                  {stats.recentGenerationErrors.slice(0, 5).map((item) => (
                    <div key={item.id} className="px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-gray-900 truncate">{item.style_name}</span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">{relativeTime(item.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {item.error_type}{item.finish_reason ? ` · ${item.finish_reason}` : ""}{item.message ? ` · ${item.message}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 긴급 대응 · 스타일 운영 */}
          <div className="flex flex-col gap-1">
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

              {auditionControl && (
                <div className="rounded-xl border border-[#F3D2BF] bg-[#FFF7F2] px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900">AI 오디션</p>
                      <p className="text-[11px] text-gray-500">
                        {auditionControl.is_visible && auditionControl.is_enabled ? "실험실 진입 가능" : "현재 숨김 또는 중지"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateStyleControl(auditionControl.style_id, { is_visible: !auditionControl.is_visible })}
                        disabled={styleSavingId === auditionControl.style_id}
                        className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${
                          auditionControl.is_visible
                            ? "bg-gray-900 text-white"
                            : "bg-white text-gray-600 border border-gray-300"
                        } disabled:opacity-50`}
                      >
                        {auditionControl.is_visible ? "노출" : "숨김"}
                      </button>
                      <button
                        onClick={() => updateStyleControl(auditionControl.style_id, { is_enabled: !auditionControl.is_enabled })}
                        disabled={styleSavingId === auditionControl.style_id}
                        className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${
                          auditionControl.is_enabled
                            ? "bg-[#FFF4ED] text-[#C9571A] border border-[#F3D2BF]"
                            : "bg-white text-gray-600 border border-gray-300"
                        } disabled:opacity-50`}
                      >
                        {auditionControl.is_enabled ? "생성" : "중지"}
                      </button>
                    </div>
                    <div className="w-10 text-right">
                      {styleSavingId === auditionControl.style_id && <span className="text-[10px] text-gray-400">저장</span>}
                    </div>
                  </div>
                </div>
              )}

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

          {/* 결제 목록 & 원클릭 환불 */}
          {stats.paymentList.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-1">결제 목록 & 환불</p>
              <div className="bg-white rounded-2xl px-4 border border-gray-200 flex flex-col">
                {stats.paymentList.slice(0, 20).map((p) => {
                  const user = stats.userList.find(u => u.id === p.user_id);
                  const date = new Date(p.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
                  const isRefunded = p.status === "refunded";
                  const isLoading = refundingId === p.id;
                  const msg = refundMsg?.id === p.id ? refundMsg : null;
                  return (
                    <div key={p.id} className="py-3 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-gray-900 text-[14px] font-bold truncate">{user?.nickname ?? p.user_id.slice(0, 8)}</span>
                        <span className="text-gray-500 text-[12px] font-mono">{p.amount.toLocaleString()}원 · {p.credits}크레딧 · {date}</span>
                        {msg && <span className={`text-[12px] ${msg.ok ? "text-[#C9571A]" : "text-red-500"}`}>{msg.msg}</span>}
                      </div>
                      {isRefunded ? (
                        <span className="text-[12px] text-gray-400 flex-shrink-0">환불됨</span>
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
                              setRefundMsg({ id: p.id, ok: false, msg: `사용분 공제(${preview.usedCredits}회×190원) 후 환불 가능 금액 없음` });
                              return;
                            }
                            const confirmMsg = preview.wasPartial
                              ? `${user?.nickname ?? "유저"} · 부분환불 ${preview.refundAmount.toLocaleString()}원\n(사용 ${preview.usedCredits}회 × 190원 = ${(preview.usedCredits * 190).toLocaleString()}원 공제)\n\n진행하시겠어요?`
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
                  setCreditMsg(data.ok ? `✓ ${stats.userList.find(u => u.id === creditUserId)?.nickname ?? creditUserId.slice(0, 8)} → ${creditAmount}크레딧 설정됨` : `오류: ${data.error}`);
                  setTimeout(() => setCreditMsg(""), 3000);
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900 font-bold py-2.5 rounded-xl transition-colors text-[14px]"
              >
                크레딧 설정
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
                <span className="text-[11px] text-gray-400 whitespace-nowrap">최근 가입순</span>
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
                          최근 로그인 {user.last_login_at ? relativeTime(user.last_login_at) : "—"}
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
