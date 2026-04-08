"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAuditionAvailability } from "@/hooks/useAuditionAvailability";
import { PERSONAL_COLOR_LAB_ENABLED, TRACE_LAB_ENABLED } from "@/lib/feature-flags";
import {
  PERSONAL_COLOR_CONTROL_ID,
  applyStyleControl,
  resolveFeatureControlState,
  type StyleControlState,
} from "@/lib/style-controls";
import { ALL_STYLES } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const BASE_STYLE_CARDS = ALL_STYLES.map((s) => ({ ...s, bgImage: s.afterImg }));
type StyleCard = (typeof BASE_STYLE_CARDS)[number];
type StudioSectionTab = "cards" | "lab";

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
  const [styleControls, setStyleControls] = useState<Record<string, StyleControlState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedStyleRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const { isLoading: isAuditionLoading, isVisible: isAuditionVisible, isEnabled: isAuditionEnabled } = useAuditionAvailability();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNoCreditModal, setShowNoCreditModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [variantSelectStyle, setVariantSelectStyle] = useState<StyleCard | null>(null);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [notices, setNotices] = useState<{ id: number; text: string }[]>([]);
  const [visitors, setVisitors] = useState<{ today: number; total: number } | null>(null);
  const [activeSectionTab, setActiveSectionTab] = useState<StudioSectionTab>("cards");
  const generalCardsSectionRef = useRef<HTMLDivElement>(null);
  const labSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/remaining").then(r => r.json()).then(d => setRemaining(d.remaining)).catch(() => {});
    fetch("/api/credits").then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
    fetch("/api/notices").then(r => r.json()).then(d => setNotices(d.notices ?? [])).catch(() => {});
    fetch("/api/visitors", { method: "GET" }).then(r => r.json()).then(d => setVisitors(d)).catch(() => {});
    fetch("/api/style-controls")
      .then((r) => r.json())
      .then((data) => {
        const controls = Array.isArray(data.controls) ? data.controls : [];
        setStyleControls(Object.fromEntries(controls.map((control: StyleControlState) => [control.style_id, control])));
      })
      .catch(() => setStyleControls({}));
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

  const allStyleCards = BASE_STYLE_CARDS
    .map((style) => {
      const control = styleControls[style.id];
      return {
        ...applyStyleControl(style, control),
        bgImage: style.afterImg,
      };
    })
    .filter((style) => !style.hidden);

  const styleOrder = allStyleCards.reduce<Record<string, number>>((acc, style, index) => {
    acc[style.id] = index;
    return acc;
  }, {});

  const styles = [...allStyleCards].sort((a, b) => {
    const aHasOptions = (STYLE_VARIANTS[a.id]?.length ?? 0) > 1;
    const bHasOptions = (STYLE_VARIANTS[b.id]?.length ?? 0) > 1;

    if (a.popular && b.popular) {
      const usageDiff = (usageCounts?.[b.id] ?? 0) - (usageCounts?.[a.id] ?? 0);
      if (usageDiff !== 0) return usageDiff;
      return styleOrder[a.id] - styleOrder[b.id];
    }
    if (a.popular) return -1;
    if (b.popular) return 1;

    if (aHasOptions && !bHasOptions) return -1;
    if (!aHasOptions && bHasOptions) return 1;

    return styleOrder[a.id] - styleOrder[b.id];
  });
  const showAuditionLab = !isAuditionLoading && isAuditionVisible && isAuditionEnabled;
  const personalColorControl = resolveFeatureControlState(
    styleControls[PERSONAL_COLOR_CONTROL_ID],
    PERSONAL_COLOR_LAB_ENABLED
  );
  const showPersonalColorLab = personalColorControl.is_visible;
  const isPersonalColorEnabled = personalColorControl.is_enabled;
  const showLabSection = showAuditionLab || showPersonalColorLab;

  const scrollToSection = useCallback((section: StudioSectionTab) => {
    const target = section === "cards" ? generalCardsSectionRef.current : labSectionRef.current;
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 112;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSectionTab(section);
  }, []);

  useEffect(() => {
    if (!showLabSection) return;

    const updateActiveSection = () => {
      const threshold = 132;
      const labTop = labSectionRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      setActiveSectionTab(labTop <= threshold ? "lab" : "cards");
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [showLabSection]);

  const handleCardClick = (style: StyleCard) => {
    if (!style.active) {
      showToast(styleControls[style.id]?.is_enabled === false ? "현재 점검 중입니다. 잠시 후 다시 확인해주세요." : "곧 출시됩니다 ✨");
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

  const handlePersonalColorClick = () => {
    if (!isPersonalColorEnabled) {
      showToast("현재 점검 중입니다. 잠시 후 다시 확인해주세요.");
      return;
    }

    router.push("/personal-color");
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
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes tracePulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes traceGlow {
          0%, 100% { opacity: 0.3; transform: scale(0.92); }
          50% { opacity: 0.7; transform: scale(1.18); }
        }
      `}</style>
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

        {/* Header */}
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
            {TRACE_LAB_ENABLED && (
              <Link
                href="/lab/traces"
                aria-label="실험실 흔적 지도"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#6BE2C5]/20 bg-[#071110] shadow-[0_0_20px_rgba(107,226,197,0.14)]"
                style={{ animation: "tracePulse 2.2s ease-in-out infinite" }}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-full border border-[#6BE2C5]/28"
                  style={{ animation: "traceGlow 2.2s ease-in-out infinite" }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/trace-map-trigger.png"
                  alt=""
                  className="relative z-10 h-6 w-6 object-contain"
                  draggable={false}
                />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FFE082]" style={{ animation: "blink 1.3s step-end infinite" }} />
              </Link>
            )}
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
          <style>{`main * { letter-spacing: -1.5%; }`}</style>

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

          {showLabSection && (
            <div className="sticky top-[60px] z-30 mb-5">
              <div className="rounded-[20px] border border-white/8 bg-[#121212]/90 p-1.5 shadow-[0_16px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => scrollToSection("cards")}
                    className={`rounded-[16px] px-4 py-3 text-[14px] font-bold transition-colors ${
                      activeSectionTab === "cards"
                        ? "bg-[#C9571A] text-white"
                        : "bg-transparent text-white/55"
                    }`}
                  >
                    일반 카드
                  </button>
                  <button
                    onClick={() => scrollToSection("lab")}
                    className={`rounded-[16px] px-4 py-3 text-[14px] font-bold transition-colors ${
                      activeSectionTab === "lab"
                        ? "bg-[#C9571A] text-white"
                        : "bg-transparent text-white/55"
                    }`}
                  >
                    실험실
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={generalCardsSectionRef}>
            {/* 스타일 선택 섹션 헤더 */}
            <div className="mb-4">
              <h2 className="text-[20px] font-bold text-[#C9571A]">스타일 선택</h2>
              <p className="text-[18px] font-bold text-white mt-1">원하는 스타일의 카드를 선택해봐요</p>
            </div>

            <div className="flex flex-col gap-3">
              {styles.map((style) => {
                const hasOptions = (STYLE_VARIANTS[style.id]?.length ?? 0) > 1;

                return (
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
                    <div className="flex items-center gap-2 mb-0.5">
                      {hasOptions && (
                        <span className="inline-flex items-center rounded-lg bg-white/14 px-2 py-1 text-[11px] font-extrabold text-white backdrop-blur-md ring-1 ring-white/15">
                          옵션
                        </span>
                      )}
                      <p className="text-[24px] font-bold text-white tracking-tight leading-tight">{style.name}</p>
                    </div>
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
                );
              })}
            </div>
          </div>

          {showLabSection && (
            <>
              <div ref={labSectionRef}>
                {/* 실험실 섹션 헤더 */}
                <div className="mt-8 mb-4">
                  <h2 className="text-[20px] font-bold text-[#C9571A]">실험실</h2>
                  <p className="text-[18px] font-bold text-white mt-1">색다른 AI 기능을 체험해봐요</p>
                </div>

                {showAuditionLab && (
                  <Link href="/audition/intro" className="block mb-4 active:scale-[0.97] transition-transform">
                    <div className="relative rounded-2xl overflow-hidden bg-[#0A0A0A] border border-white/[0.07]" style={{ aspectRatio: '4/3' }}>

                {/* ── 배경: 미묘한 오렌지 코너 글로우 ── */}
                <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 10% 100%, rgba(201,87,26,0.18) 0%, transparent 70%)' }} />

                {/* ── 배경 대형 AUDITION 워터마크 ── */}
                <span
                  className="absolute select-none z-[1] font-unbounded font-black"
                  style={{
                    bottom: '-2%', right: '-4%',
                    fontSize: 'clamp(52px, 16vw, 88px)',
                    lineHeight: 1,
                    letterSpacing: '-3px',
                    color: 'rgba(255,255,255,0.03)',
                    whiteSpace: 'nowrap',
                  }}
                >AUDITION</span>

                {/* ── 상단 레이블 바 ── */}
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
                  <span
                    className="font-unbounded font-medium text-[#C9571A] tracking-[0.18em] uppercase"
                    style={{ fontSize: 'clamp(9px, 2.4vw, 11px)' }}
                  >AI Audition</span>
                  <span className="text-[10px] font-bold text-white/30 border border-white/15 rounded-full px-2.5 py-0.5 tracking-widest uppercase"
                    style={{ fontFamily: '"Unbounded", sans-serif' }}>NEW</span>
                </div>

                {/* ── 메인 타이틀 블록 ── */}
                <div className="absolute z-10 flex flex-col" style={{ top: '28%', left: '6%' }}>
                  <div className="w-6 h-[2px] bg-[#C9571A] mb-3" />
                  <span
                    className="font-unbounded font-bold text-white/40 uppercase tracking-[0.06em] mb-1"
                    style={{ fontSize: 'clamp(10px, 2.6vw, 13px)' }}
                  >Are you an actor?</span>
                  <span
                    className="text-white leading-[0.9]"
                    style={{
                      fontFamily: '"BMKkubulim", sans-serif',
                      fontSize: 'clamp(46px, 14vw, 76px)',
                      letterSpacing: '-1px',
                    }}
                  >AI 오디션</span>
                </div>

                {/* ── 설명 텍스트 ── */}
                <div className="absolute z-10" style={{ top: '68%', left: '6%', right: '6%' }}>
                  <p
                    className="text-white/50 leading-snug"
                    style={{ fontFamily: '"Pretendard", sans-serif', fontSize: 'clamp(11px, 2.8vw, 13px)', fontWeight: 500 }}
                  >
                    장르 선택 · 성향 퀴즈 · 표정 연기<br />
                    <span className="text-white/30">AI 감독이 당신을 심사합니다</span>
                  </p>
                </div>

                {/* ── 바텀 바: 유저 수 + 크레딧 + 화살표 ── */}
                <div className="absolute z-20 flex items-center justify-between" style={{ bottom: '6%', left: '6%', right: '6%' }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1.5 text-white/40 border border-white/10 rounded-full px-2.5 py-1"
                      style={{ fontFamily: '"Pretendard", sans-serif', fontSize: 'clamp(10px, 2.5vw, 12px)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3.2" fill="currentColor" fillOpacity="0.8"/>
                        <path d="M1 15c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      {usageCounts === null ? "..." : formatCount(usageCounts["audition"] ?? 0)}
                    </span>
                    <span
                      className="text-[#C9571A] border border-[#C9571A]/40 rounded-full px-2.5 py-1 font-bold"
                      style={{ fontFamily: '"Unbounded", sans-serif', fontSize: 'clamp(9px, 2.2vw, 11px)' }}
                    >5 Credits</span>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-[#C9571A] flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* ── 오렌지 수직선 장식 (우측) ── */}
                <div className="absolute right-6 z-10" style={{ top: '28%', bottom: '20%', width: '1.5px', background: 'linear-gradient(to bottom, transparent, rgba(201,87,26,0.5), transparent)' }} />

                    </div>
                  </Link>
                )}

                {showPersonalColorLab && (
                  <button
                    type="button"
                    onClick={handlePersonalColorClick}
                    className="block w-full mb-4 text-left active:scale-[0.97] transition-transform"
                  >
                    <div
                      className="relative overflow-hidden rounded-2xl border border-[#DDE4F0]/10 bg-[#0C1018]"
                      style={{ aspectRatio: "4/3" }}
                    >
                    <div
                      className="absolute inset-0 z-0"
                      style={{
                        background: "radial-gradient(circle at 18% 18%, rgba(255,140,118,0.24) 0%, transparent 34%), radial-gradient(circle at 85% 18%, rgba(106,139,255,0.20) 0%, transparent 38%), linear-gradient(160deg, rgba(11,16,26,1) 0%, rgba(17,22,36,1) 100%)",
                      }}
                    />
                    <span
                      className="absolute select-none z-[1] font-unbounded font-black"
                      style={{
                        bottom: "-2%",
                        right: "-4%",
                        fontSize: "clamp(54px, 16vw, 92px)",
                        lineHeight: 1,
                        letterSpacing: "-4px",
                        color: "rgba(255,255,255,0.035)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      COLOR
                    </span>

                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
                      <span
                        className="font-unbounded font-medium tracking-[0.18em] uppercase text-[#8DAEFF]"
                        style={{ fontSize: "clamp(9px, 2.4vw, 11px)" }}
                      >
                        AI Personal Color
                      </span>
                    <span
                        className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white/35 uppercase"
                        style={{ fontFamily: '"Unbounded", sans-serif' }}
                      >
                        {isPersonalColorEnabled ? "FREE" : "PAUSED"}
                      </span>
                    </div>

                    <div className="absolute z-10 flex flex-col" style={{ top: "24%", left: "6%", right: "12%" }}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="h-[2px] w-6 bg-[#8DAEFF]" />
                        <span
                          className="font-unbounded text-white/42 uppercase tracking-[0.08em]"
                          style={{ fontSize: "clamp(10px, 2.6vw, 13px)" }}
                        >
                          Tone Lab
                        </span>
                      </div>
                      <span
                        className="leading-[0.92] text-white"
                        style={{
                          fontFamily: '"BMKkubulim", sans-serif',
                          fontSize: "clamp(44px, 13vw, 72px)",
                          letterSpacing: "-1px",
                        }}
                      >
                        퍼스널 컬러
                      </span>
                    </div>

                    <div className="absolute z-10" style={{ top: "65%", left: "6%", right: "6%" }}>
                      <p
                        className="leading-snug text-white/58"
                        style={{ fontFamily: '"Pretendard", sans-serif', fontSize: "clamp(11px, 2.8vw, 13px)", fontWeight: 500 }}
                      >
                        셀카 한 장으로 웜/쿨, 밝기, 선명도를 추정하고
                        <br />
                        <span className="text-white/34">지금 얼굴에 잘 맞는 StyleDrop 필터까지 바로 추천해드려요</span>
                      </p>
                    </div>

                    <div className="absolute z-20 flex items-center justify-between" style={{ bottom: "6%", left: "6%", right: "6%" }}>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full border border-white/10 px-2.5 py-1 text-white/45"
                          style={{ fontFamily: '"Pretendard", sans-serif', fontSize: "clamp(10px, 2.5vw, 12px)" }}
                        >
                          셀카 1장
                        </span>
                        <span
                          className="rounded-full border border-[#8DAEFF]/40 px-2.5 py-1 font-bold text-[#8DAEFF]"
                          style={{ fontFamily: '"Unbounded", sans-serif', fontSize: "clamp(9px, 2.2vw, 11px)" }}
                        >
                          LIVE LAB
                        </span>
                      </div>

                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#8DAEFF]">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="#0C1018" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>

                    {!isPersonalColorEnabled && (
                      <>
                        <div className="absolute inset-0 bg-[#07101C]/62" />
                        <div className="absolute inset-0 z-30 flex items-center justify-center">
                          <span className="rounded-full border border-white/18 bg-black/35 px-4 py-2 text-[13px] font-bold text-white backdrop-blur-md">
                            현재 점검 중
                          </span>
                        </div>
                      </>
                    )}
                    </div>
                  </button>
                )}

              </div>
            </>
          )}
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
