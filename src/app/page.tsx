"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";
import { buildKakaoLoginUrlWithReferral, storeReferralCodeFromCurrentUrl } from "@/lib/referral";

type User = { id: string; nickname: string | null; profileImage: string | null };

const PUBLIC_GUIDES = [
  { href: "/ai-photo-transform", label: "AI 사진 변환" },
  { href: "/ai-profile-photo", label: "AI 프로필 사진" },
  { href: "/personal-color-test", label: "퍼스널컬러" },
  { href: "/ai-audition", label: "AI 오디션 · 관상" },
  { href: "/how-to", label: "사용방법" },
];

const HERO_BUBBLES = [
  { src: "/thumbnails/Dreamy_wildflower-after.jpg", className: "left-[30%] top-[78px] h-[142px] w-[142px] z-30", floatClass: "hero-bubble-float-a" },
  { src: "/thumbnails/holographic-after.jpg", className: "left-[6%] top-[92px] h-[104px] w-[104px] z-20", floatClass: "hero-bubble-float-b" },
  { src: "/thumbnails/Rainy_crosswalk-after.jpg", className: "right-[5%] top-[88px] h-[108px] w-[108px] z-20", floatClass: "hero-bubble-float-c" },
  { src: "/thumbnails/visual-kei-after.jpg", className: "left-[48%] top-[38px] h-[92px] w-[92px] z-10", floatClass: "hero-bubble-float-d" },
  { src: "/thumbnails/rugby-after.jpg", className: "right-[21%] top-[128px] h-[84px] w-[84px] z-40", floatClass: "hero-bubble-float-b" },
  { src: "/thumbnails/idol-photocard-after.jpg", className: "left-[20%] top-[34px] h-[78px] w-[78px] z-10", floatClass: "hero-bubble-float-c" },
  { src: "/thumbnails/maid-cafe-heart-after.jpg", className: "right-[30%] top-[22px] h-[74px] w-[74px] z-0", floatClass: "hero-bubble-float-a" },
  { src: "/thumbnails/angel-after.jpg", className: "left-[-8px] top-[150px] h-[72px] w-[72px] z-30", floatClass: "hero-bubble-float-d" },
  { src: "/thumbnails/joseon-after.jpg", className: "right-[-10px] top-[150px] h-[74px] w-[74px] z-30", floatClass: "hero-bubble-float-a" },
  { src: "/thumbnails/skydiving-after.jpg", className: "left-[42%] top-[142px] h-[78px] w-[78px] z-40", floatClass: "hero-bubble-float-c" },
  { src: "/thumbnails/club-flash-after.jpg", className: "left-[14%] top-[156px] h-[68px] w-[68px] z-40", floatClass: "hero-bubble-float-b" },
  { src: "/thumbnails/gyaru-after.jpg", className: "right-[10%] top-[44px] h-[66px] w-[66px] z-10", floatClass: "hero-bubble-float-d" },
];

