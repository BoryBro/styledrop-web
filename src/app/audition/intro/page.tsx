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

// ── 실제 카드 이미지 마르퀴 ─────────────────────────────────────
const CARD_IMAGES = [
  "/audition/cards/card-1.png",
  "/audition/cards/card-2.png",
  "/audition/cards/card-3.png",
  "/audition/cards/card-4.png",
  "/audition/cards/card-5.png",
];

function CardMarquee() {
  const doubled = [...CARD_IMAGES, ...CARD_IMAGES];
  return (
    <div className="overflow-hidden w-full relative">
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div
        className="flex gap-4 py-4"
        style={{ animation: "marquee 14s linear infinite", width: "max-content" }}
      >
        {doubled.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt="audition card"
            className="rounded-2xl shadow-xl flex-shrink-0 object-cover"
            style={{ width: 210, height: 290 }}
          />
        ))}
      </div>
    </div>
  );
}

function CardCarousel() {
  const n = CARD_IMAGES.length;
  const CARD_W = 162;
  const GAP = 14;
  const UNIT = CARD_W + GAP;
  // 3벌 복사 → 가운데 벌(n~2n-1)에서 시작, 끝에 다다르면 조용히 리셋
  const all = [...CARD_IMAGES, ...CARD_IMAGES, ...CARD_IMAGES];
  const [pos, setPos] = useState(n);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPos(p => p + 1), 3200);
    return () => clearInterval(t);
  }, []);

  // 마지막 복사본 끝에 도달하면 중간 복사본으로 순간이동 (사용자에게 안 보임)
  useEffect(() => {
    if (pos >= 2 * n) {
      const t = setTimeout(() => {
        setInstant(true);
        setPos(n);
        setTimeout(() => setInstant(false), 32);
      }, 750);
      return () => clearTimeout(t);
    }
  }, [pos, n]);

  const tx = `calc(50vw - ${pos * UNIT + CARD_W / 2}px)`;

  return (
    <div className="w-full overflow-hidden relative" style={{ height: 296 }}>
      <div
        style={{
          display: 'flex',
          gap: GAP,
          alignItems: 'center',
          position: 'absolute',
          top: 0, bottom: 0,
          transition: instant ? 'none' : 'transform 0.72s cubic-bezier(0.33,1,0.68,1)',
          transform: `translateX(${tx})`,
          willChange: 'transform',
        }}
      >
        {all.map((src, i) => {
          const dist = Math.abs(i - pos);
          const isCenter = dist === 0;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt="audition card"
              className="rounded-2xl object-cover flex-shrink-0"
              style={{
                width: CARD_W,
                height: 228,
                opacity: isCenter ? 1 : dist === 1 ? 0.46 : 0.15,
                transform: isCenter ? 'scale(1.12)' : 'scale(0.86)',
                boxShadow: isCenter ? '0 20px 48px rgba(0,0,0,0.3)' : 'none',
                transition: instant ? 'none' : 'opacity 0.6s ease, transform 0.72s cubic-bezier(0.33,1,0.68,1), box-shadow 0.6s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function AuditionIntroPage() {
  const router = useRouter();
  const typed = useTypewriter([
    "AI 오디션",
    "배역을 찾아드려요.",
    "당신의 얼굴이 말해요.",
    "감독이 심사합니다.",
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
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center" style={{ minHeight: '85vh' }}>
        <p className="text-[11px] font-black text-[#C9571A] tracking-[0.3em] uppercase mb-5">관상 × 성향 × 연기 분석</p>

        <div className="h-[80px] flex items-center justify-center">
          <h1 className="text-[31px] text-black leading-none text-center" style={{ fontFamily: '"BMKkubulim", sans-serif' }}>
            {typed}
            <span className="inline-block w-[2px] h-[28px] bg-[#C9571A] ml-1 align-middle" style={{ animation: 'pulse 1s step-end infinite' }} />
          </h1>
        </div>

        <p className="text-[17px] text-gray-600 font-medium mt-6 leading-relaxed max-w-[280px]">
          AI가 당신의 얼굴과 성향을 분석해<br />
          타고난 배역을 찾아드립니다.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["관상 분석", "성향 밸런스 게임", "배역 판정", "캐릭터 카드"].map(tag => (
            <span key={tag} className="text-[12px] font-bold text-gray-500 bg-gray-100 rounded-full px-3 py-1">{tag}</span>
          ))}
        </div>

        {/* 카드 마르퀴 */}
        <div className="mt-12 w-screen -mx-6">
          <CardMarquee />
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
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
          { num: "01", en: "CHOOSE YOUR GENRE",   ko: "장르를 선택하세요",       desc: "액션·로맨스·범죄·공포 등\n10개 장르 중 3개를 고르세요." },
          { num: "02", en: "BALANCE GAME",         ko: "성향 밸런스 게임",        desc: "10가지 선택 질문으로 당신의\n배우 기질과 성향을 파악합니다." },
          { num: "03", en: "FACE ANALYSIS",        ko: "관상 정밀 촬영",          desc: "정면 얼굴 사진을 촬영합니다.\nAI가 눈·코·입·얼굴형을 분석합니다." },
          { num: "04", en: "PERFORM",              ko: "카메라 앞에 서세요",      desc: "씬 지문에 맞게 셀카 3장으로\n연기 표정을 촬영합니다." },
          { num: "05", en: "GET YOUR CHARACTER",   ko: "배역이 판정됩니다",       desc: "관상 분석 + 성향 + 연기력을 종합해\n당신만의 캐릭터 카드를 만들어냅니다." },
        ].map(f => (
          <div key={f.num} className="flex gap-4 items-start">
            <span className="text-[28px] font-black text-gray-200 leading-none flex-shrink-0 w-10 text-right tabular-nums">{f.num}</span>
            <div className="flex-1 border-l-2 pl-4 border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 text-[#C9571A]">{f.en}</p>
              <p className="text-[20px] font-black text-gray-900 leading-tight mb-1.5">{f.ko}</p>
              <p className="text-[14px] text-gray-500 leading-relaxed whitespace-pre-line">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 관상 분석 소개 ──────────────────────────────── */}
      <section className="py-12 flex flex-col gap-6 bg-[#0C0C0C]">
        <style>{`
          @keyframes dot-pulse {
            0%, 100% { opacity: 0.5; r: 3.5; }
            50% { opacity: 1; r: 5.5; }
          }
          @keyframes scan-line {
            0% { transform: translateY(-100px); opacity: 0; }
            20% { opacity: 0.6; }
            80% { opacity: 0.6; }
            100% { transform: translateY(300px); opacity: 0; }
          }
          @keyframes physio-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div className="px-6">
          <p className="text-[11px] font-black text-[#C9571A] uppercase tracking-[0.3em] mb-2">Physiognomy Analysis</p>
          <p className="text-[26px] font-black text-white leading-tight">얼굴에는<br />숨겨진 배역이 있다.</p>
        </div>

        {/* 다크 SVG 얼굴 분석 시각화 */}
        <div className="mx-6 rounded-3xl overflow-hidden bg-[#111] border border-white/10 flex items-center justify-center py-8 relative">
          {/* 배경 글로우 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,87,26,0.12) 0%, transparent 70%)' }} />
          </div>
          <svg width="220" height="270" viewBox="0 0 220 270" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative', zIndex: 1 }}>
            {/* 스캔 라인 */}
            <rect x="38" y="0" width="144" height="2" rx="1" fill="url(#scanGrad)" style={{ animation: 'scan-line 3s ease-in-out infinite' }} />
            <defs>
              <linearGradient id="scanGrad" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="transparent"/>
                <stop offset="50%" stopColor="#C9571A" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="transparent"/>
              </linearGradient>
            </defs>
            {/* 얼굴 윤곽 */}
            <ellipse cx="110" cy="128" rx="78" ry="98" stroke="#C9571A" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="5 4"/>
            <ellipse cx="110" cy="128" rx="60" ry="78" stroke="white" strokeWidth="0.5" strokeOpacity="0.06"/>
            {/* 연결선 */}
            <line x1="110" y1="50" x2="80" y2="103" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.35"/>
            <line x1="110" y1="50" x2="140" y2="103" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.35"/>
            <line x1="80" y1="103" x2="140" y2="103" stroke="#C9571A" strokeWidth="0.6" strokeOpacity="0.25"/>
            <line x1="80" y1="103" x2="110" y2="142" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.35"/>
            <line x1="140" y1="103" x2="110" y2="142" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.35"/>
            <line x1="110" y1="142" x2="93" y2="168" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.3"/>
            <line x1="110" y1="142" x2="127" y2="168" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.3"/>
            <line x1="93" y1="168" x2="110" y2="212" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.25"/>
            <line x1="127" y1="168" x2="110" y2="212" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.25"/>
            <line x1="58" y1="128" x2="80" y2="103" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.2"/>
            <line x1="162" y1="128" x2="140" y2="103" stroke="#C9571A" strokeWidth="0.8" strokeOpacity="0.2"/>
            {/* 핵심 포인트 점들 (애니메이션) */}
            <circle cx="110" cy="50" r="4" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '0s' }}/>
            <circle cx="80" cy="103" r="4" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '0.3s' }}/>
            <circle cx="140" cy="103" r="4" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '0.3s' }}/>
            <circle cx="110" cy="142" r="3.5" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '0.6s' }}/>
            <circle cx="93" cy="168" r="3" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '0.8s' }}/>
            <circle cx="127" cy="168" r="3" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '0.8s' }}/>
            <circle cx="58" cy="128" r="3" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '1s' }}/>
            <circle cx="162" cy="128" r="3" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '1s' }}/>
            <circle cx="110" cy="212" r="3.5" fill="#C9571A" style={{ animation: 'dot-pulse 2.2s ease-in-out infinite', animationDelay: '1.2s' }}/>
            {/* 라벨 */}
            <text x="118" y="48" fontSize="9" fill="#C9571A" fillOpacity="0.8" fontFamily="sans-serif" fontWeight="700">이마</text>
            <text x="40" y="101" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">눈</text>
            <text x="148" y="101" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">눈</text>
            <text x="116" y="140" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">코</text>
            <text x="18" y="130" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">광대</text>
            <text x="166" y="130" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">광대</text>
            <text x="116" y="182" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">입</text>
            <text x="116" y="215" fontSize="9" fill="#9CA3AF" fontFamily="sans-serif">턱</text>
          </svg>
          {/* AI SCANNING 라벨 */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="text-[10px] font-black text-[#C9571A] tracking-[0.3em] uppercase opacity-70">AI SCANNING</span>
          </div>
        </div>

        {[
          { icon: "👁️", title: "눈빛 분석", desc: "눈꼬리 방향·눈빛 강도로 카리스마형인지 감성형인지 판별" },
          { icon: "🦴", title: "얼굴형 판독", desc: "이마·광대·턱의 구조로 타고난 캐릭터 유형 분류" },
          { icon: "🎭", title: "배역 매칭", desc: "8가지 캐릭터 아키타입 중 당신의 얼굴에 가장 잘 맞는 배역 판정" },
        ].map(item => (
          <div key={item.title} className="mx-6 flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
            <span className="text-[24px] flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-[15px] font-black text-white mb-0.5">{item.title}</p>
              <p className="text-[13px] text-white/50 leading-snug">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 밸런스 게임 섹션 ────────────────────────────── */}
      <section className="px-6 py-12 flex flex-col gap-6 bg-gray-50">
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Balance Game</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">당신의 성향이<br />배역을 바꿉니다.</p>
          <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
            얼굴만으로는 알 수 없는 것들이 있어요.<br />
            10가지 선택 질문으로 당신이 주인공형인지, 빌런형인지, 그 사이 어딘가인지 파악합니다.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { cat: "존재감", q: "욕 먹어도 주목받기 vs 칭찬 못 받아도 조용히" },
            { cat: "감정 표현", q: "감정대로 바로 말하기 vs 생각 정리 후 말하기" },
            { cat: "실행", q: "계획 세우고 실행 vs 일단 저지르고 수습" },
          ].map(item => (
            <div key={item.cat} className="bg-white rounded-2xl px-4 py-3.5 border border-gray-100 flex items-center gap-3">
              <span className="text-[10px] font-black text-[#C9571A] tracking-widest uppercase bg-orange-50 rounded-full px-2.5 py-1 flex-shrink-0">{item.cat}</span>
              <p className="text-[13px] text-gray-600 font-medium leading-snug">{item.q}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100">
          <p className="text-[13px] font-bold text-gray-900 mb-1">왜 밸런스 게임을 하나요?</p>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            관상은 겉모습만 봅니다. 하지만 <strong className="text-gray-800 font-black">진짜 배역은 성격에서 나와요.</strong> 감독이 배우를 캐스팅할 때 외모만 보지 않는 것처럼, AI도 <strong className="text-gray-800 font-black">얼굴 + 성향을 함께</strong> 봐야 정확한 배역을 찾아낼 수 있습니다.
          </p>
        </div>
      </section>

      <div className="mx-6 h-px bg-gray-100" />

      {/* ── 카드 쇼케이스 ───────────────────────────────── */}
      <section className="py-12 flex flex-col gap-6">
        <div className="px-6">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Result Cards</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">당신만의 배역<br />캐릭터 카드가<br />만들어집니다.</p>
        </div>
        <CardCarousel />
        <p className="px-6 text-[12px] text-gray-400 font-medium">* 실제 결과는 본인 사진 기반으로 제작됩니다</p>
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
              { icon: "📸", text: "한번 촬영한 컷은 다시 찍을 수 없으니 이점 유의해주세요" },
              { icon: "💳", text: "크레딧 5개가 소모되며, 이 서비스는 환불이 어렵습니다" },
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
            5크레딧
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
