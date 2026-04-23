"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";

type User = { id: string; nickname: string | null; profileImage: string | null };
type ShowcaseItem = {
  userId: string;
  nickname: string;
  profileImage: string | null;
  imageUrl: string;
  styleId: string | null;
  createdAt: string;
};

const PUBLIC_GUIDES = [
  { href: "/ai-photo-transform", label: "AI 사진 변환" },
  { href: "/ai-profile-photo", label: "AI 프로필 사진" },
  { href: "/personal-color-test", label: "퍼스널컬러" },
  { href: "/ai-audition", label: "AI 오디션 · 관상" },
  { href: "/how-to", label: "사용방법" },
];

export default function Home() {
  const [isAgreed, setIsAgreed] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [visitors, setVisitors] = useState<{ today: number; total: number } | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.loggedIn ? data.user : null))
      .catch(() => {});
    const alreadyVisited = sessionStorage.getItem("sd_visited");
    fetch("/api/visitors", { method: alreadyVisited ? "GET" : "POST" })
      .then((r) => r.json())
      .then((d) => { setVisitors(d); sessionStorage.setItem("sd_visited", "1"); })
      .catch(() => {});
    fetch("/api/public-showcase")
      .then((r) => r.json())
      .then((data) => setShowcaseItems(Array.isArray(data.items) ? data.items : []))
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
    window.location.href = "/api/auth/kakao";
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-[#0A0A0A] px-6" suppressHydrationWarning>
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/intro-bg.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,87,26,0.18),transparent_42%)]" />

      {visitors && (
        <div className="absolute top-5 left-0 right-0 flex justify-center z-10 px-4">
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/35 border border-white/10 backdrop-blur-md font-mono">
            <span className="flex items-center gap-1.5 text-[11px] text-white/65">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="3" fill="#C9571A" opacity="0.7"/>
                <circle cx="5" cy="5" r="1.5" fill="#C9571A"/>
              </svg>
              오늘 <span className="text-white/90">{visitors.today.toLocaleString()}</span>
            </span>
            <span className="text-white/25">·</span>
            <span className="text-[11px] text-white/65">
              누적 <span className="text-white/90">{visitors.total.toLocaleString()}</span>
            </span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center py-24">
        <div className="flex w-full max-w-xs flex-col items-center gap-8">

          {/* Logo */}
          <div className="relative flex items-center select-none px-2" style={{ padding: "0.2em 0.5em" }} aria-label="StyleDrop">
            <span
              className="logo-gradient-text"
              style={{
                position: "relative",
                zIndex: 1,
                fontFamily: "var(--font-boldonse)",
                fontWeight: 400,
                fontSize: "2.2rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 1.3,
                display: "block",
                overflow: "visible",
              }}
            >
              StyleDrop
            </span>
          </div>

          {/* Subcopy */}
          <p className="text-[18px] text-white/80 tracking-[-0.02em]">사진 한 장, 감성은 AI가</p>

          {showcaseItems.length > 0 && (
            <div className="w-screen max-w-none px-0 overflow-hidden">
              <div className="mx-auto w-full max-w-md">
                <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
                  <div
                    className="flex gap-3 w-max px-4"
                    style={{ animation: "showcase-marquee 22s linear infinite" }}
                  >
                    {[...showcaseItems, ...showcaseItems].map((item, index) => (
                      <div
                        key={`${item.userId}-${index}`}
                        className="h-24 w-20 shrink-0 overflow-hidden rounded-[22px] border border-white/12 bg-black/20 shadow-[0_14px_28px_rgba(0,0,0,0.24)] backdrop-blur-sm"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.imageUrl} alt={item.nickname} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 로그인 상태 */}
          {user === undefined ? null : user ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-2.5 bg-black/35 border border-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 w-full justify-center">
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
                className="w-full h-[52px] bg-[#FEE500] hover:bg-[#F0D900] text-[#191919] font-bold text-[15px] rounded-full transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/25"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
                </svg>
                카카오로 시작하기
              </button>

              {/* 로그인 없이 시작 */}
              <button
                onClick={handleStart}
                className="w-full h-[52px] bg-black/35 hover:bg-black/50 border border-white/10 backdrop-blur-md text-white/80 hover:text-white font-bold text-[15px] rounded-full transition-colors"
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
            <span className="text-[12px] text-white/65 leading-relaxed">
              <Link href="/terms" className="text-white/80 underline underline-offset-2">이용약관</Link> 및 <Link href="/privacy" className="text-white/80 underline underline-offset-2">개인정보처리방침</Link>에 동의하며, 업로드한 사진과 생성 결과는 서비스 제공·저장·공유 기능 범위에서 처리됩니다.
            </span>
          </label>

          {/* Links */}
          <div className="flex gap-5">
            <Link href="/faq" className="text-[12px] text-white/55 hover:text-white transition-colors">FAQ</Link>
            <Link href="/terms" className="text-[12px] text-white/55 hover:text-white transition-colors">이용약관</Link>
            <Link href="/privacy" className="text-[12px] text-white/55 hover:text-white transition-colors">개인정보처리방침</Link>
          </div>

        </div>

        <div className="mt-8 w-full max-w-md">
          <GoogleAd
            slot={ADSENSE_PAGE_SLOTS.home}
            className="border-white/12 bg-black/35"
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

      <style>{`
        @keyframes showcase-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 6px)); }
        }
      `}</style>

      {/* Footer */}
      <footer className="relative z-10 w-[calc(100%+3rem)] -mx-6 pb-0">
        <div className="w-full border-t border-white/10 px-5 py-4">
          <div className="grid w-full gap-5 text-left">
            <div>
              <p className="text-[18px] font-bold tracking-[-0.03em] text-white">StyleDrop</p>
              <p className="mt-2 max-w-[320px] text-[11px] leading-5 text-white/72">
                사진 한 장으로 감성 카드, 프로필 컷, 퍼스널컬러, AI 오디션 결과까지 이어지는 AI 이미지 서비스.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-white">Explore</p>
              <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2">
                {PUBLIC_GUIDES.map((guide) => (
                  <Link
                    key={guide.href}
                    href={guide.href}
                    className="text-[11px] leading-5 text-white/76 transition-colors hover:text-white"
                  >
                    {guide.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-[10px] text-white/70">
            <span>© 2026 StyleDrop</span>
            <Link href="/faq" className="transition-colors hover:text-white">FAQ</Link>
            <Link href="/terms" className="transition-colors hover:text-white">이용약관</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">개인정보처리방침</Link>
            <a href="mailto:support@styledrop.cloud" className="transition-colors hover:text-white">문의</a>
          </div>
        </div>

        <div className="w-full border-t border-white/8 px-5 py-3">
          <button
            type="button"
            onClick={() => setIsContactOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={isContactOpen}
            aria-controls="footer-contact-panel"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/62">
              Contact
            </span>
            <span
              className={`text-[12px] text-white/54 transition-transform ${isContactOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {isContactOpen && (
            <div
              id="footer-contact-panel"
              className="mt-2 grid grid-cols-1 gap-1 text-[10px] leading-5 text-white/50"
            >
              <p>상호: 핑거 · 대표자: 문지환</p>
              <p>사업자등록번호: 707-79-00261</p>
              <p>서울특별시 송파구 오금로 551, 1동 2층 201호 257</p>
              <p>0505-007-3670</p>
              <a href="mailto:support@styledrop.cloud" className="block transition-colors hover:text-white">
                support@styledrop.cloud
              </a>
            </div>
          )}
        </div>
      </footer>
    </main>
  );
}
