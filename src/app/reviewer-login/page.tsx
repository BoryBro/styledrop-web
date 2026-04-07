"use client";

import { useSearchParams } from "next/navigation";

export default function ReviewerLoginPage() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "1";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-[12px] font-bold tracking-[0.22em] text-[#C9571A] uppercase">Review Access</p>
          <h1 className="mt-3 text-[28px] font-bold tracking-tight">테스트 로그인</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55 break-keep">
            카카오페이 심사용 테스트 계정 로그인 페이지입니다. 아이디와 비밀번호를 입력하면 충전 테스트 계정으로 바로 접속됩니다.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-[13px] text-white/70">
            아이디: <span className="font-bold text-white">styldrop</span>
            <br />
            비밀번호: <span className="font-bold text-white">9960</span>
          </div>
        </div>

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
              placeholder="비밀번호 입력"
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
    </div>
  );
}
