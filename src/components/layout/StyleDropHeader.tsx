"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function StyleDropHeader() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  useEffect(() => {
    if (!user) return;

    fetch("/api/credits")
      .then((response) => response.json())
      .then((data) => setCredits(data.credits ?? 0))
      .catch(() => setCredits(0));
  }, [user]);

  return (
    <header className="sticky top-0 z-40 flex h-[52px] items-center border-b border-[#E0E0E0] bg-[#F5F5F5] px-4">
      <button
        type="button"
        aria-label="뒤로 가기"
        onClick={() => router.back()}
        className="relative z-10 flex h-9 w-9 items-center justify-center text-[#0A0A0A]/45 transition-colors hover:text-[#0A0A0A]"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <Link
        href="/studio"
        className="absolute left-1/2 -translate-x-1/2 font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]"
      >
        StyleDrop
      </Link>

      {!loading && (
        user ? (
          <div className="relative z-10 ml-auto flex items-center gap-2">
            <Link
              href="/shop"
              className="flex items-center gap-1.5 rounded-full border border-black/8 bg-[#EBEBEB] px-3 py-1.5 transition-colors hover:border-[#C9571A]/40"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1h2l1.5 7h7l1-4.5H4" stroke="#C9571A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6.5" cy="12" r="0.8" fill="#C9571A" />
                <circle cx="11" cy="12" r="0.8" fill="#C9571A" />
              </svg>
              <span className="text-[11px] font-bold text-[#C9571A]">
                {credits !== null ? `${credits}크레딧` : "충전"}
              </span>
            </Link>

            <button
              type="button"
              aria-label="마이페이지로 이동"
              onClick={() => router.push("/mypage")}
              className="flex h-9 w-7 items-center justify-center text-[#C9571A] transition-opacity hover:opacity-75"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-[2px] w-5 rounded-full bg-current" />
                <span className="block h-[2px] w-5 rounded-full bg-current" />
                <span className="block h-[2px] w-5 rounded-full bg-current" />
              </span>
            </button>
          </div>
        ) : (
          <div className="relative z-10 ml-auto">
            <button
              type="button"
              aria-label="메뉴 열기"
              onClick={() => setShowHeaderMenu((prev) => !prev)}
              className="flex h-9 w-8 items-center justify-center text-[#C9571A] transition-opacity hover:opacity-75"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-[2px] w-5 rounded-full bg-current" />
                <span className="block h-[2px] w-5 rounded-full bg-current" />
                <span className="block h-[2px] w-5 rounded-full bg-current" />
              </span>
            </button>

            {showHeaderMenu && (
              <div className="absolute right-0 top-11 z-50 w-[168px] rounded-2xl border border-black/10 bg-white p-2 shadow-[0_16px_40px_rgba(10,10,10,0.14)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderMenu(false);
                    setLoginLoading(true);
                    login();
                  }}
                  disabled={loginLoading}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[#FEE500] text-[13px] font-black text-[#3C1E1E] disabled:opacity-70"
                >
                  {loginLoading ? "연결 중..." : "로그인하기"}
                </button>
              </div>
            )}
          </div>
        )
      )}
    </header>
  );
}
