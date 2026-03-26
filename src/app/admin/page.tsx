"use client";

import { useState } from "react";

type StyleStat = { style_id: string; style_name: string; count: number };
type Stats = { total: number; byStyle: StyleStat[] };

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
      if (!res.ok) {
        setError(data.error || "오류가 발생했습니다.");
      } else {
        setStats(data);
      }
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!stats) {
    return (
      <main className="w-full max-w-sm mx-auto px-4 py-20 flex flex-col gap-6">
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
    <main className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">Admin</h1>
        <button
          onClick={() => { setStats(null); setPassword(""); }}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/10">
        <p className="text-white/40 text-sm font-medium mb-1">전체 생성 수</p>
        <p className="text-4xl font-extrabold text-white">{stats.total}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-white/40 text-sm font-medium px-1">스타일별 사용 횟수</p>
        {stats.byStyle.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/10 text-white/30 text-sm">
            데이터 없음
          </div>
        ) : (
          stats.byStyle.map((s) => (
            <div
              key={s.style_id}
              className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/10 flex items-center justify-between"
            >
              <span className="text-white font-semibold text-sm">{s.style_name}</span>
              <span className="text-[#C9571A] font-extrabold text-xl">{s.count}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
