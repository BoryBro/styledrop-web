"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ── 타이핑 훅 ──────────────────────────────────────────────────
function useTypewriter(lines: string[], speed = 60, pause = 1600) {
  const [display, setDisplay] = useState("");
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = lines[lineIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < current.length) {
      timeout = setTimeout(() => setCharIdx(c => c + 1), speed);
    } else if (!deleting && charIdx === current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx(c => c - 1), speed / 2);
    } else {
      setDeleting(false);
      setLineIdx(i => (i + 1) % lines.length);
    }

    setDisplay(current.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, lineIdx, lines, pause, speed]);

  return display;
}

// ── 카드 데이터 ─────────────────────────────────────────────────
const CARDS = [
  { genre: "THE METHOD\nACTOR",    color: "#C84B31", accent: "#E8614A", rot: -8,  x: -12, z: 1 },
  { genre: "BORN\nVILLAIN",        color: "#2D6A4F", accent: "#40916C", rot:  5,  x:  18, z: 3 },
  { genre: "THE ROMANTIC\nLEAD",   color: "#E9C46A", accent: "#F4A261", rot: -3,  x: -6,  z: 5 },
  { genre: "DARK\nHORSE",          color: "#3D405B", accent: "#5C6292", rot:  9,  x:  14, z: 2 },
  { genre: "SCENE\nSTEALER",       color: "#C9571A", accent: "#E8723A", rot: -6,  x: -18, z: 4 },
];

const STATS = [
  { label: "ACTING SCORE",    value: "——" },
  { label: "SCREEN PRESENCE", value: "——" },
  { label: "AUDIENCE RATING", value: "——" },
];