export default function Home() {
  const [isAgreed, setIsAgreed] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    storeReferralCodeFromCurrentUrl();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.loggedIn ? data.user : null))
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
    setIsLoggingIn(true);
    window.location.href = buildKakaoLoginUrlWithReferral();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <main
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#F4FBF6] px-5 text-[#0B0B0B]"
      style={{ fontFamily: "var(--font-outfit), var(--font-sans), sans-serif" }}
      suppressHydrationWarning
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#FFFFFF_0%,#F7FFF9_24%,#DDF8E6_56%,#FFFFFF_100%)]" />
      <div className="pointer-events-none absolute -left-28 top-20 h-[390px] w-[390px] rounded-full bg-[#86E8AD]/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-2 h-[360px] w-[360px] rounded-full bg-[#EFFFF4]/90 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-[250px] h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-[#A8F0C4]/32 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.78),rgba(255,255,255,0)_44%)]" />

      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center pb-14 pt-10">
        <div className="flex w-full max-w-[430px] flex-col items-center">
          <div className="mb-8 grid grid-cols-3 gap-1.5 opacity-35" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="h-3 w-3 rounded-full bg-[#BFC0C0]" />
            ))}
          </div>

          <div className="relative h-[250px] w-[calc(100%+4rem)] max-w-[560px]" aria-label="StyleDrop AI style examples">
            <div className="absolute inset-x-0 top-[160px] h-24 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.14),rgba(0,0,0,0)_68%)] blur-2xl" />
            {HERO_BUBBLES.map((bubble) => (
              <div
                key={bubble.src}
                className={`absolute overflow-hidden rounded-full border border-white/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] ${bubble.floatClass} ${bubble.className}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bubble.src} alt="" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.72),rgba(255,255,255,0)_38%)]" />
              </div>
            ))}
            <div className="hero-glass-plus absolute left-1/2 top-[174px] z-50 flex h-[76px] w-[76px] -translate-x-1/2 items-center justify-center rounded-full border border-white/70 bg-white/34 text-[34px] font-light text-[#141414] shadow-[0_18px_42px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
              <span>+</span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[13px] font-black uppercase tracking-[0.34em] text-[#C9571A]">StyleDrop</p>
            <h1 className="mt-4 text-[36px] font-normal leading-[1.22] tracking-[-0.04em] text-black">
              Meet StyleDrop.
              <br />
              One photo,
              <br />
              endless AI styles.
            </h1>
            <p className="mx-auto mt-5 max-w-[310px] text-[16px] font-semibold leading-7 text-[#68746B]" style={{ fontFamily: "\"SUIT Variable\", var(--font-sans), sans-serif" }}>
              사진 한 장을 올리고,
              <br />
              원하는 분위기를 고르면 끝.
            </p>
          </div>

          {/* 로그인 상태 */}
          {user === undefined ? null : user ? (
            <div className="mt-9 flex w-full flex-col items-center gap-3">
              <div className="flex w-full items-center justify-center gap-3 rounded-[28px] border border-black/5 bg-white/90 px-4 py-3 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur">
                {user.profileImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profileImage} alt="" className="h-9 w-9 rounded-full object-cover" />
                )}
                <span className="text-[15px] font-bold text-[#2B2926]">{user.nickname ?? "사용자"}</span>
                <button onClick={handleLogout} className="ml-auto text-[12px] font-semibold text-[#B6B0A9] transition-colors hover:text-black">로그아웃</button>
              </div>
              <button
                onClick={() => router.push("/studio")}
                className="h-[60px] w-full rounded-full bg-[#D25416] text-[18px] font-black text-white shadow-[0_20px_48px_rgba(210,84,22,0.24)] transition-transform active:scale-[0.98]"
              >
                시작하기 →
              </button>
            </div>
          ) : (
            <div className="mt-9 flex w-full flex-col items-center gap-3">
              {/* 카카오 로그인 버튼 */}
              <button
                onClick={handleKakaoLogin}
                className="flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] text-[16px] font-black text-[#191919] shadow-[0_16px_42px_rgba(15,23,42,0.12)] transition-transform active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
                </svg>
                카카오로 시작하기
              </button>

              {/* 로그인 없이 시작 */}
              <button
                onClick={handleStart}
                className="h-[58px] w-full rounded-full border border-black/8 bg-white text-[16px] font-black text-[#171717] shadow-[0_16px_42px_rgba(15,23,42,0.08)] transition-transform active:scale-[0.98]"
              >
                로그인 없이 시작하기
              </button>
            </div>
          )}

          {/* Checkbox + privacy notice */}
          <label
            className="mt-7 flex max-w-[340px] cursor-pointer items-start gap-3 rounded-[24px] bg-white/60 px-4 py-3"
            style={shaking ? { animation: "shake 0.5s ease-in-out" } : undefined}
          >
            <div className="relative mt-0.5 flex items-center justify-center">
              <input
                type="checkbox"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className={`peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md border-2 transition-colors ${
                  shaking && !isAgreed ? "border-red-500" : "border-[#D6D0C8]"
                } checked:border-[#C9571A] checked:bg-[#C9571A]`}
              />
              <svg
                className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
                viewBox="0 0 14 10" fill="none"
              >
                <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[12px] font-semibold leading-6 text-[#817B73]">
              <Link href="/terms" className="text-[#171717] underline underline-offset-2">이용약관</Link> 및 <Link href="/privacy" className="text-[#171717] underline underline-offset-2">개인정보처리방침</Link>에 동의하며, 업로드한 사진과 생성 결과는 서비스 제공·저장·공유 기능 범위에서 처리됩니다.
            </span>
          </label>

          {/* Links */}
          <div className="mt-5 flex gap-5">
            <Link href="/faq" className="text-[12px] font-semibold text-[#9A938B] transition-colors hover:text-black">FAQ</Link>
            <Link href="/terms" className="text-[12px] font-semibold text-[#9A938B] transition-colors hover:text-black">이용약관</Link>
            <Link href="/privacy" className="text-[12px] font-semibold text-[#9A938B] transition-colors hover:text-black">개인정보처리방침</Link>
          </div>

        </div>

        <div className="mt-8 w-full max-w-md">
          <GoogleAd
            slot={ADSENSE_PAGE_SLOTS.home}
            className="border-black/10 bg-white/70"
            minHeight={110}
          />
        </div>
      </div>

      {/* 카카오 로그인 로딩 오버레이 */}
      {isLoggingIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A1A1A]/90 border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-[280px] w-full mx-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-white/5" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FEE500] animate-spin" />
            </div>
            <div className="text-center flex flex-col gap-2">
              <p className="text-white font-bold text-base">카카오 로그인 중</p>
              <p className="text-white/40 text-xs leading-relaxed">
                잠시만 기다려 주세요 💬<br />
                카카오톡 앱으로 연결됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 w-[calc(100%+2.5rem)] -mx-5 pb-0">
        <div className="w-full border-t border-black/8 bg-white/45 px-5 py-4">
          <div className="grid w-full gap-5 text-left">
            <div>
              <p className="text-[18px] font-black tracking-[-0.03em] text-black">StyleDrop</p>
              <p className="mt-2 max-w-none text-[11px] font-semibold leading-5 text-[#7D776F] sm:whitespace-nowrap">
                사진 한 장으로 감성 카드, 프로필 컷, 퍼스널컬러, AI 오디션 결과까지 이어지는 AI 이미지 서비스.
              </p>
            </div>

            <div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#B7AFA6]">
                  Contact
                </p>
                <div className="mt-2 flex flex-col gap-1 text-[10px] font-semibold leading-4 text-[#908981]">
                  <p className="flex flex-wrap gap-x-5 gap-y-1">
                    <span className="font-medium">상호: 핑거</span>
                    <span className="font-medium">사업자: 707-79-00261</span>
                    <span className="font-semibold text-[#5F5953]">0505-007-3670</span>
                  </p>
                  <p className="flex flex-wrap gap-x-5 gap-y-1">
                    <span className="font-medium">서울특별시 송파구 오금로 551, 1동 2층 201호 257</span>
                    <a href="mailto:support@styledrop.cloud" className="font-semibold text-[#5F5953] transition-colors hover:text-black">
                      support@styledrop.cloud
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/8 pt-3 text-[10px] font-semibold text-[#77716A]">
            <span>© 2026 StyleDrop</span>
            <Link href="/faq" className="transition-colors hover:text-black">FAQ</Link>
            <Link href="/terms" className="transition-colors hover:text-black">이용약관</Link>
            <Link href="/privacy" className="transition-colors hover:text-black">개인정보처리방침</Link>
            <a href="mailto:support@styledrop.cloud" className="transition-colors hover:text-black">문의</a>
          </div>
        </div>

        <div className="w-full border-t border-black/8 bg-white/35 px-5 py-3">
          <button
            type="button"
            onClick={() => setIsExploreOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={isExploreOpen}
            aria-controls="footer-explore-panel"
          >
            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[#77716A]">
              Explore
            </span>
            <span
              className={`text-[12px] text-[#99928A] transition-transform ${isExploreOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {isExploreOpen && (
            <div
              id="footer-explore-panel"
              className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-semibold leading-5 text-[#716B64]"
            >
              {PUBLIC_GUIDES.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className="transition-colors hover:text-black"
                >
                  {guide.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </footer>
    </main>
  );
}
