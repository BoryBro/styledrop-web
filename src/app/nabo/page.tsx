"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── 팔레트 ────────────────────────────────────────────────────────
const G = { bg: "#F0FDF4", border: "#BBF7D0", light: "#DCFCE7", mid: "#22C55E", dark: "#16A34A", text: "#15803D", deep: "#166534" } as const;

// ── 타입 ─────────────────────────────────────────────────────────
type Step = "intro" | "setup" | "link" | "waiting" | "questions" | "results";
type AnsMap = Record<string, string | number>;

const EXTRA = "기타 (직접 입력) ✏️";
const LOCK_MS = 24 * 60 * 60 * 1000;
const UNLOCK_CREDITS = 5;

// ── 12문항 정의 ───────────────────────────────────────────────────
const QS = [
  {
    id: "q0", emoji: "👀", short: "첫인상",
    text: (n: string) => `${n}의 첫인상은?`,
    type: "choice" as const,
    options: ["따뜻하고 포근해 ☀️", "시크하고 쿨해 ❄️", "밝고 에너지 넘쳐 ⚡", "조용하고 신비로워 🌙", "웃기고 유쾌해 😂", "카리스마 있어 🔥"],
  },
  {
    id: "q1", emoji: "💎", short: "핵심 매력",
    text: (n: string) => `${n}의 가장 강한 매력은?`,
    type: "choice" as const,
    options: ["외모 / 스타일", "말솜씨 / 유머감각", "배려심 / 따뜻함", "능력 / 실력", "자신감 / 존재감", "순수함 / 솔직함"],
  },
  {
    id: "q2", emoji: "😅", short: "아쉬운 점",
    text: (n: string) => `솔직히 ${n}의 은근 거슬리는 점은?`,
    type: "text" as const,
    placeholder: "솔직하게 써줘 👀 (너무 심한 말 제외)",
  },
  {
    id: "q3", emoji: "🎯", short: "케미 점수",
    text: (n: string) => `나와 ${n}의 케미 점수는?`,
    type: "slider" as const,
    labels: ["전혀 안 맞아", "완벽한 케미"] as [string, string],
  },
  {
    id: "q4", emoji: "🌟", short: "의외의 매력",
    text: (n: string) => `${n}이 모르는 자신의 의외의 매력은?`,
    type: "text" as const,
    placeholder: "직접 말하기 어려웠던 것을 여기서 전해줘",
  },
  {
    id: "q5", emoji: "😤", short: "화낼 때",
    text: (n: string) => `${n}이 화가 났을 때 어떨 것 같아?`,
    type: "choice" as const,
    options: ["혼자 조용히 삭히는 타입", "바로 직접 말하는 타입", "냉랭하게 거리 두는 타입", "표정만으로 다 티나는 타입", "한참 후에 한 번에 터지는 타입"],
  },
  {
    id: "q6", emoji: "💘", short: "연애 스타일",
    text: (n: string) => `${n}의 연애 스타일은?`,
    type: "choice" as const,
    options: ["다정다감한 표현형 💌", "묵묵히 챙겨주는 행동형 🤲", "자유롭고 쿨한 독립형 🕊️", "올인하는 열정형 🔥", "아직 잘 모르겠어"],
  },
  {
    id: "q7", emoji: "😂", short: "재미 지수",
    text: (n: string) => `솔직히 ${n}의 재미 지수는?`,
    type: "slider" as const,
    labels: ["개노잼", "개꿀잼"] as [string, string],
  },
  {
    id: "q8", emoji: "✉️", short: "익명 한마디",
    text: (n: string) => `${n}께 익명으로 하고 싶은 말은?`,
    type: "text" as const,
    placeholder: "용기 내서 한마디만 남겨줘 (욕설 제외)",
  },
  {
    id: "q9", emoji: "🐾", short: "동물 유형",
    text: (n: string) => `${n}을 동물에 비유하면?`,
    type: "choice" as const,
    options: ["강아지 🐶 (충성·애교)", "고양이 🐱 (도도·독립적)", "토끼 🐰 (순수·귀여움)", "사자 🦁 (카리스마·리더십)", "판다 🐼 (희귀·유니크)", "여우 🦊 (영리·매력적)"],
  },
  {
    id: "q10", emoji: "🎭", short: "드라마 캐릭터",
    text: (n: string) => `드라마 속 ${n}은 어떤 유형이야?`,
    type: "choice" as const,
    options: ["주인공형 (항상 중심에 있어)", "서브 주인공형 (조연인데 더 매력적)", "빌런형 (매력 있는 반전)", "힐링형 (보기만 해도 편안해)", "미스터리형 (뭔가 더 있어 보여)"],
  },
  {
    id: "q11", emoji: "💫", short: "친밀도",
    text: (n: string) => `${n}와 나의 친밀도는?`,
    type: "slider" as const,
    labels: ["거의 모르는 사이", "평생 찐친"] as [string, string],
  },
];

