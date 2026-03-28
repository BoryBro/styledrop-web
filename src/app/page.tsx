"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [isAgreed, setIsAgreed] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const router = useRouter();

  const handleStart = () => {
    if (!isAgreed) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    router.push("/studio");
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6 relative">
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

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-[200px] h-[52px] bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold text-[16px] rounded-full transition-colors shadow-lg shadow-[#C9571A]/20"
        >
          시작하기 →
        </button>

        {/* Checkbox + privacy notice */}
        <label
          className="flex items-start gap-2.5 cursor-pointer max-w-[280px]"
          style={shaking ? { animation: "shake 0.5s ease-in-out" } : {}}
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
