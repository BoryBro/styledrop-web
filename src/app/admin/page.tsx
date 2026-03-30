"use client";

import { useState, useEffect, useRef } from "react";

type StyleStat = { style_id: string; style_name: string; count: number };
type Stats = {
  total: number;
  todayTotal: number;
  guestCount: number;
  userCount: number;
  guestRatio: number;
  userRatio: number;
  byStyle: StyleStat[];
  totalUsers: number;
  shareKakao: number;
  shareLinkCopy: number;
  revisit: number;
  transformEvents: number;
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

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "오류가 발생했습니다.");
      else {
        setStats(data);
        const now = new Date();
        setFetchedAt(now);
        setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
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
            onClick={() => { setStats(null); setPassword(""); if (timerRef.current) clearInterval(timerRef.current); }}
            className="text-xs text-[#444] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 사용 현황 */}
      <Section title="사용 현황">
        <Row label="누적 변환" value={`${stats.total}회`} highlight />
        <Row label="오늘 변환" value={`${stats.todayTotal}회`} />
        <Row label="가입 유저" value={`${stats.totalUsers}명`} />
        <Row label="재방문" value={`${stats.revisit}회`} />
      </Section>

      {/* 회원 vs 비회원 */}
      <Section title="로그인 vs 게스트 (변환 횟수 기준)">
        <div className="py-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[#888] text-sm">로그인 유저</span>
            <span className="text-white font-bold">{stats.userCount}회 <span className="text-[#C9571A]">{stats.userRatio}%</span></span>
          </div>
          <Bar ratio={stats.userRatio} />
        </div>
        <div className="py-3">
          <div className="flex items-center justify-between">
            <span className="text-[#888] text-sm">비로그인 게스트</span>
            <span className="text-white font-bold">{stats.guestCount}회 <span className="text-[#555]">{stats.guestRatio}%</span></span>
          </div>
          <Bar ratio={stats.guestRatio} color="#555" />
        </div>
      </Section>

      {/* 공유 & 바이럴 */}
      <Section title="공유 & 바이럴">
        <Row
          label="카카오톡 공유"
          value={`${stats.shareKakao}회`}
          note={stats.total > 0 ? `변환의 ${Math.round((stats.shareKakao / stats.total) * 100)}%` : undefined}
        />
        <Row
          label="링크 복사"
          value={`${stats.shareLinkCopy}회`}
          note={stats.total > 0 ? `변환의 ${Math.round((stats.shareLinkCopy / stats.total) * 100)}%` : undefined}
        />
        <div className="py-3">
          <div className="flex items-center justify-between">
            <span className="text-[#888] text-sm">공유 전환율</span>
            <span className="text-white font-bold">{shareTotal}회 <span className="text-[#C9571A]">{shareRatio}%</span></span>
          </div>
          <Bar ratio={shareRatio} />
        </div>
      </Section>

      {/* 스타일별 */}
      <Section title="스타일별 사용">
        {stats.byStyle.length === 0 ? (
          <p className="text-[#444] text-sm py-4">데이터 없음</p>
        ) : (
          stats.byStyle.map((s) => {
            const ratio = stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0;
            return (
              <div key={s.style_id} className="py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-white/90 text-[15px] font-bold">{s.style_name}</span>
                  <span className="text-white font-bold">{s.count}회 <span className="text-[#555] font-normal text-xs">{ratio}%</span></span>
                </div>
                <Bar ratio={ratio} />
              </div>
            );
          })
        )}
      </Section>

    </main>
  );
}
