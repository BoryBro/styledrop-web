"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ReviewerLoginContent() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "1";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <header className="h-[52px] border-b border-[#1a1a1a] flex items-center px-4">
        <a href="/" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">
          StyleDrop
        </a>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div>
          <p className="text-[12px] font-bold tracking-[0.22em] text-[#C9571A] uppercase">Review Access</p>
          <h1 className="mt-3 text-[30px] font-bold tracking-tight">테스트 계정 로그인</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/55 break-keep">
            카카오페이 심사용 페이지입니다. 아래 아이디와 비밀번호로 로그인하면 결제 테스트용 계정으로 바로 접속됩니다.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111] p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#C9571A]/15 text-[#C9571A]">
              ✦
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">심사용 테스트 계정</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                로그인 후 크레딧 충전 페이지로 바로 이동합니다.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3">
              <p className="text-[12px] text-white/45">아이디</p>
              <p className="mt-1 text-[16px] font-bold text-white">styldrop</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3">
              <p className="text-[12px] text-white/45">비밀번호</p>
              <p className="mt-1 text-[16px] font-bold text-white">9960</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111] p-5">
          {hasError && (
            <div className="mb-4 rounded-2xl border border-[#C9571A]/30 bg-[#C9571A]/10 px-4 py-3 text-[13px] text-[#ffb48b]">
              아이디 또는 비밀번호가 올바르지 않습니다.
            </div>
          )}

          <form method="POST" action="/api/auth/test-login" className="space-y-4">
            <div>
              <label htmlFor="loginId" className="mb-2 block text-[13px] font-medium text-white/70">
                아이디
              </label>
              <input
                id="loginId"
                name="loginId"
                type="text"
                autoComplete="username"
                required
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 text-[15px] text-white outline-none transition focus:border-[#C9571A]/50"
                placeholder="styldrop"
                defaultValue="styldrop"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[13px] font-medium text-white/70">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 text-[15px] text-white outline-none transition focus:border-[#C9571A]/50"
                placeholder="9960"
              />
            </div>

            <button
              type="submit"
              className="mt-2 h-12 w-full rounded-2xl bg-[#C9571A] text-[15px] font-bold text-white transition hover:bg-[#b64f17]"
            >
              테스트 계정으로 로그인
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function ReviewerLoginPage() {
  return (
    <Suspense fallback={null}>
      <ReviewerLoginContent />
    </Suspense>
  );
}