// ── 시뮬레이션 응답 5개 ───────────────────────────────────────────
const MOCK: AnsMap[] = [
  { q0: "밝고 에너지 넘쳐 ⚡", q1: "말솜씨 / 유머감각", q2: "가끔 텐션이 좀 높음", q3: 82, q4: "웃을 때 눈이 진짜 예뻐", q5: "혼자 조용히 삭히는 타입", q6: "묵묵히 챙겨주는 행동형 🤲", q7: 88, q8: "있어줘서 고마워", q9: "강아지 🐶 (충성·애교)", q10: "주인공형 (항상 중심에 있어)", q11: 78 },
  { q0: "따뜻하고 포근해 ☀️",  q1: "배려심 / 따뜻함",   q2: "너무 많이 배려해서 오히려 미안함", q3: 91, q4: "조용히 먼저 챙겨주는 거", q5: "표정만으로 다 티나는 타입", q6: "다정다감한 표현형 💌",    q7: 74, q8: "네 옆에 있으면 편해",   q9: "판다 🐼 (희귀·유니크)",     q10: "힐링형 (보기만 해도 편안해)", q11: 88 },
  { q0: "밝고 에너지 넘쳐 ⚡", q1: "말솜씨 / 유머감각", q2: "약속 시간 가끔 늦음",         q3: 76, q4: "진지할 때 완전 다른 사람 같음", q5: "바로 직접 말하는 타입",      q6: "자유롭고 쿨한 독립형 🕊️", q7: 95, q8: "같이 있으면 시간 빨리 감", q9: "강아지 🐶 (충성·애교)",     q10: "주인공형 (항상 중심에 있어)", q11: 82 },
  { q0: "조용하고 신비로워 🌙", q1: "순수함 / 솔직함",   q2: "처음에 다가가기 좀 어려웠음",  q3: 68, q4: "알고 보면 진짜 재밌음",         q5: "냉랭하게 거리 두는 타입",    q6: "묵묵히 챙겨주는 행동형 🤲", q7: 72, q8: "더 친해지고 싶다",      q9: "고양이 🐱 (도도·독립적)",   q10: "서브 주인공형 (조연인데 더 매력적)", q11: 65 },
  { q0: "시크하고 쿨해 ❄️",    q1: "자신감 / 존재감",   q2: "완벽주의 성향이 가끔 부담됨",  q3: 74, q4: "뒤에서 말없이 도와주는 거",       q5: "혼자 조용히 삭히는 타입",    q6: "올인하는 열정형 🔥",        q7: 80, q8: "겉이랑 속이 많이 달라서 놀람", q9: "여우 🦊 (영리·매력적)", q10: "미스터리형 (뭔가 더 있어 보여)", q11: 70 },
];

// ── 집계 ─────────────────────────────────────────────────────────
const avg = (key: string, rs: AnsMap[]) => {
  const ns = rs.map(r => Number(r[key])).filter(n => !isNaN(n) && n > 0);
  return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0;
};
const top = (key: string, rs: AnsMap[]) => {
  const cnt: Record<string, number> = {};
  rs.forEach(r => { const v = String(r[key] || ""); if (v) cnt[v] = (cnt[v] || 0) + 1; });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]);
};
const texts = (key: string, rs: AnsMap[]) => rs.map(r => String(r[key] || "")).filter(Boolean);

