"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = { id: string; nickname: string | null; profileImage: string | null };

export default function Home() {
  const [isAgreed, setIsAgreed] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => {});
  }, []);

  const handleStart = () => {
    if (!isAgreed) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    router.push("/studio");
  };

  const handleKakaoLogin = () => {
    if (!isAgreed) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    window.location.href = "/api/auth/kakao";
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6 relative" suppressHydrationWarning>
      <div className="flex flex-col items-center gap-8 w-full max-w-xs">

        {/* Logo */}
        {logoError ? (
          <span className="font-[family-name:var(--font-montserrat)] font-bold text-3xl tracking-[-0.02em] text-[#C9571A]">StyleDrop</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="StyleDrop" className="h-14 w-auto" onError={() => setLogoError(true)} />
        )}

        {/* Subcopy */}
        <p className="text-[18px] text-[#888] tracking-[-0.02em]">사진 한 장, 감성은 AI가</p>

        {/* 로그인 상태 */}
        {user === undefined ? null : user ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 w-full justify-center">
              {user.profileImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
              )}
              <span className="text-white/80 text-sm font-medium">{user.nickname ?? "사용자"}</span>
              <button onClick={handleLogout} className="ml-auto text-[11px] text-[#555] hover:text-white/40 transition-colors">로그아웃</button>
            </div>
            <button
              onClick={() => router.push("/studio")}
              className="w-full h-[52px] bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold text-[16px] rounded-full transition-colors shadow-lg shadow-[#C9571A]/20"
            >
              시작하기 →
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            {/* 카카오 로그인 버튼 */}
            <button
              onClick={handleKakaoLogin}
              className="w-full h-[52px] bg-[#FEE500] hover:bg-[#F0D900] text-[#191919] font-bold text-[15px] rounded-full transition-colors flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
              </svg>
              카카오로 시작하기
            </button>

            {/* 로그인 없이 시작 */}
            <button
              onClick={handleStart}
              className="w-full h-[52px] bg-[#2A2A2A] hover:bg-[#333] text-white/60 hover:text-white font-bold text-[15px] rounded-full transition-colors"
            >
              로그인 없이 시작하기
            </button>
          </div>
        )}

        {/* Checkbox + privacy notice */}
        <label
          className="flex items-start gap-2.5 cursor-pointer max-w-[280px]"
          style={shaking ? { animation: "shake 0.5s ease-in-out" } : undefined}
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={(e) => setIsAgreed(e.target.checked)}
              className={`peer appearance-none shrink-0 w-4 h-4 rounded border-2 transition-colors cursor-pointer ${
                shaking && !isAgreed ? "border-red-500" : "border-white/20"
              } checked:border-[#C9571A] checked:bg-[#C9571A]`}
            />
            <svg
              className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
              viewBox="0 0 14 10" fill="none"
            >
              <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[12px] text-[#555] leading-relaxed">
            <Link href="/terms" className="text-[#777] underline underline-offset-2">이용약관</Link> 및 <Link href="/privacy" className="text-[#777] underline underline-offset-2">개인정보처리방침</Link>에 동의하며, 업로드된 사진은 AI 처리 후 즉시 삭제됩니다.
          </span>
        </label>

        {/* Links */}
        <div className="flex gap-5">
          <Link href="/terms" className="text-[12px] text-[#444] hover:text-white/40 transition-colors">[이용약관]</Link>
          <Link href="/privacy" className="text-[12px] text-[#444] hover:text-white/40 transition-colors">[개인정보처리방침]</Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-[11px] text-[#333]">
          © 2026 StyleDrop · <Link href="/terms" className="hover:text-white/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-white/30 transition-colors">개인정보처리방침</Link> · v0.3
        </p>
      </footer>
    </main>
  );
}
