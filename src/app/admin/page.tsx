"use client";

import { useState, useEffect, useRef } from "react";
import { STYLE_VARIANTS } from "@/lib/variants";

type Notice = { id: number; text: string; active: boolean };
type UserItem = { id: string; nickname: string | null };
type PaymentItem = { id: string; user_id: string; amount: number; credits: number; status: string; created_at: string };
type StyleStat = { style_id: string; style_name: string; count: number };
type Stats = {
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
  uniqueLoggedInUsers: number;
  shareKakao: number;
  shareLinkCopy: number;
  transformEvents: number;
  auditionShareKakao: number;
  auditionShareLinkCopy: number;
  totalRevenue: number;
  totalPaymentCount: number;
  todayRevenue: number;
  monthlyCosts: Record<string, {
    styleCount: number;
    auditionCount: number;
    apiCost: number;
    revenue: number;
  }>;
};

function Row({ label, value, note, highlight }: { label: string; value: string | number; note?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-[#888] text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {note && <span className="text-[#555] text-xs">{note}</span>}
        <span className={`text-base font-bold tabular-nums ${highlight ? "text-[#C9571A]" : "text-white"}`}>{value}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">{title}</p>
      <div className="bg-[#111] rounded-2xl px-4 border border-white/5">
        {children}
      </div>
    </div>
  );
}

function Bar({ ratio, color = "#C9571A" }: { ratio: number; color?: string }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-1 mt-1">
      <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${ratio}%`, backgroundColor: color }} />
    </div>
  );
}

function MiniCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
      <span className="text-[#555] text-[11px]">{label}</span>
      <span className={`text-[18px] font-extrabold tabular-nums leading-tight ${accent ? "text-[#C9571A]" : "text-white"}`}>{value}</span>
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
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
  const [showUserDropdown, setShowUserDropdown] = useState(false);

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

  if (!stats) {
    return (
      <main className="w-full max-w-sm mx-auto px-4 py-20 flex flex-col gap-6 bg-[#0A0A0A] min-h-screen">
        <h1 className="text-2xl font-extrabold text-white">Admin</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#C9571A] transition-colors"
            autoFocus
          />
          {error && <p className="text-[#C9571A] text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] disabled:text-white/30 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {isLoading ? "확인 중..." : "확인"}
          </button>
        </form>
      </main>
    );
  }

  const shareTotal = stats.shareKakao + stats.shareLinkCopy;
  const shareRatio = stats.total > 0 ? Math.round((shareTotal / stats.total) * 100) : 0;

  return (
    <main className="w-full max-w-sm mx-auto px-4 py-10 flex flex-col gap-6 bg-[#0A0A0A] min-h-screen">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-white">Admin</h1>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-[10px] text-[#333] font-mono tabular-nums">
              {fetchedAt.toTimeString().slice(0, 8)} +{elapsed}s
            </span>
          )}
          <button
            onClick={() => { setStats(null); setPassword(""); localStorage.removeItem("sd_admin_pw"); if (timerRef.current) clearInterval(timerRef.current); }}
            className="text-xs text-[#444] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 공지 관리 */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">공지 관리 (터미널)</p>
        <div className="bg-[#111] rounded-2xl px-4 py-4 border border-white/5 flex flex-col gap-3">
          {notices.map((n, i) => (
            <div key={i} className="flex items-start gap-2">
              <button
                onClick={() => setNotices(prev => prev.map((x, j) => j === i ? { ...x, active: !x.active } : x))}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors ${n.active ? "bg-[#C9571A] border-[#C9571A]" : "bg-transparent border-white/20"}`}
              >
                {n.active && <svg viewBox="0 0 10 8" fill="none" className="w-full h-full p-0.5"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <input
                value={n.text}
                onChange={e => setNotices(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                className="flex-1 bg-[#0D0D0D] border border-white/10 rounded-lg px-3 py-2 text-white text-[13px] font-mono focus:outline-none focus:border-[#C9571A]/50 transition-colors"
              />
              <button
                onClick={() => setNotices(prev => prev.filter((_, j) => j !== i))}
                className="mt-1 text-[#444] hover:text-[#ff5f57] transition-colors text-lg leading-none"
              >×</button>
            </div>
          ))}
          <button
            onClick={() => setNotices(prev => [...prev, { id: Date.now(), text: "", active: true }])}
            className="text-[12px] text-[#555] hover:text-white transition-colors text-left font-mono"
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
            className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] text-white font-bold py-2.5 rounded-xl transition-colors text-[13px]"
          >
            {noticesSaving ? "저장 중..." : noticesSaved ? "✓ 저장됨" : "저장하기"}
          </button>
        </div>
      </div>

      {/* 사용 현황 */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">사용 현황</p>
        <div className="grid grid-cols-2 gap-2">
          <MiniCard label="누적 변환" value={`${stats.total}회`} accent />
          <MiniCard label="오늘 변환" value={`${stats.todayTotal}회`} />
          <MiniCard label="가입 유저 (전체)" value={`${stats.totalUsers}명`} />
          <MiniCard label="변환한 유저 (고유)" value={`${stats.uniqueLoggedInUsers}명`} />
        </div>
      </div>

      {/* 로그인 vs 게스트 */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">로그인 vs 게스트</p>
        <p className="text-[10px] text-[#444] px-1 mb-1">변환 횟수 기준 — 1명이 여러 번 변환하면 중복 집계됨</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[11px]">로그인 변환</span>
            <span className="text-white text-[18px] font-extrabold tabular-nums">{stats.userCount}회</span>
            <span className="text-[#C9571A] text-[13px] font-bold">{stats.userRatio}%</span>
            <Bar ratio={stats.userRatio} />
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[11px]">게스트 변환</span>
            <span className="text-white text-[18px] font-extrabold tabular-nums">{stats.guestCount}회</span>
            <span className="text-[#555] text-[13px] font-bold">{stats.guestRatio}%</span>
            <Bar ratio={stats.guestRatio} color="#555" />
          </div>
        </div>
      </div>

      {/* 공유 & 바이럴 — 스타일 */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">공유 & 바이럴 · 스타일</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[10px]">카카오 공유</span>
            <span className="text-white text-[16px] font-extrabold tabular-nums">{stats.shareKakao}회</span>
            <span className="text-[#555] text-[11px]">{stats.total > 0 ? Math.round((stats.shareKakao / stats.total) * 100) : 0}%</span>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[10px]">링크 복사</span>
            <span className="text-white text-[16px] font-extrabold tabular-nums">{stats.shareLinkCopy}회</span>
            <span className="text-[#555] text-[11px]">{stats.total > 0 ? Math.round((stats.shareLinkCopy / stats.total) * 100) : 0}%</span>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[10px]">공유 전환율</span>
            <span className="text-[#C9571A] text-[16px] font-extrabold tabular-nums">{shareRatio}%</span>
            <span className="text-[#555] text-[11px]">{shareTotal}회</span>
          </div>
        </div>
      </div>

      {/* 공유 & 바이럴 — 실험실 (AI 오디션) */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">공유 & 바이럴 · 실험실</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[10px]">카카오 공유</span>
            <span className="text-white text-[16px] font-extrabold tabular-nums">{stats.auditionShareKakao}회</span>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[10px]">링크 복사</span>
            <span className="text-white text-[16px] font-extrabold tabular-nums">{stats.auditionShareLinkCopy}회</span>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[#555] text-[10px]">합계</span>
            <span className="text-[#C9571A] text-[16px] font-extrabold tabular-nums">{stats.auditionShareKakao + stats.auditionShareLinkCopy}회</span>
          </div>
        </div>
      </div>

      {/* API 비용 & 손익 */}
      {(() => {
        const months = [
          { key: "2026-03", label: "3월", note: "실측" },
          { key: "2026-04", label: "4월", note: "추정" },
        ];
        const [activeMonth, setActiveMonth] = useState("2026-04");
        const m = stats.monthlyCosts?.[activeMonth];
        const profit = m ? m.revenue - m.apiCost : 0;
        return (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1">API 비용 & 손익</p>
            <div className="flex gap-2">
              {months.map(({ key, label, note }) => (
                <button
                  key={key}
                  onClick={() => setActiveMonth(key)}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors border ${
                    activeMonth === key
                      ? "bg-[#C9571A] border-[#C9571A] text-white"
                      : "bg-white/[0.04] border-white/10 text-[#555]"
                  }`}
                >
                  {label} <span className="text-[10px] font-normal opacity-60">{note}</span>
                </button>
              ))}
            </div>
            {m && (
              <div className="bg-[#111] border border-white/5 rounded-2xl px-4 py-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[#555] text-[10px]">스타일 변환</span>
                    <span className="text-white text-[16px] font-extrabold tabular-nums">{m.styleCount}건</span>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[#555] text-[10px]">AI 오디션</span>
                    <span className="text-white text-[16px] font-extrabold tabular-nums">{m.auditionCount}건</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[#555] text-[10px]">매출</span>
                    <span className="text-white text-[15px] font-extrabold tabular-nums">₩{m.revenue.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[#555] text-[10px]">API 비용</span>
                    <span className="text-red-400 text-[15px] font-extrabold tabular-nums">-₩{m.apiCost.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[#555] text-[10px]">손익</span>
                    <span className={`text-[15px] font-extrabold tabular-nums ${profit >= 0 ? "text-[#4ade80]" : "text-red-400"}`}>
                      {profit >= 0 ? "+" : ""}₩{profit.toLocaleString()}
                    </span>
                  </div>
                </div>
                {activeMonth === "2026-04" && (
                  <p className="text-[10px] text-[#444] px-1">* API 비용은 건당 단가 기준 추정값 (스타일 ₩117 · 오디션 ₩468)</p>
                )}
                {activeMonth === "2026-03" && (
                  <p className="text-[10px] text-[#444] px-1">* API 비용은 Google Cloud 청구서 실측값 (3/25~31, 세전)</p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 결제 현황 */}
      <Section title="결제 현황">
        <Row label="누적 매출" value={`${stats.totalRevenue.toLocaleString()}원`} highlight />
        <Row label="오늘 매출" value={`${stats.todayRevenue.toLocaleString()}원`} />
        <Row label="결제 건수" value={`${stats.totalPaymentCount}건`} />
      </Section>

      {/* 결제 목록 & 원클릭 환불 */}
      {stats.paymentList.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">결제 목록 & 환불</p>
          <div className="bg-[#111] rounded-2xl px-4 border border-white/5 flex flex-col">
            {stats.paymentList.slice(0, 20).map((p) => {
              const user = stats.userList.find(u => u.id === p.user_id);
              const date = new Date(p.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
              const isRefunded = p.status === "refunded";
              const isLoading = refundingId === p.id;
              const msg = refundMsg?.id === p.id ? refundMsg : null;
              return (
                <div key={p.id} className="py-3 border-b border-white/5 last:border-0 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white text-[13px] font-bold truncate">{user?.nickname ?? p.user_id.slice(0, 8)}</span>
                    <span className="text-[#555] text-[11px] font-mono">{p.amount.toLocaleString()}원 · {p.credits}크레딧 · {date}</span>
                    {msg && <span className={`text-[11px] ${msg.ok ? "text-[#C9571A]" : "text-red-400"}`}>{msg.msg}</span>}
                  </div>
                  {isRefunded ? (
                    <span className="text-[11px] text-[#444] flex-shrink-0">환불됨</span>
                  ) : (
                    <button
                      onClick={async () => {
                        setRefundingId(p.id);
                        setRefundMsg(null);
                        // Step 1: dryRun 미리보기
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
                        // Step 2: 실제 환불 처리
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
                            ? `✓ ${data.refundedAmount.toLocaleString()}원 환불 완료${data.wasPartial ? ` (${data.usedCredits}회 사용분 공제)` : ''}`
                            : `오류: ${data.error}`,
                        });
                        if (data.ok) p.status = "refunded";
                      }}
                      disabled={isLoading}
                      className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-[#888] hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
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

      {/* API 비용 & 손익 */}
      {(() => {
        // 3월 GCP 실청구 역산 기준
        const marBilling = 17944;       // 3월 실청구액 (원)
        const marEstCalls = 320;        // 역산 총 호출 (로그 前 포함)
        const costPerCall = Math.round(marBilling / marEstCalls); // 약 56원/회
        const totalCost = stats.total * costPerCall;
        const profit = stats.totalRevenue - totalCost;
        const profitRatio = stats.totalRevenue > 0 ? Math.round((profit / stats.totalRevenue) * 100) : 0;
        const breakEvenCalls = costPerCall > 0 ? Math.ceil(stats.totalRevenue / costPerCall) : 0;
        return (
          <Section title="API 비용 & 손익">
            <Row label="3월 GCP 실청구액" value={`${marBilling.toLocaleString()}원`} note="VAT 포함" />
            <Row label="역산 총 호출 (3월)" value={`약 ${marEstCalls}회`} note="로그 前 테스트 포함" />
            <Row label="1회당 실측 비용" value={`약 ${costPerCall}원`} note={`₩${marBilling.toLocaleString()} ÷ ${marEstCalls}회`} highlight />
            <Row label="로그 기록 호출 (누적)" value={`${stats.total.toLocaleString()}회`} />
            <Row label="누적 API 지출 (추정)" value={`${totalCost.toLocaleString()}원`} note={`${stats.total}회 × ${costPerCall}원`} />
            <Row label="총 결제 수익" value={`${stats.totalRevenue.toLocaleString()}원`} />
            <div className="py-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[#888] text-sm">순이익</span>
                <span className={`font-bold text-base tabular-nums ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {profit >= 0 ? "+" : ""}{profit.toLocaleString()}원
                  <span className="text-xs font-normal ml-1 opacity-60">({profitRatio}%)</span>
                </span>
              </div>
            </div>
            <Row
              label="손익분기 누적 변환"
              value={`${breakEvenCalls.toLocaleString()}회`}
              note={stats.total >= breakEvenCalls ? "달성 ✓" : `${(breakEvenCalls - stats.total).toLocaleString()}회 남음`}
            />
          </Section>
        );
      })()}

      {/* 크레딧 조정 */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest px-1 mb-1">크레딧 조정</p>
        <div className="bg-[#111] rounded-2xl px-4 py-4 border border-white/5 flex flex-col gap-3">
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
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-lg px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#C9571A]/50 transition-colors"
            />
            {showUserDropdown && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#0D0D0D] border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                {stats.userList
                  .filter(u => {
                    if (!creditSearch) return true;
                    const q = creditSearch.toLowerCase();
                    return (u.nickname?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
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
                      className={`w-full text-left px-3 py-2 text-[13px] hover:bg-white/5 transition-colors ${
                        creditUserId === u.id ? "text-[#C9571A]" : "text-white/70"
                      }`}
                    >
                      {u.nickname ?? u.id.slice(0, 8)} — {u.id.slice(0, 12)}...
                    </button>
                  ))}
                {stats.userList.filter(u => {
                  if (!creditSearch) return true;
                  const q = creditSearch.toLowerCase();
                  return (u.nickname?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
                }).length === 0 && (
                  <p className="px-3 py-2 text-[12px] text-[#555]">검색 결과 없음</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {[0, 1, 3, 5, 10, 30].map(n => (
              <button
                key={n}
                onClick={() => setCreditAmount(String(n))}
                className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors ${creditAmount === String(n) ? "bg-[#C9571A] text-white" : "bg-[#1A1A1A] text-[#666] hover:text-white"}`}
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
              setCreditMsg(data.ok ? `✓ ${stats.userList.find(u=>u.id===creditUserId)?.nickname ?? creditUserId.slice(0,8)} → ${creditAmount}크레딧 설정됨` : `오류: ${data.error}`);
              setTimeout(() => setCreditMsg(""), 3000);
            }}
            className="w-full bg-[#1A1A1A] hover:bg-[#222] border border-white/10 text-white font-bold py-2.5 rounded-xl transition-colors text-[13px]"
          >
            크레딧 설정
          </button>
          {creditMsg && <p className={`text-[12px] text-center ${creditMsg.startsWith("✓") ? "text-[#C9571A]" : "text-red-400"}`}>{creditMsg}</p>}
        </div>
      </div>

      {/* 스타일별 */}
      <Section title="스타일별 사용">
        {stats.byStyle.length === 0 ? (
          <p className="text-[#444] text-sm py-4">데이터 없음</p>
        ) : (
          stats.byStyle.map((s) => {
            const ratio = stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0;
            const variants = STYLE_VARIANTS[s.style_id];
            return (
              <div key={s.style_id} className="py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-white/90 text-[15px] font-bold">{s.style_name}</span>
                  <span className="text-white font-bold">{s.count}회 <span className="text-[#555] font-normal text-xs">{ratio}%</span></span>
                </div>
                <Bar ratio={ratio} />
                {variants && variants.length > 1 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {variants.map(v => {
                      const cnt = stats.byStyleVariants?.[s.style_id]?.[v.id] ?? 0;
                      return (
                        <span key={v.id} className="text-[10px] text-[#555] bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
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

    </main>
  );
}