// ── 시간 포맷 ─────────────────────────────────────────────────────
const fmtCountdown = (ms: number) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ── ScoreRing ─────────────────────────────────────────────────────
function ScoreRing({ score, size = 130, color = G.mid }: { score: number; size?: number; color?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let c = 0; const step = score / 60;
    const t = setInterval(() => { c = Math.min(c + step, score); setShown(Math.round(c)); if (c >= score) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [score]);
  const R = size * 0.37; const circ = 2 * Math.PI * R; const cx = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#E5E7EB" strokeWidth="9" />
        <circle cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (shown / 100) * circ} transform={`rotate(-90 ${cx} ${cx})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-gray-900 leading-none" style={{ fontSize: size * 0.26 }}>{shown}</span>
        <span className="font-bold text-gray-400" style={{ fontSize: size * 0.09 }}>/ 100</span>
      </div>
    </div>
  );
}

// ── BarRow ────────────────────────────────────────────────────────
function BarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12px]">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-black" style={{ color: G.mid }}>{count}명 ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: G.mid, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════════
export default function NaboPage() {
  const [step, setStep]               = useState<Step>("intro");
  const [stepHistory, setStepHistory] = useState<Step[]>(["intro"]);
  const [myName, setMyName]           = useState("");
  const [agreed, setAgreed]           = useState(false);
  const [copied, setCopied]           = useState(false);
  const [createdAt, setCreatedAt]     = useState<number>(0);
  const [responses, setResponses]     = useState<AnsMap[]>([]);
  const [qIdx, setQIdx]               = useState(0);
  const [curAns, setCurAns]           = useState<string | number>("");
  const [customAns, setCustomAns]     = useState("");
  const [slider, setSlider]           = useState(50);
  const [curResp, setCurResp]         = useState<AnsMap>({});
  const [now, setNow]                 = useState(Date.now());
  const [unlocked, setUnlocked]       = useState(false);

  // ── 1초 ticker ───────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── localStorage 복원 ─────────────────────────────────────────
  useEffect(() => {
    try {
      const n  = localStorage.getItem("nabo_name");
      const at = localStorage.getItem("nabo_created_at");
      const rs = localStorage.getItem("nabo_responses");
      const st = localStorage.getItem("nabo_step") as Step | null;
      const ul = localStorage.getItem("nabo_unlocked");
      if (n)  setMyName(n);
      if (at) setCreatedAt(Number(at));
      if (rs) { try { setResponses(JSON.parse(rs)); } catch {} }
      if (st && st !== "intro") { setStep(st); setStepHistory(["intro", st]); }
      if (ul === "1") setUnlocked(true);
    } catch {}
  }, []);

  // ── 응답 저장 ─────────────────────────────────────────────────
  useEffect(() => {
    if (responses.length > 0) {
      try { localStorage.setItem("nabo_responses", JSON.stringify(responses)); } catch {}
    }
  }, [responses]);

  const timeLeft = createdAt ? Math.max(0, LOCK_MS - (now - createdAt)) : LOCK_MS;
  const canSeeResults = timeLeft === 0 && responses.length >= 1;

  const goTo = useCallback((s: Step) => {
    setStepHistory(h => [...h, s]);
    setStep(s);
    try { localStorage.setItem("nabo_step", s); } catch {}
  }, []);

  const goBack = () => {
    const h = [...stepHistory];
    h.pop();
    const prev = h[h.length - 1] ?? "intro";
    setStepHistory(h);
    setStep(prev);
  };

  const createRoom = () => {
    const at = Date.now();
    setCreatedAt(at);
    try {
      localStorage.setItem("nabo_name", myName);
      localStorage.setItem("nabo_created_at", String(at));
    } catch {}
    goTo("link");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://styledrop.cloud/nabo?room=${Math.random().toString(36).slice(2, 8)}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleUnlock = () => {
    // 실제 결제 연동 전 임시: 바로 해금
    setUnlocked(true);
    try { localStorage.setItem("nabo_unlocked", "1"); } catch {}
  };

  // ── 질문 진행 ─────────────────────────────────────────────────
  const Q = QS[qIdx];
  const isSlider  = Q?.type === "slider";
  const isExtra   = curAns === EXTRA;
  const effectiveAns = isSlider ? slider : isExtra ? customAns : curAns;
  const canNext = isSlider ? true : isExtra ? customAns.trim().length > 0 : String(curAns).trim().length > 0;

  const advance = () => {
    const stored = isExtra ? (customAns.trim() || "기타") : effectiveAns;
    const updated = { ...curResp, [Q.id]: stored };
    setCurResp(updated);
    if (qIdx < QS.length - 1) {
      setQIdx(i => i + 1);
      setCurAns(""); setCustomAns(""); setSlider(50);
    } else {
      setResponses(rs => [...rs, updated]);
      setCurResp({}); setQIdx(0); setCurAns(""); setCustomAns(""); setSlider(50);
      goTo("waiting");
    }
  };

  const simulateAll = (skipTime = false) => {
    const needed = MOCK.slice(0, Math.max(0, 5 - responses.length));
    setResponses(rs => [...rs, ...needed]);
    if (skipTime) setCreatedAt(Date.now() - LOCK_MS - 1000);
    goTo("results");
  };

  // ── getOptions helper ─────────────────────────────────────────
  const getOptions = (q: typeof QS[0]) => {
    if (q.type !== "choice") return [];
    return [...((q as { options?: string[] }).options ?? []), EXTRA];
  };

  const getPlaceholder = (q: typeof QS[0]) =>
    q.type === "text" ? ((q as { placeholder?: string }).placeholder ?? "") : "";

  // ── Results data ──────────────────────────────────────────────
  const R           = responses.length ? responses : MOCK;
  const chemAvg     = avg("q3", R);
  const funAvg      = avg("q7", R);
  const intimAvg    = avg("q11", R);
  const overallScore = Math.round((chemAvg + funAvg + intimAvg) / 3);
  const topDrama    = top("q10", R)[0]?.[0] ?? "";
  const imprDist    = top("q0", R);
  const charmDist   = top("q1", R);
  const topAnimal   = top("q9", R)[0]?.[0] ?? "";
  const topAnger    = top("q5", R)[0]?.[0] ?? "";
  const topDating   = top("q6", R)[0]?.[0] ?? "";
  const messages    = texts("q8", R);
  const charms      = texts("q4", R);
  const annoyances  = texts("q2", R);

  // ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white flex flex-col" style={{ fontFamily: '"Pretendard", "SUIT Variable", sans-serif' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center justify-between px-5 h-14">
        {step === "intro" ? (
          <Link href="/studio" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-[14px] font-semibold">돌아가기</span>
          </Link>
        ) : (
          <button onClick={goBack} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-[14px] font-semibold">이전</span>
          </button>
        )}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
          <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: G.text }}>내가 보는 너</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: G.mid }} />
          <span className="text-[9px] font-black text-gray-400 tracking-[0.2em] uppercase">Beta</span>
        </div>
      </header>

      {/* ════════════════════ INTRO ════════════════════ */}
      {step === "intro" && (
        <div className="flex flex-col pb-36">
          <section className="flex flex-col items-center px-6 pt-14 pb-8 text-center">
            <div className="relative mb-10 flex items-center justify-center" style={{ height: 100 }}>
              {["😊","😏","🤩","🧐","😌"].map((em, i) => {
                const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
                const r = 38;
                return (
                  <div key={i} className="absolute w-11 h-11 rounded-full flex items-center justify-center text-[18px] shadow-sm"
                    style={{ transform: `translate(${Math.cos(a)*r}px, ${Math.sin(a)*r}px)`, background: G.bg, border: `1.5px solid ${G.border}` }}>
                    {em}
                  </div>
                );
              })}
              <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-[24px] shadow-md" style={{ background: G.mid }}>🪞</div>
            </div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-4" style={{ color: G.mid }}>익명 관계 분석</p>
            <h1 className="text-[34px] font-black text-gray-900 leading-[1.12] mb-5">나는 5명의 눈에<br />어떻게 보일까?</h1>
            <p className="text-[16px] text-gray-500 leading-relaxed max-w-[280px]">
              링크를 5명에게 보내면 익명으로 나를 평가해줘요<br />
              <span className="text-[14px]" style={{ color: G.text }}>누가 뭐라 했는지는 절대 안 보여요</span>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["완전 익명", "12가지 질문", "24시간 후 공개"].map(tag => (
                <span key={tag} className="text-[12px] font-bold rounded-full px-3 py-1"
                  style={{ background: G.bg, color: G.deep, border: `1px solid ${G.border}` }}>{tag}</span>
              ))}
            </div>
          </section>

          <section className="px-6 py-8 flex flex-col gap-7 border-t border-gray-50">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">How it works</p>
            {[
              { num: "01", en: "CREATE",   ko: "링크를 만들어요",        desc: "닉네임을 설정하고\n익명 초대 링크를 생성해요." },
              { num: "02", en: "SHARE",    ko: "5명에게 보내요",          desc: "친구, 동료, 지인 누구에게나 공유해요.\n누가 참여했는지 절대 알 수 없어요." },
              { num: "03", en: "ANSWER",   ko: "12가지 질문에 답해요",   desc: "첫인상·매력·단점·연애 스타일까지\n솔직하게 답해요." },
              { num: "04", en: "WAIT 24H", ko: "24시간 후 결과 공개",    desc: "1명이라도 응답하면 24시간 뒤에\n익명 분석 리포트가 열려요." },
            ].map(f => (
              <div key={f.num} className="flex gap-4 items-start">
                <span className="text-[26px] font-black text-gray-200 leading-none flex-shrink-0 w-10 text-right tabular-nums">{f.num}</span>
                <div className="flex-1 border-l-2 pl-4" style={{ borderColor: G.border }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: G.mid }}>{f.en}</p>
                  <p className="text-[20px] font-black text-gray-900 leading-tight mb-1">{f.ko}</p>
                  <p className="text-[14px] text-gray-500 leading-relaxed whitespace-pre-line">{f.desc}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer" onClick={() => setAgreed(v => !v)}>
              <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: agreed ? G.mid : "white", borderColor: agreed ? G.mid : "#D1D5DB" }}>
                {agreed && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <p className="text-[13px] text-gray-600">이용약관 및 개인정보처리방침에 동의합니다</p>
            </label>
            <button onClick={() => agreed && goTo("setup")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: agreed ? "#111" : "#F3F4F6", color: agreed ? "#fff" : "#9CA3AF" }}>
              내 링크 만들기
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ SETUP ════════════════════ */}
      {step === "setup" && (
        <div className="flex flex-col pb-36">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>Step 1 · 설정</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">닉네임을 정해요</h2>
            <p className="text-[14px] text-gray-500">응답자에게 보여질 이름이에요</p>
          </section>

          <section className="px-6 flex flex-col gap-5 pb-8">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">내 닉네임 *</label>
              <input
                value={myName} onChange={e => setMyName(e.target.value)}
                placeholder="예: 지환, 민지, 팀장님"
                className="w-full rounded-2xl border px-4 py-4 text-[16px] font-semibold text-gray-900 bg-white outline-none transition-all"
                style={{ borderColor: myName ? G.mid : "#E5E7EB", boxShadow: myName ? `0 0 0 3px ${G.bg}` : undefined }}
              />
            </div>

            <div className="rounded-2xl p-4 flex gap-3" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
              <span className="text-xl flex-shrink-0">🔒</span>
              <div>
                <p className="text-[13px] font-black text-gray-900 mb-1">완전 익명 보장</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">누가 응답했는지 절대 알 수 없어요. 응답자 정보는 수집되지 않아요.</p>
              </div>
            </div>
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button onClick={() => myName.trim() && createRoom()}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: myName.trim() ? "#111" : "#F3F4F6", color: myName.trim() ? "#fff" : "#9CA3AF" }}>
              초대 링크 생성 →
            </button>
            {!myName.trim() && <p className="text-center text-[12px] text-gray-400 mt-2">닉네임을 입력해주세요</p>}
          </div>
        </div>
      )}

      {/* ════════════════════ LINK ════════════════════ */}
      {step === "link" && (
        <div className="flex flex-col pb-12">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>Step 2 · 링크 공유</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">{myName}의 링크가<br />생성됐어요!</h2>
            <p className="text-[14px] text-gray-500">5명에게 보낼수록 더 정확한 분석 결과가 나와요</p>
          </section>
          <section className="px-6 flex flex-col gap-4 pb-6">
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ border: `1px solid ${G.border}`, background: G.bg }}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: G.mid }}>익명 초대 링크</p>
                <p className="text-[13px] font-semibold text-gray-700 truncate">styledrop.cloud/nabo?room=abc123</p>
              </div>
              <button onClick={copyLink}
                className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-[13px] text-white transition-all"
                style={{ background: copied ? G.mid : "#111" }}>
                {copied ? "복사됨 ✓" : "복사"}
              </button>
            </div>
            <button className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2" style={{ background: "#FEE500", color: "#191919" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
              카카오톡으로 보내기
            </button>
            <button className="w-full py-3.5 rounded-2xl font-bold text-[15px] border border-gray-200 text-gray-700 flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11 5.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM11 15.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.25 8.23l1.52 1.52M8.77 4.23l-1.52 1.52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              다른 방법으로 공유
            </button>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-[13px] font-black text-gray-900 mb-3">결과 공개 조건</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { icon: "👥", text: "5명에게 링크를 공유하세요" },
                  { icon: "⏰", text: "1명이라도 응답하면 24시간 후 결과가 열려요" },
                  { icon: "🔒", text: "누가 뭐라 했는지 절대 알 수 없어요" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <span className="text-[13px] text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => goTo("waiting")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: "#111", color: "#fff" }}>
              응답 대기 화면으로 →
            </button>
          </section>
        </div>
      )}

      {/* ════════════════════ WAITING ════════════════════ */}
      {step === "waiting" && (
        <div className="flex flex-col px-6 pt-10 pb-12 gap-5">
          <div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>대기 중</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-1">응답을 기다리는 중</h2>
            <p className="text-[14px] text-gray-500">1명 이상 응답 + 24시간이 지나면 결과가 열려요</p>
          </div>

          <div className="rounded-3xl p-5" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-black text-gray-900">현재 응답 현황</p>
              <p className="text-[26px] font-black" style={{ color: G.mid }}>{responses.length}<span className="text-[16px] text-gray-400"> / 5</span></p>
            </div>
            <div className="flex gap-2 mb-3">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="flex-1 h-2.5 rounded-full transition-all duration-500"
                  style={{ background: i < responses.length ? G.mid : G.light }} />
              ))}
            </div>
            <p className="text-[12px] text-gray-400">
              {responses.length === 0 && "아직 아무도 응답하지 않았어요"}
              {responses.length > 0 && responses.length < 5 && `${responses.length}명이 응답했어요`}
              {responses.length >= 5 && "5명 모두 응답 완료!"}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">⏰ 결과 공개까지</p>
            {timeLeft > 0 ? (
              <>
                <p className="text-[38px] font-black text-gray-900 leading-none tabular-nums" style={{ fontFamily: "monospace" }}>
                  {fmtCountdown(timeLeft)}
                </p>
                <p className="text-[12px] text-gray-400 mt-2">
                  {responses.length === 0 ? "응답이 1건 이상 있어야 공개돼요" : `${responses.length}명 응답 완료 · 시간이 지나면 자동으로 열려요`}
                </p>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎉</span>
                <div>
                  <p className="text-[16px] font-black text-gray-900">24시간 완료!</p>
                  <p className="text-[12px] text-gray-500">아래 버튼으로 결과를 확인해요</p>
                </div>
              </div>
            )}
          </div>

          {canSeeResults && (
            <button onClick={() => goTo("results")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: G.mid, color: "white" }}>
              결과 확인하기 🎉
            </button>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
            <p className="text-[13px] font-black text-gray-900 mb-1">응답자로 직접 체험</p>
            <p className="text-[12px] text-gray-500 mb-3">링크를 받은 사람의 경험을 직접 해볼 수 있어요</p>
            <button
              onClick={() => { setQIdx(0); setCurAns(""); setCustomAns(""); setSlider(50); setCurResp({}); goTo("questions"); }}
              className="w-full py-3 rounded-xl font-bold text-[14px] border-2 transition-all active:scale-[0.98]"
              style={{ borderColor: G.mid, color: G.text, background: G.bg }}>
              12문항 직접 체험 → ({responses.length + 1}번째 응답)
            </button>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-4">
            <p className="text-[11px] font-bold text-gray-400 mb-3">🛠 개발 테스트용</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => simulateAll(true)}
                className="w-full py-3 rounded-xl font-bold text-[13px] border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                5명 자동 완성 + 24시간 건너뛰기 →
              </button>
              {responses.length > 0 && (
                <button onClick={() => simulateAll(false)}
                  className="w-full py-3 rounded-xl font-bold text-[13px] border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  나머지 {Math.max(0, 5 - responses.length)}명만 자동 완성
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ QUESTIONS ════════════════════ */}
      {step === "questions" && Q && (
        <div className="flex flex-col pb-32 flex-1">
          <div className="px-5 py-2.5 text-center" style={{ background: G.bg, borderBottom: `1px solid ${G.border}` }}>
            <p className="text-[12px] font-bold" style={{ color: G.text }}>
              지금 <strong>{myName}</strong>에 대해 익명으로 답변 중이에요
            </p>
          </div>
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-gray-400">{qIdx + 1} / {QS.length}</p>
              <p className="text-[12px] font-bold" style={{ color: G.mid }}>{Q.short}</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: G.light }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((qIdx + 1) / QS.length) * 100}%`, background: G.mid }} />
            </div>
          </div>

          <section className="px-6 pt-7 pb-4 flex flex-col gap-5 flex-1">
            <div className="flex flex-col gap-3">
              <span className="text-[42px] leading-none">{Q.emoji}</span>
              <h2 className="text-[24px] font-black text-gray-900 leading-tight">{Q.text(myName || "이 분")}</h2>
            </div>

            {Q.type === "choice" && (
              <div className="flex flex-col gap-2">
                {getOptions(Q).map(opt => (
                  <button key={opt} onClick={() => { setCurAns(opt); if (opt !== EXTRA) setCustomAns(""); }}
                    className="w-full rounded-2xl border px-4 py-3.5 text-left font-semibold text-[15px] transition-all"
                    style={{
                      borderColor: curAns === opt ? G.mid : "#E5E7EB",
                      background: curAns === opt ? G.bg : "white",
                      color: curAns === opt ? G.text : "#374151",
                      fontStyle: opt === EXTRA ? "italic" : "normal",
                    }}>
                    {opt}
                  </button>
                ))}
                {isExtra && (
                  <input autoFocus
                    value={customAns} onChange={e => setCustomAns(e.target.value)}
                    placeholder="직접 입력해줘..."
                    className="w-full rounded-2xl border px-4 py-3.5 text-[15px] font-semibold text-gray-900 bg-white outline-none"
                    style={{ borderColor: customAns ? G.mid : "#E5E7EB" }}
                  />
                )}
              </div>
            )}

            {Q.type === "text" && (
              <textarea
                value={String(curAns)} onChange={e => setCurAns(e.target.value)}
                placeholder={getPlaceholder(Q)} rows={3}
                className="w-full rounded-2xl border px-4 py-4 text-[15px] font-semibold text-gray-900 bg-white outline-none resize-none"
                style={{ borderColor: curAns ? G.mid : "#E5E7EB" }}
              />
            )}

            {Q.type === "slider" && (
              <div className="flex flex-col gap-5">
                <style>{`.nabo-sl::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:${G.mid};cursor:pointer;box-shadow:0 2px 8px rgba(34,197,94,0.45)}.nabo-sl::-webkit-slider-runnable-track{height:7px;border-radius:4px;background:linear-gradient(to right,${G.mid} var(--v,50%),#E5E7EB var(--v,50%))}.nabo-sl{-webkit-appearance:none;appearance:none;outline:none}`}</style>
                <input type="range" min={0} max={100} value={slider} onChange={e => setSlider(Number(e.target.value))}
                  className="w-full nabo-sl" style={{ "--v": `${slider}%` } as React.CSSProperties} />
                <div className="flex justify-between text-[12px] font-bold text-gray-400">
                  <span>{Q.labels![0]}</span><span>{Q.labels![1]}</span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="px-8 py-3 rounded-2xl text-center" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
                    <span className="text-[40px] font-black leading-none" style={{ color: G.mid }}>{slider}</span>
                    <span className="text-[14px] text-gray-400 ml-1">/ 100</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button onClick={canNext ? advance : undefined}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: canNext ? "#111" : "#F3F4F6", color: canNext ? "#fff" : "#9CA3AF" }}>
              {qIdx < QS.length - 1 ? "다음 →" : "익명 제출 완료 →"}
            </button>
            {!canNext && <p className="text-center text-[12px] text-gray-400 mt-2">답변을 입력해주세요</p>}
          </div>
        </div>
      )}

      {/* ════════════════════ RESULTS ════════════════════ */}
      {step === "results" && (
        <div className="flex flex-col pb-16">
          <section className="px-6 pt-10 pb-6 text-center">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>관계 분석 완료</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-1">{R.length}명이 본 {myName}</h2>
            <p className="text-[13px] text-gray-400">익명 응답자 {R.length}명 기준 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</p>
          </section>

          {/* ── 종합 점수 (항상 공개) ── */}
          <section className="mx-6 rounded-3xl p-6 mb-4" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
            <div className="flex flex-col items-center gap-4">
              <ScoreRing score={overallScore} size={148} />
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">종합 매력 지수</p>
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-black text-white" style={{ background: G.mid }}>
                  {topDrama.split(" (")[0]}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-5">
              {[["케미", chemAvg], ["재미", funAvg], ["친밀도", intimAvg]].map(([k, v]) => (
                <div key={k} className="bg-white rounded-2xl py-3 text-center">
                  <p className="text-[10px] font-bold text-gray-400">{k}</p>
                  <p className="text-[22px] font-black" style={{ color: G.mid }}>{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 첫인상 Top 1 (항상 공개) ── */}
          <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">👀 첫인상 (가장 많은 응답)</p>
            {imprDist[0] && (
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-black text-gray-900">{imprDist[0][0]}</span>
                <span className="text-[14px] font-black px-3 py-1 rounded-full" style={{ background: G.bg, color: G.mid }}>{imprDist[0][1]}명</span>
              </div>
            )}
          </section>

          {/* ── 상세 결과: 잠금 / 해금 분기 ── */}
          {unlocked ? (
            <>
              {/* 첫인상 전체 분포 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">첫인상 전체 분포</p>
                <div className="flex flex-col gap-3">
                  {imprDist.map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                </div>
              </section>

              {/* 핵심 매력 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">💎 핵심 매력</p>
                <div className="flex flex-col gap-3">
                  {charmDist.map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                </div>
              </section>

              {/* 유형 카드 4종 */}
              <section className="mx-6 grid grid-cols-2 gap-3 mb-4">
                {[
                  { title: "동물 유형",   val: topAnimal.split(" (")[0],                                           emoji: "🐾" },
                  { title: "화낼 때",     val: topAnger,                                                            emoji: "😤" },
                  { title: "연애 스타일", val: topDating.replace(/ 🕊️|💌|🤲|🔥/g, "").split(" (")[0].trim(), emoji: "💘" },
                  { title: "드라마 유형", val: topDrama.split(" (")[0],                                            emoji: "🎭" },
                ].map(({ title, val, emoji }) => (
                  <div key={title} className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{emoji} {title}</p>
                    <p className="text-[13px] font-black text-gray-900 leading-tight">{val}</p>
                  </div>
                ))}
              </section>

              {/* 의외의 매력 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">🌟 발견된 의외의 매력</p>
                <div className="flex flex-col gap-3">
                  {charms.map((c, i) => (
                    <div key={i} className="rounded-xl px-4 py-3 text-[14px] text-gray-700 leading-relaxed" style={{ background: G.bg }}>&ldquo;{c}&rdquo;</div>
                  ))}
                </div>
              </section>

              {/* 아쉬운 점 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">😅 아쉬운 점</p>
                <div className="flex flex-col gap-3">
                  {annoyances.map((a, i) => (
                    <div key={i} className="rounded-xl px-4 py-3 text-[14px] text-gray-700 leading-relaxed border border-gray-100">{a}</div>
                  ))}
                </div>
              </section>

              {/* 익명 한마디 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">✉️ 익명의 한마디</p>
                <div className="flex flex-col gap-2">
                  {messages.map((msg, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-[14px] text-gray-800 leading-relaxed italic">&ldquo;{msg}&rdquo;</p>
                      <p className="text-[11px] text-gray-400 mt-1">— 익명</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="px-6">
                <button className="w-full py-3.5 rounded-2xl border border-gray-200 font-bold text-[15px] text-gray-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11 5.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM11 15.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7.25 8.23l1.52 1.52M8.77 4.23l-1.52 1.52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  결과 공유하기
                </button>
              </div>
            </>
          ) : (
            /* ── 잠금 상태 ── */
            <>
              {/* 흐릿한 미리보기 */}
              <section className="mx-6 mb-4 relative overflow-hidden rounded-2xl border border-gray-100">
                <div className="blur-[3px] select-none pointer-events-none px-5 py-5" aria-hidden>
                  <p className="text-[11px] font-black text-gray-400 mb-4">💎 핵심 매력 분포</p>
                  <div className="flex flex-col gap-3">
                    {charmDist.slice(0, 3).map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                  </div>
                </div>
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px]" />
              </section>

              <section className="mx-6 mb-4 grid grid-cols-2 gap-3 relative overflow-hidden">
                {[
                  { title: "동물 유형",   val: topAnimal.split(" (")[0],   emoji: "🐾" },
                  { title: "연애 스타일", val: "•  •  •",                   emoji: "💘" },
                ].map(({ title, val, emoji }) => (
                  <div key={title} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 blur-[2px] select-none" aria-hidden>
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{emoji} {title}</p>
                    <p className="text-[13px] font-black text-gray-900 leading-tight">{val}</p>
                  </div>
                ))}
              </section>

              <section className="mx-6 mb-4 relative overflow-hidden rounded-2xl border border-gray-100">
                <div className="blur-[3px] select-none pointer-events-none px-5 py-5" aria-hidden>
                  <p className="text-[11px] font-black text-gray-400 mb-3">✉️ 익명의 한마디</p>
                  <div className="flex flex-col gap-2">
                    {[0,1].map(i => (
                      <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-[14px] text-gray-800 italic">&ldquo;████ █████ ████ ██&rdquo;</p>
                        <p className="text-[11px] text-gray-400 mt-1">— 익명</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px]" />
              </section>

              {/* 전체결과 보기 CTA */}
              <section className="mx-6 mb-4 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)", border: `1px solid ${G.dark}` }}>
                <div className="px-6 py-7 flex flex-col items-center text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                    🔓
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: G.mid }}>Full Report</p>
                    <p className="text-[22px] font-black text-white leading-tight mb-2">전체 결과 보기</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                      핵심 매력 분포 · 유형 카드 4종<br />
                      의외의 매력 · 아쉬운 점 전체<br />
                      익명 한마디 전체
                    </p>
                  </div>
                  <button
                    onClick={handleUnlock}
                    className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
                    style={{ background: G.mid, color: "white" }}
                  >
                    {UNLOCK_CREDITS}크레딧으로 전체 해금
                  </button>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>1회 결제로 모든 항목이 열려요</p>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
