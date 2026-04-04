"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { VISIBLE_STYLES } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const ALL_STYLE_CARDS = VISIBLE_STYLES.map((s) => ({ ...s, bgImage: s.afterImg }));
// 스타일 카드 리스트: 인기 먼저, 나머지는 원래 순서
const STYLES = [
  ...ALL_STYLE_CARDS.filter(s => s.popular),
  ...ALL_STYLE_CARDS.filter(s => !s.popular),
];

type Toast = { id: number; message: string };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto max-w-sm w-full bg-[#1A1A1A] border border-white/10 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 cursor-pointer"
        >
          <span className="text-[#C9571A]">✦</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function Studio() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedStyleRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNoCreditModal, setShowNoCreditModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [variantSelectStyle, setVariantSelectStyle] = useState<typeof STYLES[0] | null>(null);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [notices, setNotices] = useState<{ id: number; text: string }[]>([]);
  const [visitors, setVisitors] = useState<{ today: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/remaining").then(r => r.json()).then(d => setRemaining(d.remaining)).catch(() => {});
    fetch("/api/credits").then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
    fetch("/api/notices").then(r => r.json()).then(d => setNotices(d.notices ?? [])).catch(() => {});
    fetch("/api/visitors", { method: "GET" }).then(r => r.json()).then(d => setVisitors(d)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) console.error("[usage] API error:", data.error);
        setUsageCounts(data.counts ?? {});
      })
      .catch((e) => {
        console.error("[usage] fetch error:", e);
        setUsageCounts({});
      });
  }, []);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const handleCardClick = (style: typeof STYLES[0]) => {
    if (!style.active) {
      showToast("곧 출시됩니다 ✨");
      return;
    }
    if (!user && remaining === 0) {
      setShowLoginModal(true);
      return;
    }
    if (user && credits === 0) {
      setShowNoCreditModal(true);
      return;
    }
    setSelectedStyle(style.id);
    selectedStyleRef.current = style.id;

    const variants = STYLE_VARIANTS[style.id];
    if (variants && variants.length > 1) {
      // 베리에이션 있는 스타일 → 카드 클릭 즉시 옵션 모달 표시
      setVariantSelectStyle(style);
    } else {
      // 베리에이션 없음 → 바로 파일 선택
      sessionStorage.setItem("sd_variant", "default");
      fileInputRef.current?.click();
    }
  };

  // 카메라 가이드 — 스트림 시작/정리
  useEffect(() => {
    if (!showCameraGuide) return;
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => {
        if (!active) return;
        setShowCameraGuide(false);
        fileInputRef.current?.click();
      });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [showCameraGuide]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowCameraGuide(false);
  };

  const processImageDataUrl = (dataUrl: string) => {
    const styleId = selectedStyleRef.current;
    if (!styleId) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width; let height = img.height;
      const MAX_SIZE = 1024;
      if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
      else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
      canvas.width = Math.floor(width); canvas.height = Math.floor(height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const resized = canvas.toDataURL("image/jpeg", 0.85);
      sessionStorage.setItem("sd_styleId", styleId);
      sessionStorage.setItem("sd_imageBase64", resized.split(",")[1]);
      sessionStorage.setItem("sd_previewDataUrl", resized);
      sessionStorage.removeItem("sd_resultDataUrl");
      sessionStorage.removeItem("sd_shareUrl");
      sessionStorage.removeItem("sd_shareLink");
      sessionStorage.setItem("sd_fromStudio", "1");
      router.push("/result");
    };
    img.src = dataUrl;
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // 셀카이므로 좌우 반전 해제
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    stopCamera();
    processImageDataUrl(canvas.toDataURL("image/jpeg", 0.85));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const styleId = selectedStyleRef.current;
    if (!styleId) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1024;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];

      sessionStorage.setItem("sd_styleId", styleId);
      sessionStorage.setItem("sd_imageBase64", base64);
      sessionStorage.setItem("sd_previewDataUrl", dataUrl);
      sessionStorage.removeItem("sd_resultDataUrl");
      sessionStorage.removeItem("sd_shareUrl");
      sessionStorage.removeItem("sd_shareLink");
      sessionStorage.setItem("sd_fromStudio", "1");
      router.push("/result");
    };
    img.src = url;
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

        {/* Header */}
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          </div>
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <Link href="/shop" className="flex items-center gap-1.5 bg-[#1A1A1A] border border-white/8 px-3 py-1.5 rounded-full hover:border-[#C9571A]/40 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1h2l1.5 7h7l1-4.5H4" stroke="#C9571A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="6.5" cy="12" r="0.8" fill="#C9571A"/>
                    <circle cx="11" cy="12" r="0.8" fill="#C9571A"/>
                  </svg>
                  <span className="text-[11px] text-[#C9571A] font-bold">{credits !== null ? `${credits}크레딧` : "충전"}</span>
                </Link>
                <button onClick={() => router.push("/mypage")} className="flex items-center gap-2">
                  {user.profileImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
                  )}
                  <span className="text-[14px] font-medium text-white truncate max-w-[80px]">{user.nickname}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setLoginLoading(true); login(); }}
                disabled={loginLoading}
                className="bg-[#FEE500] text-[#3C1E1E] text-[13px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-70"
              >
                {loginLoading && <span className="w-3.5 h-3.5 rounded-full border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E] inline-block" style={{ animation: "spin 0.7s linear infinite" }} />}
                {loginLoading ? "연결 중..." : "카카오 로그인"}
              </button>
            )
          )}
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-4">
          <style>{`
            @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
            main * { letter-spacing: -1.5%; }
          `}</style>

          {/* 터미널 공지 — 최상단 */}
          {notices.length > 0 && (
            <div className="mb-5 bg-[#0D0D0D] border border-[#2a2a2a] rounded-xl px-4 py-3 font-mono overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                  <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                  <div className="w-2 h-2 rounded-full bg-[#28c840]" />
                  <span className="ml-1 text-[10px] text-[#444] tracking-wide">notice</span>
                </div>
                {visitors && (
                  <div className="flex items-center gap-2 text-[10px] text-[#444] font-mono">
                    <span className="flex items-center gap-1">
                      <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                        <circle cx="3" cy="3" r="3" fill="#C9571A" opacity="0.6"/>
                      </svg>
                      오늘 {visitors.today.toLocaleString()}
                    </span>
                    <span className="text-[#333]">·</span>
                    <span>누적 {visitors.total.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {notices.map((n, i) => (
                <p key={n.id} className={`text-[12px] text-[#888] leading-relaxed ${i > 0 ? "mt-1" : ""}`}>
                  <span className="text-[#C9571A]">›</span>{" "}
                  <span className="text-white/60">{n.text}</span>
                  {i === notices.length - 1 && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#C9571A]/70 ml-1 align-middle" style={{ animation: "blink 1.2s step-end infinite" }} />
                  )}
                </p>
              ))}
            </div>
          )}

          {/* 스타일 선택 섹션 헤더 */}
          <div className="mb-4">
            <h2 className="text-[20px] font-bold text-[#C9571A]">스타일 선택</h2>
            <p className="text-[18px] font-bold text-white mt-1">원하는 스타일의 카드를 선택해봐요</p>
          </div>

          <div className="flex flex-col gap-3">
            {STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => handleCardClick(style)}
                className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all duration-300 border-2 ${
                  selectedStyle === style.id
                    ? "border-[#C9571A] shadow-[0_4px_24px_rgb(201,87,26,0.3)]"
                    : "border-transparent"
                } ${!style.active ? "cursor-default" : "cursor-pointer"}`}
                style={{ backgroundColor: style.bgColor }}
              >
                {/* Split before/after for active cards with images */}
                {style.beforeImg && style.afterImg ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={style.beforeImg} alt="before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={style.afterImg} alt="after" className="absolute inset-0 w-full h-full object-cover" style={{ animation: "split-clip 4s ease-in-out infinite" }} draggable={false} />
                    <div className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]" style={{ animation: "split-line 4s ease-in-out infinite" }}>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center">
                        <svg width="14" height="10" viewBox="0 0 20 10" fill="none">
                          <path d="M1 5H19M1 5L5 2M1 5L5 8M19 5L15 2M19 5L15 8" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </>
                ) : style.bgImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={style.bgImage} alt={style.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : null}

                {/* Coming soon dim */}
                {!style.active && <div className="absolute inset-0 bg-black/50" />}

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                {/* Bottom left text */}
                <div className="absolute bottom-0 left-0 p-5">
                  <p className="text-[24px] font-bold text-white tracking-tight leading-tight mb-0.5">{style.name}</p>
                  <p className="text-[14px] text-[#ccc] mt-0.5 break-keep">{style.desc}</p>
                  {style.active && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="flex items-center gap-1.5 text-[13px] text-white/80 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="5" r="3.2" fill="currentColor" fillOpacity="0.85"/>
                          <path d="M1 15c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                        {usageCounts === null ? "..." : formatCount(usageCounts[style.id] ?? 0)}
                      </span>
                      <div className="flex items-center px-2 py-1 bg-[#C9571A]/20 border border-[#C9571A]/30 rounded-lg backdrop-blur-md">
                        <span className="text-[11px] font-extrabold text-[#C9571A] whitespace-nowrap">1크레딧</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Popular Badge */}
                {style.popular && (
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-[#C9571A] text-white text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl shadow-lg ring-1 ring-white/20 scale-105 origin-top-left transition-transform">
                    <span>인기</span>
                    <span className="text-[13px] leading-none -mt-0.5">🔥</span>
                  </div>
                )}


                {/* Selected check */}
                {selectedStyle === style.id && (
                  <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#C9571A] flex items-center justify-center shadow-md">
                    <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
                      <path d="M1 5L4.5 8.5L13 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 실험실 섹션 헤더 */}
          <div className="mt-8 mb-4">
            <h2 className="text-[20px] font-bold text-[#C9571A]">실험실</h2>
            <p className="text-[18px] font-bold text-white mt-1">색다른 AI 기능을 체험해봐요</p>
          </div>

          {/* AI 오디션 배너 — 포스터 카드 */}
          <Link href="/audition/solo" className="block mb-4 active:scale-[0.97] transition-transform">
            <div className="relative rounded-2xl overflow-hidden aspect-square bg-[#0D0806]">

              {/* ── 오렌지 탑바 ── */}
              <div className="absolute top-0 left-0 right-0 h-10 bg-[#C9571A] flex items-center justify-center z-20">
                <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase">AI Audition</span>
              </div>

              {/* ── 배경 그라데이션 ── */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a0700] via-[#0D0806] to-[#0a0a0a]" />

              {/* ── 초록 타원 — 텍스트 레이어 아래 ── */}
              <div className="absolute z-10" style={{ top: '22%', left: '-6%', width: '62%', height: '22%', background: '#4ADE80', borderRadius: '50%', transform: 'rotate(-7deg)' }} />

              {/* ── 오디션 대형 텍스트 — 타원 위 ── */}
              <div className="absolute z-20" style={{ top: '19%', left: '4%' }}>
                <span className="text-white font-black block" style={{ fontSize: 'clamp(44px, 13vw, 72px)', lineHeight: 1, letterSpacing: '-3px' }}>오디션</span>
              </div>

              {/* ── 부제목 ── */}
              <div className="absolute z-20" style={{ top: '45%', left: '5%' }}>
                <span className="text-white/60 font-bold tracking-wide" style={{ fontSize: 'clamp(13px, 3.5vw, 18px)' }}>내 연기력 테스트</span>
              </div>

              {/* ── 반투명 AI 대형 레이어 — 배경 깊이 ── */}
              <span className="absolute font-black select-none z-[1]" style={{ bottom: '-4%', right: '-3%', fontSize: 'clamp(90px, 26vw, 140px)', lineHeight: 1, letterSpacing: '-6px', color: 'rgba(255,255,255,0.04)' }}>AI</span>

              {/* ── 클랩보드 이모지 ── */}
              <div className="absolute z-20" style={{ bottom: '18%', left: '5%', fontSize: 'clamp(30px, 8vw, 44px)' }}>🎬</div>

              {/* ── 기울어진 3크레딧 배지 ── */}
              <div className="absolute z-30" style={{ bottom: '20%', right: '7%', background: '#C9571A', borderRadius: 5, padding: '5px 14px', transform: 'rotate(-5deg)', boxShadow: '3px 3px 0 rgba(0,0,0,0.5)' }}>
                <span className="font-black text-white italic" style={{ fontSize: 'clamp(12px, 3vw, 16px)', letterSpacing: '0.03em' }}>3크레딧</span>
              </div>

              {/* ── 유저 수 + 화살표 바텀 ── */}
              <div className="absolute z-20 flex items-center justify-between" style={{ bottom: '6%', left: '5%', right: '5%' }}>
                <span className="flex items-center gap-1.5 text-white/50 px-3 py-1.5 rounded-full bg-white/8 border border-white/10" style={{ fontSize: 'clamp(11px, 2.8vw, 14px)' }}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5" r="3.2" fill="currentColor" fillOpacity="0.85"/>
                    <path d="M1 15c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  {usageCounts === null ? "..." : formatCount(usageCounts["audition"] ?? 0)}
                </span>
                {/* 화살표 원형 버튼 */}
                <div className="rounded-full border-2 border-[#C9571A]/60 flex items-center justify-center" style={{ width: 'clamp(32px, 8vw, 42px)', height: 'clamp(32px, 8vw, 42px)' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="#C9571A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* ── 탑바 아래 타원 oval 배지 (포스터 코너 느낌) ── */}
              <div className="absolute z-20 border-2 border-white/20 rounded-full flex items-center justify-center" style={{ top: 48, right: 14, width: 44, height: 26 }}>
                <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">NEW</span>
              </div>

            </div>
          </Link>
        </main>

        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* 비로그인 배너 */}
        {!loading && !user && (
          <div className="max-w-2xl mx-auto w-full px-4 pb-4">
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl px-5 py-4 flex flex-col gap-3">
              <p className="text-white/80 text-[14px] font-medium">✦ 카카오 로그인하면 3크레딧 무료 지급!</p>
              <p className="text-[12px] text-[#666]">1크레딧 = AI 변환 1회 · 워터마크 없이 고화질 저장</p>
              <button
                onClick={() => { setLoginLoading(true); login(); }}
                disabled={loginLoading}
                className="bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold py-3 w-full text-[15px] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loginLoading ? (
                  <span className="w-5 h-5 rounded-full border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E]" style={{ animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
                  </svg>
                )}
                {loginLoading ? "연결 중..." : "카카오로 로그인하기"}
              </button>
            </div>
          </div>
        )}


        {/* Footer */}
        <footer className="py-6 text-center px-4">
          <p className="text-[11px] text-[#333]">
            © 2026 StyleDrop v2.0 · <Link href="/terms" className="hover:text-white/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-white/30 transition-colors">개인정보처리방침</Link>
          </p>
          <p className="text-[10px] text-[#2a2a2a] mt-1 leading-relaxed">
            상호: 핑거 · 대표자: 문지환 · 사업자등록번호: 707-79-00261<br/>
            주소: 대전광역시 서구 동서대로1030번길 8-6(내동) · 연락처: 010-5838-9960
          </p>
        </footer>
      </div>

      {/* 베리에이션 선택 모달 (카드 클릭 직후 — 파일 선택 전) */}
      {variantSelectStyle && (() => {
        const variants = STYLE_VARIANTS[variantSelectStyle.id] ?? [];
        return (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => { setVariantSelectStyle(null); setSelectedStyle(null); }}
          >
            <div
              className="bg-[#111] border border-white/10 rounded-t-3xl w-full max-w-2xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
              <p className="text-white font-bold text-[18px] mb-1">스타일 옵션 선택</p>
              <p className="text-[#555] text-[13px] mb-5">{variantSelectStyle.name} — 원하는 분위기를 골라주세요</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      sessionStorage.setItem("sd_variant", v.id);
                      setVariantSelectStyle(null);
                      if (variantSelectStyle?.id === "joseon-farmer") {
                        setShowCameraGuide(true);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-[#C9571A]/50 rounded-2xl overflow-hidden transition-all text-left flex flex-col"
                  >
                    {v.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail}
                        alt={v.label}
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                        <span className="text-white/10 text-4xl">✦</span>
                      </div>
                    )}
                    <div className="px-4 py-3">
                      <p className="text-white font-bold text-[14px]">{v.label}</p>
                      {v.desc && <p className="text-[#555] text-[11px] mt-0.5 break-keep">{v.desc}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setVariantSelectStyle(null); setSelectedStyle(null); }}
                className="w-full py-2 text-[#444] hover:text-white text-[13px] transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        );
      })()}

      {/* 카메라 가이드 모달 */}
      {showCameraGuide && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">
          {/* 상단 */}
          <div className="flex items-center justify-between px-5 pt-12 pb-4">
            <button onClick={stopCamera} className="text-white/60 text-[14px]">취소</button>
            <p className="text-white font-bold text-[15px]">셀카 찍기</p>
            <div className="w-12" />
          </div>

          {/* 카메라 뷰 + 오버레이 */}
          <div className="flex-1 relative overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* 얼굴 가이드 오버레이 */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              <defs>
                <mask id="face-mask">
                  <rect width="100" height="100" fill="white"/>
                  <ellipse cx="50" cy="44" rx="28" ry="36" fill="black"/>
                </mask>
              </defs>
              <rect width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#face-mask)"/>
              <ellipse cx="50" cy="44" rx="28" ry="36" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.9"/>
            </svg>
            {/* 안내 문구 */}
            <div className="absolute bottom-6 left-0 right-0 text-center">
              <p className="text-white/80 text-[13px] font-medium drop-shadow-lg">얼굴을 타원 안에 맞춰주세요</p>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="pb-14 pt-6 flex flex-col items-center gap-4 bg-black">
            {/* 촬영 버튼 */}
            <button
              onClick={captureFromCamera}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 active:scale-95 transition-transform shadow-2xl"
            />
            {/* 앨범에서 선택 */}
            <button
              onClick={() => { stopCamera(); fileInputRef.current?.click(); }}
              className="text-white/50 text-[13px]"
            >
              앨범에서 선택
            </button>
          </div>
        </div>
      )}

      {/* 로그인 유도 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowLoginModal(false)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm mx-4 border border-[#333] text-center w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[40px]">🎁</p>
            <p className="text-[18px] font-bold text-white mt-3">무료 체험이 끝났어요</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">카카오 로그인하면<br/><span className="text-[#C9571A] font-bold">3크레딧을 무료로 받아요!</span><br/>1크레딧 = AI 변환 1회</p>
            <button
              onClick={() => { window.location.href = "/api/auth/kakao"; }}
              className="bg-[#FEE500] text-[#3C1E1E] font-bold text-[15px] w-full py-4 rounded-xl mt-4 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
              </svg>
              카카오로 로그인하고 3크레딧 받기
            </button>
            <button onClick={() => setShowLoginModal(false)} className="text-[13px] text-[#555] mt-3 hover:text-[#888] transition-colors">
              다음에 할게요
            </button>
          </div>
        </div>
      )}

      {showNoCreditModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowNoCreditModal(false)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm mx-4 border border-[#333] text-center w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[40px]">💳</p>
            <p className="text-[18px] font-bold text-white mt-3">크레딧이 없어요</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">1회 변환에 1크레딧이 필요해요.<br/>크레딧을 충전하고 계속 이용해보세요.</p>
            <Link
              href="/shop"
              className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold text-[15px] w-full py-4 rounded-xl mt-4 flex items-center justify-center transition-colors"
            >
              크레딧 충전하기
            </Link>
            <button onClick={() => setShowNoCreditModal(false)} className="text-[13px] text-[#555] mt-3 hover:text-[#888] transition-colors">
              나중에 할게요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
