"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function StyleDropHeader() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

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
        href="/"
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
              aria-label="메뉴 열기"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
              className="flex h-9 w-7 items-center justify-center text-[#C9571A] transition-opacity hover:opacity-75"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-[2px] w-5 rounded-full bg-current" />
                <span className="block h-[2px] w-5 rounded-full bg-current" />
                <span className="block h-[2px] w-5 rounded-full bg-current" />
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[44px] z-50 w-[220px] overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.16)]">
                <Link
                  href="/mypage"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 border-b border-[#F0F0F0] px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
                >
                  {user.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profileImage} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F0F0] text-[17px] font-black text-[#C9571A]">
                      {user.nickname.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-black tracking-[-0.03em] text-[#0A0A0A]">
                      {user.nickname}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-semibold text-[#777]">
                      마이페이지
                    </span>
                  </span>
                </Link>
                <Link
                  href="/studio"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between border-b border-[#F6F6F6] px-4 py-3 text-[13px] font-bold text-[#0A0A0A] transition-colors hover:bg-[#FFF4EE] hover:text-[#C9571A]"
                >
                  <span>스튜디오</span>
                  <span aria-hidden="true">›</span>
                </Link>
                <Link
                  href="/magazine"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-3 text-[13px] font-bold text-[#0A0A0A] transition-colors hover:bg-[#FFF4EE] hover:text-[#C9571A]"
                >
                  <span>매거진</span>
                  <span aria-hidden="true">›</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setLoginLoading(true);
              login();
            }}
            disabled={loginLoading}
            className="relative z-10 ml-auto flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-3 py-1.5 text-[13px] font-bold text-[#3C1E1E] disabled:opacity-70"
          >
            {loginLoading && (
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E]" style={{ animation: "spin 0.7s linear infinite" }} />
            )}
            {loginLoading ? "연결 중..." : "카카오 로그인"}
          </button>
        )
      )}
    </header>
  );
}
