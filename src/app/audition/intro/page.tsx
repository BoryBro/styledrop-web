"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── 타이핑 훅 ──────────────────────────────────────────────────
function useTypewriter(lines: string[], speed = 60, pause = 1800) {
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
  { genre: "THE METHOD\nACTOR",  color: "#C84B31", accent: "#E8614A", rot: -7,  x: -8 },
  { genre: "BORN\nVILLAIN",      color: "#1B4332", accent: "#2D6A4F", rot:  5,  x:  12 },
  { genre: "ROMANTIC\nLEAD",     color: "#B5882A", accent: "#D4A734", rot: -2,  x: -4 },
  { genre: "DARK\nHORSE",        color: "#2C2C54", accent: "#3D3D7A", rot:  8,  x:  16 },
  { genre: "SCENE\nSTEALER",     color: "#7B2D00", accent: "#C9571A", rot: -5,  x: -14 },
];
const STATS = ["ACTING SCORE", "SCREEN PRESENCE", "AUDIENCE RATING"];

function AuditionCard({ genre, color, accent, rot, x }: typeof CARDS[0]) {
  return (
    <div
      className="relative rounded-[18px] overflow-hidden flex-shrink-0 shadow-2xl"
      style={{ width: 160, height: 230, transform: `rotate(${rot}deg) translateX(${x}px)`, background: color }}
    >
      <div className="px-3 pt-3 pb-2.5" style={{ background: accent }}>
        <p className="text-white font-black text-[12px] leading-tight uppercase whitespace-pre-line tracking-wide">{genre}</p>
      </div>
      <div className="mx-2 mt-2 rounded-lg flex items-center justify-center" style={{ height: 112, background: 'rgba(0,0,0,0.3)' }}>
        <span className="text-[36px]">🎬</span>
      </div>
      <div className="px-2.5 pt-2 flex flex-col gap-1">
        {STATS.map(s => (
          <div key={s} className="flex items-center justify-between border-b border-white/10 pb-0.5">
            <span className="text-[6.5px] font-bold text-white/50 uppercase tracking-wide">{s}</span>
            <span className="text-[8px] font-black text-white/30">——</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditionIntroPage() {
  const router = useRouter();
  const typed = useTypewriter([
    "CAN YOU ACT?",
    "PROVE IT.",
    "ONE TAKE ONLY.",
    "ARE YOU THE ONE?",
  ], 65, 1800);

  const [agreed, setAgreed] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShowCta(true); },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-white flex flex-col pb-32">

      {/* ── 헤더 ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center justify-between px-5 h-14">
        <Link href="/studio" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[14px] font-semibold">돌아가기</span>
        </Link>
        <div className="flex items-center gap-1.5 bg-black rounded-full px-3 py-1">
          <span className="text-[9px] font-black text-white tracking-[0.2em] uppercase">AI Audition</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9571A]" />
          <span className="text-[9px] font-black text-gray-400 tracking-[0.2em] uppercase">Beta</span>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-20 text-center" style={{ minHeight: '85vh' }}>
        <p className="text-[11px] font-black text-[#C9571A] tracking-[0.3em] uppercase mb-5">관상 × 연기 분석</p>

        <h1 className="text-[52px] font-black text-black leading-none tracking-tighter min-h-[62px]">
          {typed}
          <span className="inline-block w-[3px] h-[46px] bg-[#C9571A] ml-1.5 align-middle" style={{ animation: 'pulse 1s step-end infinite' }} />
        </h1>

        <p className="text-[17px] text-gray-600 font-medium mt-6 leading-relaxed max-w-[280px]">
          AI가 당신의 얼굴을 관상학으로 분석하고,<br />
          타고난 배역을 찾아드립니다.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["관상 분석", "배역 판정", "연기 채점", "캐릭터 카드"].map(tag => (
            <span key={tag} className="text-[12px] font-bold text-gray-500 bg-gray-100 rounded-full px-3 py-1">{tag}</span>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">scroll</span>
          <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
            <rect x="5.5" y="1" width="3" height="5" rx="1.5" fill="#d1d5db"/>
            <path d="M3 14l4 5 4-5" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="px-6 py-12 flex flex-col gap-8 bg-white">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">How it works</p>
        {[
          { num: "01", en: "CHOOSE YOUR GENRE",   ko: "장르를 선택하세요",  desc: "액션·로맨스·범죄·공포 등\n10개 장르 중 3개를 고르세요." },
          { num: "02", en: "GET YOUR CUE",         ko: "씬 지문을 받아요",   desc: "AI가 장르에 맞는 연기 상황을\n촬영 직전에 공개합니다." },
          { num: "03", en: "PERFORM",              ko: "카메라 앞에 서세요", desc: "셀카 3장으로 당신의 연기와\n표정을 표현하세요." },
          { num: "04", en: "GET YOUR CHARACTER",   ko: "배역이 판정됩니다",  desc: "AI가 관상 분석 + 연기력을 종합해\n당신만의 캐릭터 카드를 만들어냅니다." },
        ].map(f => (
          <div key={f.num} className="flex gap-4 items-start">
            <span className="text-[28px] font-black text-gray-200 leading-none flex-shrink-0 w-10 text-right tabular-nums">{f.num}</span>
            <div className="flex-1 border-l-2 border-gray-100 pl-4">
              <p className="text-[10px] font-black text-[#C9571A] uppercase tracking-widest mb-0.5">{f.en}</p>
              <p className="text-[20px] font-black text-gray-900 leading-tight mb-1.5">{f.ko}</p>
              <p className="text-[14px] text-gray-500 leading-relaxed whitespace-pre-line">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 관상 분석 소개 ──────────────────────────────── */}
      <section className="px-6 py-12 flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Physiognomy Analysis</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">얼굴에는<br />숨겨진 배역이 있다.</p>
        </div>
        {[
          { icon: "👁️", title: "눈빛 분석", desc: "눈꼬리 방향·눈빛 강도로 카리스마형인지 감성형인지 판별" },
          { icon: "🦴", title: "얼굴형 판독", desc: "이마·광대·턱의 구조로 타고난 캐릭터 유형 분류" },
          { icon: "🎭", title: "배역 매칭", desc: "8가지 캐릭터 아키타입 중 당신의 얼굴에 가장 잘 맞는 배역 판정" },
        ].map(item => (
          <div key={item.title} className="flex items-start gap-4 bg-gray-50 rounded-2xl px-5 py-4">
            <span className="text-[24px] flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-[15px] font-black text-gray-900 mb-0.5">{item.title}</p>
              <p className="text-[13px] text-gray-500 leading-snug">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 카드 쇼케이스 ───────────────────────────────── */}
      <section className="py-12 flex flex-col gap-6">
        <div className="px-6">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Result Cards</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">당신만의 캐릭터<br />카드가 만들어집니다.</p>
        </div>
        <div className="overflow-x-auto px-6 pb-4" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-3 items-end" style={{ width: 'max-content' }}>
            {CARDS.map((card, i) => <AuditionCard key={i} {...card} />)}
          </div>
        </div>
        <p className="px-6 text-[12px] text-gray-400 font-medium">* 카드 디자인은 실제 결과와 다를 수 있습니다</p>
      </section>

      {/* ── 텍스트 마커 ─────────────────────────────────── */}
      <section className="px-6 py-12 flex flex-col gap-3">
        {[
          { text: "LIGHTS · CAMERA · YOU",         fill: true  },
          { text: "FACE READING × AI ANALYSIS",    fill: false },
          { text: "REAL EMOTION · REAL RESULTS",   fill: true  },
          { text: "YOUR CHARACTER · REVEALED",     fill: false },
          { text: "ONE TAKE · ONE TRUTH",           fill: true  },
        ].map((item, i) => (
          <p
            key={i}
            className="text-[21px] font-black leading-tight"
            style={{
              color: item.fill ? '#111' : 'transparent',
              WebkitTextStroke: item.fill ? undefined : '1.5px #d1d5db',
              letterSpacing: '-0.5px',
            }}
          >
            {item.text}
          </p>
        ))}
      </section>

      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 오디션 전 확인사항 ──────────────────────────── */}
      <section className="px-6 py-12 flex flex-col gap-5">
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Before You Start</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">시작 전에<br />꼭 확인하세요.</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4">
          <span className="text-[28px] flex-shrink-0">🎭</span>
          <div>
            <p className="text-[15px] font-bold text-gray-900 leading-snug">미션 큐는 촬영 직전에 공개됩니다</p>
            <p className="text-[12px] text-gray-400 mt-0.5">장르만 선택하고, 실제 연기 상황은 카메라 앞에서 확인하세요</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5 flex flex-col gap-4">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em]">오디션 전 확인사항</p>
          <ul className="flex flex-col gap-4">
            {[
              { icon: "🌶️", text: "매운맛/순한맛에 따라 평가 강도가 달라집니다. 상처받지 말고 재미로 봐주세요" },
              { icon: "📸", text: "한번 촬영한 컷은 다시 찍을 수 없으니 이점 유의해주세요" },
              { icon: "💳", text: "크레딧 3개가 소모되며, 이 서비스는 환불이 어렵습니다" },
            ].map(item => (
              <li key={item.icon} className="flex items-start gap-3">
                <span className="text-[18px] flex-shrink-0 mt-0.5">{item.icon}</span>
                <p className="text-[14px] text-gray-600 leading-relaxed">{item.text}</p>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-3 mt-2 cursor-pointer select-none" onClick={() => setAgreed(v => !v)}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${agreed ? "bg-black border-black scale-110" : "border-gray-300 bg-white"}`}>
              {agreed && <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1.5 5.5l3.5 3.5L11.5 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <p className="text-[15px] font-bold text-gray-900">위 내용을 모두 확인했습니다</p>
          </label>
        </div>
      </section>

      {/* IntersectionObserver 트리거 */}
      <div ref={bottomRef} className="h-1" />

      {/* ── 시작하기 CTA ────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent transition-all duration-500 z-50"
        style={{ opacity: showCta ? 1 : 0, transform: showCta ? 'translateY(0)' : 'translateY(20px)', pointerEvents: showCta ? 'auto' : 'none' }}
      >
        <button
          onClick={() => router.push("/audition/solo?from_intro=1")}
          disabled={!agreed}
          className="w-full py-4 rounded-2xl font-black text-[17px] flex items-center justify-center gap-3 transition-all active:scale-[0.97]"
          style={{
            background: agreed ? '#000' : '#f3f4f6',
            color: agreed ? '#fff' : '#9ca3af',
          }}
        >
          <span
            className="text-[12px] font-extrabold px-2.5 py-1 rounded-lg"
            style={{ background: agreed ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }}
          >
            3크레딧
          </span>
          시작하기
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {!agreed && (
          <p className="text-center text-[12px] text-gray-400 mt-2 font-medium">위 확인사항에 동의 후 시작할 수 있어요</p>
        )}
        {agreed && (
          <p className="text-center text-[12px] text-gray-400 mt-2 font-medium">약 2분 소요 · 관상 분석 + 연기 채점</p>
        )}
      </div>

    </main>
  );
}