function AuditionCard({ genre, color, accent, rot, x }: typeof CARDS[0]) {
  return (
    <div
      className="relative rounded-[16px] overflow-hidden flex-shrink-0 shadow-xl"
      style={{
        width: 160, height: 224,
        transform: `rotate(${rot}deg) translateX(${x}px)`,
        background: color,
        boxShadow: `4px 6px 24px rgba(0,0,0,0.22)`,
      }}
    >
      {/* 장르 라벨 */}
      <div className="px-3 pt-3 pb-2" style={{ background: accent }}>
        <p className="text-white font-black text-[13px] leading-tight uppercase whitespace-pre-line" style={{ letterSpacing: '0.04em' }}>{genre}</p>
      </div>
      {/* 사진 영역 플레이스홀더 */}
      <div className="mx-2 mt-2 rounded-lg overflow-hidden flex items-center justify-center" style={{ height: 110, background: 'rgba(0,0,0,0.25)' }}>
        <span className="text-[32px]">🎬</span>
      </div>
      {/* 스탯 테이블 */}
      <div className="px-2 pt-2 flex flex-col gap-0.5">
        {STATS.map(s => (
          <div key={s.label} className="flex items-center justify-between border-b border-white/10 pb-0.5">
            <span className="text-[7px] font-bold text-white/60 uppercase tracking-wide">{s.label}</span>
            <span className="text-[8px] font-black text-white/40">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function AuditionIntroPage() {
  const router = useRouter();
  const typed = useTypewriter([
    "CAN YOU ACT?",
    "PROVE IT.",
    "ONE TAKE ONLY.",
    "ARE YOU THE ONE?",
  ], 65, 1800);

  // 스크롤 끝에 도달하면 버튼 표시
  const [showCta, setShowCta] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShowCta(true); },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center" style={{ minHeight: '80vh' }}>
        {/* 상단 배지 */}
        <div className="mb-6 inline-flex items-center gap-2 bg-black text-white rounded-full px-4 py-1.5">
          <span className="text-[10px] font-black tracking-[0.25em] uppercase">AI Audition</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9571A]" />
          <span className="text-[10px] font-black tracking-[0.25em] uppercase">Beta</span>
        </div>

        {/* 타이핑 헤드라인 */}
        <h1 className="text-[48px] font-black text-black leading-none tracking-tighter mb-2 min-h-[56px]">
          {typed}
          <span className="inline-block w-[3px] h-[44px] bg-[#C9571A] ml-1 align-middle animate-pulse" />
        </h1>

        {/* 서브 */}
        <p className="text-[16px] text-gray-500 font-medium mt-4 leading-relaxed max-w-xs">
          AI가 당신의 표정과 감정을<br />분석해 연기 점수를 매깁니다.
        </p>

        {/* 스크롤 힌트 */}
        <div className="mt-12 flex flex-col items-center gap-2 opacity-40">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">scroll</span>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
            <rect x="6.5" y="1" width="3" height="6" rx="1.5" fill="#999"/>
            <rect x="7" y="10" width="2" height="4" rx="1" fill="#999" className="animate-bounce"/>
            <path d="M4 19l4 4 4-4" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* ── FEATURE 설명 ──────────────────────────────────── */}
      <section className="px-6 py-12 flex flex-col gap-10 bg-white">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">How it works</p>

        {[
          { num: "01", en: "CHOOSE YOUR GENRE", ko: "장르를 선택하세요", desc: "액션, 로맨스, 범죄, 공포…\n당신이 도전할 씬을 고르세요." },
          { num: "02", en: "GET YOUR CUE",       ko: "씬 지문을 받아요",   desc: "AI가 장르에 맞는 연기 상황을\n실시간으로 제시합니다." },
          { num: "03", en: "PERFORM",             ko: "카메라 앞에 서세요", desc: "셀카 3장으로\n당신의 연기를 표현하세요." },
          { num: "04", en: "GET SCORED",          ko: "점수가 매겨집니다",  desc: "AI가 표정·감정·몰입도를 분석해\n당신만의 캐릭터 카드를 생성합니다." },
        ].map(f => (
          <div key={f.num} className="flex gap-5 items-start">
            <span className="text-[32px] font-black text-gray-100 leading-none flex-shrink-0 w-10 text-center">{f.num}</span>
            <div>
              <p className="text-[10px] font-black text-[#C9571A] uppercase tracking-widest mb-0.5">{f.en}</p>
              <p className="text-[20px] font-black text-black leading-tight mb-1">{f.ko}</p>
              <p className="text-[14px] text-gray-400 leading-relaxed whitespace-pre-line">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── 구분선 ── */}
      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 카드 쇼케이스 ─────────────────────────────────── */}
      <section className="py-14 flex flex-col gap-6">
        <div className="px-6">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] mb-1">Result Cards</p>
          <p className="text-[24px] font-black text-black leading-tight">당신의 캐릭터 카드가<br />만들어집니다.</p>
        </div>

        {/* 카드 스크롤 영역 */}
        <div className="relative overflow-x-auto px-6 pb-6" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-4 items-end" style={{ width: 'max-content' }}>
            {CARDS.map((card, i) => (
              <AuditionCard key={i} {...card} />
            ))}
          </div>
        </div>

        <p className="px-6 text-[12px] text-gray-300 font-medium">
          * 카드 디자인은 실제 결과와 다를 수 있습니다
        </p>
      </section>

      {/* ── 하단 텍스트 마커 ─────────────────────────────── */}
      <section className="px-6 py-16 flex flex-col gap-3">
        {[
          "LIGHTS · CAMERA · YOU",
          "AI-POWERED ACTING ANALYSIS",
          "REAL EMOTION · REAL RESULTS",
          "NO SCRIPT · NO REHEARSAL",
          "YOUR PERFORMANCE · SCORED",
        ].map((text, i) => (
          <p
            key={i}
            className="text-[22px] font-black leading-tight"
            style={{
              color: i % 2 === 0 ? '#000' : 'transparent',
              WebkitTextStroke: i % 2 !== 0 ? '1.5px #e5e5e5' : undefined,
              letterSpacing: '-0.5px',
            }}
          >
            {text}
          </p>
        ))}
      </section>

      {/* ── IntersectionObserver 트리거 ── */}
      <div ref={bottomRef} className="h-1" />

      {/* ── 시작하기 버튼 (스크롤 끝 도달 시 등장) ──────── */}
      <div
        className="sticky bottom-0 px-6 pb-8 pt-4 bg-gradient-to-t from-white via-white to-transparent transition-all duration-500"
        style={{ opacity: showCta ? 1 : 0, transform: showCta ? 'translateY(0)' : 'translateY(24px)', pointerEvents: showCta ? 'auto' : 'none' }}
      >
        <button
          onClick={() => router.push("/audition/solo")}
          className="w-full bg-black text-white font-black text-[16px] py-4 rounded-2xl tracking-wide flex items-center justify-center gap-3 active:scale-[0.97] transition-transform"
        >
          <span>시작하기</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2 font-medium">3크레딧 소모 · 약 2분 소요</p>
      </div>

    </main>
  );
}
