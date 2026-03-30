"use client";

import { useState } from "react";

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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/10 flex flex-col gap-1">
      <p className="text-white/40 text-xs font-medium">{label}</p>
      <p className="text-3xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-[#555] text-xs">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      else setStats(data);
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

  return (
    <main className="w-full max-w-lg mx-auto px-4 py-10 flex flex-col gap-8 bg-[#0A0A0A] min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">Admin</h1>
        <button onClick={() => { setStats(null); setPassword(""); }} className="text-xs text-white/40 hover:text-white transition-colors">
          로그아웃
        </button>
      </div>

      {/* 핵심 수치 */}
      <div>
        <p className="text-white/40 text-xs font-medium mb-3 px-1">전체 사용 현황</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="전체 변환 수" value={stats.total} />
          <StatCard label="오늘 변환 수" value={stats.todayTotal} />
          <StatCard label="가입 유저 수" value={stats.totalUsers} />
          <StatCard label="재방문 수" value={stats.revisit} />
        </div>
      </div>

      {/* 회원 / 비회원 비율 */}
      <div>
        <p className="text-white/40 text-xs font-medium mb-3 px-1">회원 vs 비회원</p>
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">로그인 유저</span>
            <span className="text-white font-bold">{stats.userCount}회 ({stats.userRatio}%)</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div className="bg-[#C9571A] h-2 rounded-full transition-all" style={{ width: `${stats.userRatio}%` }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">비로그인 (게스트)</span>
            <span className="text-white font-bold">{stats.guestCount}회 ({stats.guestRatio}%)</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div className="bg-white/30 h-2 rounded-full transition-all" style={{ width: `${stats.guestRatio}%` }} />
          </div>
        </div>
      </div>

      {/* 공유 / 바이럴 */}
      <div>
        <p className="text-white/40 text-xs font-medium mb-3 px-1">공유 & 바이럴</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="카카오 공유"
            value={stats.shareKakao}
            sub={stats.total > 0 ? `변환 대비 ${Math.round((stats.shareKakao / stats.total) * 100)}%` : undefined}
          />
          <StatCard
            label="링크 복사"
            value={stats.shareLinkCopy}
            sub={stats.total > 0 ? `변환 대비 ${Math.round((stats.shareLinkCopy / stats.total) * 100)}%` : undefined}
          />
        </div>
      </div>

      {/* 스타일별 */}
      <div>
        <p className="text-white/40 text-xs font-medium mb-3 px-1">스타일별 사용 횟수</p>
        {stats.byStyle.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/10 text-white/30 text-sm">데이터 없음</div>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.byStyle.map((s) => (
              <div key={s.style_id} className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{s.style_name}</span>
                  <span className="text-[#C9571A] font-extrabold text-xl">{s.count}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-[#C9571A]/60 h-1.5 rounded-full"
                    style={{ width: `${stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
