"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const T = {
  bg: "#EFF6FF",
  border: "#BFDBFE",
  light: "#DBEAFE",
  mid: "#3B82F6",
  dark: "#2563EB",
  text: "#1D4ED8",
  deep: "#1E3A8A",
} as const;

type Step = "intro" | "setup" | "link" | "waiting" | "questions" | "results";
type Relation = "friend" | "lover" | "family" | "coworker";
type AnswerValue = string | number;
type AnswerMap = Record<string, AnswerValue>;
type Question =
  | {
      id: string;
      emoji: string;
      short: string;
      category: string;
      type: "choice";
      text: string;
      options: string[];
    }
  | {
      id: string;
      emoji: string;
      short: string;
      category: string;
      type: "slider";
      text: string;
      labels: [string, string];
    };

const DETAIL_UNLOCK_CREDITS = 5;

const RELATION_OPTIONS: Array<{ id: Relation; label: string; desc: string }> = [
  { id: "friend", label: "친한 친구", desc: "유쾌하고 직설적인 톤" },
  { id: "lover", label: "연인", desc: "감성적이고 로맨틱한 톤" },
  { id: "family", label: "가족", desc: "따뜻하고 현실적인 톤" },
  { id: "coworker", label: "직장 동료", desc: "정중하지만 솔직한 톤" },
];

const QUESTIONS: Question[] = [
  { id: "q1", emoji: "🧳", short: "계획", category: "준비 스타일", type: "slider", text: "여행 계획은 얼마나 미리 짜?", labels: ["즉흥", "3개월 전 완성"] },
  { id: "q2", emoji: "🏨", short: "숙소", category: "준비 스타일", type: "choice", text: "숙소 기준은?", options: ["위치", "가성비", "감성", "럭셔리"] },
  { id: "q3", emoji: "🗺️", short: "동선", category: "준비 스타일", type: "choice", text: "동선은 어떻게 짜?", options: ["분 단위 계획", "큰 틀만", "그냥 가서 봄"] },
  { id: "q4", emoji: "💸", short: "예산", category: "준비 스타일", type: "slider", text: "여행 예산 기준은?", labels: ["극한 절약", "무제한"] },
  { id: "q5", emoji: "⏰", short: "기상", category: "행동 패턴", type: "choice", text: "아침 몇 시에 일어나?", options: ["6시 이전", "8시쯤", "10시 이후", "체크아웃 직전"] },
  { id: "q6", emoji: "🍜", short: "식사", category: "행동 패턴", type: "choice", text: "식사는 어떻게 해결해?", options: ["현지 맛집 필수", "편의점도 OK", "아무거나"] },
  { id: "q7", emoji: "🏝️", short: "코스", category: "행동 패턴", type: "slider", text: "관광지 vs 동네 골목, 어디 쪽이 더 좋아?", labels: ["관광지", "동네 골목"] },
  { id: "q8", emoji: "📸", short: "사진", category: "행동 패턴", type: "slider", text: "사진 찍는 빈도는?", labels: ["거의 안 찍음", "매 순간 기록"] },
  { id: "q9", emoji: "🛍️", short: "쇼핑", category: "행동 패턴", type: "slider", text: "쇼핑에 쓰는 시간과 돈은?", labels: ["거의 없음", "꽤 큼"] },
  { id: "q10", emoji: "📱", short: "이동", category: "행동 패턴", type: "choice", text: "이동 중엔?", options: ["계속 대화", "반반", "각자 폰"] },
  { id: "q11", emoji: "🚶", short: "밀도", category: "여행 페이스", type: "slider", text: "하루에 몇 곳 가는 게 적당해?", labels: ["1~2곳", "6곳 이상"] },
  { id: "q12", emoji: "☕", short: "휴식", category: "여행 페이스", type: "slider", text: "카페에서 쉬는 시간은?", labels: ["거의 없음", "하루 2번 이상"] },
  { id: "q13", emoji: "🚧", short: "변수", category: "여행 페이스", type: "choice", text: "길 막힘, 웨이팅 같은 변수가 생기면?", options: ["빠르게 대안 찾기", "그냥 기다리기", "포기하고 접기"] },
  { id: "q14", emoji: "🛏️", short: "체크인", category: "여행 페이스", type: "choice", text: "숙소 체크인 후 다시 나가?", options: ["무조건 나감", "피곤하면 쉼", "안 나감"] },
  { id: "q15", emoji: "⚖️", short: "충돌", category: "갈등 & 결정", type: "choice", text: "가고 싶은 곳이 충돌하면?", options: ["상대 맞춤", "협상", "각자 가기", "내가 양보"] },
  { id: "q16", emoji: "🍽️", short: "식당 결정", category: "갈등 & 결정", type: "choice", text: "밥 먹을 곳을 못 정하면?", options: ["내가 정함", "상대 따름", "계속 탐색"] },
  { id: "q17", emoji: "🫥", short: "혼자 시간", category: "갈등 & 결정", type: "slider", text: "여행 중 혼자만의 시간이 필요해?", labels: ["전혀", "매우 필요"] },
  { id: "q18", emoji: "🗂️", short: "정리", category: "여행 후", type: "choice", text: "여행 사진 정리는?", options: ["당일 앨범 정리", "나중에 몰아서", "안 함"] },
  { id: "q19", emoji: "📲", short: "업로드", category: "여행 후", type: "slider", text: "여행 후 SNS 업로드는?", labels: ["안 함", "스토리+피드 모두"] },
  { id: "q20", emoji: "✈️", short: "다음 여행", category: "여행 후", type: "choice", text: "다음 여행은 언제 또 계획해?", options: ["돌아오는 길에", "1달 후", "한참 뒤", "당분간 없음"] },
];

const PARTNER_PROFILES: AnswerMap[] = [
  {
    q1: 78, q2: "감성", q3: "큰 틀만", q4: 62, q5: "8시쯤", q6: "현지 맛집 필수", q7: 64, q8: 88, q9: 54, q10: "계속 대화",
    q11: 58, q12: 66, q13: "빠르게 대안 찾기", q14: "피곤하면 쉼", q15: "협상", q16: "계속 탐색", q17: 38, q18: "나중에 몰아서", q19: 82, q20: "1달 후",
  },
  {
    q1: 24, q2: "가성비", q3: "그냥 가서 봄", q4: 28, q5: "10시 이후", q6: "편의점도 OK", q7: 86, q8: 30, q9: 22, q10: "각자 폰",
    q11: 22, q12: 78, q13: "그냥 기다리기", q14: "안 나감", q15: "내가 양보", q16: "상대 따름", q17: 74, q18: "안 함", q19: 12, q20: "한참 뒤",
  },
  {
    q1: 54, q2: "위치", q3: "분 단위 계획", q4: 48, q5: "6시 이전", q6: "현지 맛집 필수", q7: 35, q8: 56, q9: 48, q10: "반반",
    q11: 82, q12: 18, q13: "빠르게 대안 찾기", q14: "무조건 나감", q15: "협상", q16: "내가 정함", q17: 26, q18: "당일 앨범 정리", q19: 58, q20: "돌아오는 길에",
  },
];

const DOMESTIC_SPOTS = [
  { id: "jeju", title: "제주", mood: "여유 + 감성", blurb: "카페, 바다, 드라이브가 잘 맞는 조합이면 실패 확률이 낮습니다." },
  { id: "gangneung", title: "강릉", mood: "사진 + 카페", blurb: "사진 욕구와 쉬는 템포가 비슷한 사람끼리 특히 잘 맞습니다." },
  { id: "busan", title: "부산", mood: "도시 + 바다", blurb: "빡빡한 일정과 느긋한 저녁을 동시에 챙기고 싶을 때 안정적입니다." },
  { id: "gyeongju", title: "경주", mood: "역사 + 산책", blurb: "동선이 단정하고 조용한 분위기를 좋아하는 조합에 맞습니다." },
  { id: "sokcho", title: "속초", mood: "맛집 + 자연", blurb: "먹는 재미와 풍경 소비를 같이 챙기려는 두 사람에게 어울립니다." },
];

const OVERSEAS_SPOTS = [
  { id: "tokyo", title: "도쿄", mood: "도시형", blurb: "각자 취향이 달라도 동선을 쪼개기 쉬워 충돌이 적습니다." },
  { id: "kyoto", title: "교토", mood: "정적 + 감성", blurb: "여유 있는 페이스와 사진 취향이 맞을수록 만족도가 높습니다." },
  { id: "bangkok", title: "방콕", mood: "미식 + 야행성", blurb: "식사, 쇼핑, 실내 휴식을 고르게 섞고 싶을 때 좋습니다." },
  { id: "barcelona", title: "바르셀로나", mood: "도시 + 산책", blurb: "걷는 양은 많지만 풍경 보상이 커서 활동형 조합에 적합합니다." },
  { id: "bali", title: "발리", mood: "휴양 + 무드", blurb: "느긋함과 감성 숙소 취향이 강한 조합이면 체감 만족도가 높습니다." },
];

const TIER_RULES = [
  { min: 90, tier: "S", name: "천생연분 여행메이트", desc: "싸울 틈이 거의 없는 타입. 같이 다닐수록 더 편해집니다." },
  { min: 75, tier: "A", name: "찰떡 궁합", desc: "약간의 조율만 있으면 정말 편한 여행이 가능합니다." },
  { min: 60, tier: "B", name: "무난한 동행", desc: "배려가 있으면 충분히 즐거운 여행이 됩니다." },
  { min: 45, tier: "C", name: "조율 필요형", desc: "사전 합의만 잘하면 싸움은 줄일 수 있습니다." },
  { min: 30, tier: "D", name: "충돌 예고형", desc: "각자 시간과 룰이 필요한 조합입니다." },
  { min: 15, tier: "E", name: "여행은 따로", desc: "같이 가면 한 명은 꽤 참게 될 확률이 높습니다." },
  { min: 0, tier: "F", name: "의절각", desc: "가기 전에 일정표와 룰부터 맞춰야 하는 타입입니다." },
];

function ScoreRing({ score, size = 136, color = T.mid }: { score: number; size?: number; color?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let current = 0;
    const step = score / 60;
    const timer = setInterval(() => {
      current = Math.min(current + step, score);
      setShown(Math.round(current));
      if (current >= score) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [score]);
  const radius = size * 0.37;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E5E7EB" strokeWidth="9" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (shown / 100) * circumference}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-gray-900 leading-none" style={{ fontSize: size * 0.24 }}>{shown}</span>
        <span className="font-bold text-gray-400" style={{ fontSize: size * 0.09 }}>/ 100</span>
      </div>
    </div>
  );
}

function BarRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-black" style={{ color: T.mid }}>{score}점</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-100">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: T.mid }} />
      </div>
    </div>
  );
}

function getChoiceScore(question: Extract<Question, { type: "choice" }>, myAnswer: string, partnerAnswer: string) {
  const myIndex = question.options.indexOf(myAnswer);
  const partnerIndex = question.options.indexOf(partnerAnswer);
  if (myIndex < 0 || partnerIndex < 0) return 50;
  if (question.options.length <= 1) return 100;
  const distance = Math.abs(myIndex - partnerIndex) / (question.options.length - 1);
  return Math.max(0, Math.round(100 - distance * 100));
}

function getSliderScore(myValue: number, partnerValue: number) {
  return Math.max(0, Math.round(100 - Math.abs(myValue - partnerValue)));
}

function getTier(score: number) {
  return TIER_RULES.find((rule) => score >= rule.min) ?? TIER_RULES[TIER_RULES.length - 1];
}

function pickPreviewSpots(overall: number, photoScore: number, paceScore: number) {
  const domestic = overall >= 75 ? DOMESTIC_SPOTS.slice(0, 3) : overall >= 55 ? DOMESTIC_SPOTS.slice(1, 4) : DOMESTIC_SPOTS.slice(2, 5);
  const overseasBase = photoScore >= 65 ? [OVERSEAS_SPOTS[1], OVERSEAS_SPOTS[0], OVERSEAS_SPOTS[4]] : paceScore >= 65 ? [OVERSEAS_SPOTS[0], OVERSEAS_SPOTS[3], OVERSEAS_SPOTS[2]] : [OVERSEAS_SPOTS[4], OVERSEAS_SPOTS[2], OVERSEAS_SPOTS[1]];
  return { domestic, overseas: overseasBase };
}

function getToneLine(relation: Relation, score: number, partnerName: string) {
  if (relation === "lover") {
    if (score >= 75) return `${partnerName}와는 여행 중에도 분위기가 크게 깨지지 않는 편입니다. 무드가 잘 이어집니다.`;
    if (score >= 45) return `${partnerName}와는 좋을 때는 좋은데, 일정 밀도와 쉬는 타이밍 합의가 먼저 필요합니다.`;
    return `${partnerName}와는 사랑과 여행이 별개일 수 있습니다. 여행은 규칙부터 맞추는 게 안전합니다.`;
  }
  if (relation === "family") {
    if (score >= 75) return `${partnerName}와는 서로 챙기는 방식이 크게 어긋나지 않아 안정적인 여행이 됩니다.`;
    if (score >= 45) return `${partnerName}와는 생활 페이스 차이가 있어도 역할 분담을 나누면 훨씬 편해집니다.`;
    return `${partnerName}와는 가족이라도 여행 페이스 충돌이 큽니다. 각자 시간 확보가 필요합니다.`;
  }
  if (relation === "coworker") {
    if (score >= 75) return `${partnerName}와는 일정 합의가 빠르고, 변수 대응도 비교적 매끈한 편입니다.`;
    if (score >= 45) return `${partnerName}와는 취향보다 의사결정 속도 차이가 더 크게 느껴질 수 있습니다.`;
    return `${partnerName}와는 업무는 몰라도 여행은 긴장도가 높은 조합입니다. 역할 분리가 필요합니다.`;
  }
  if (score >= 75) return `${partnerName}와는 같이 다닐수록 편한 타입입니다. 일정 짜는 과정도 크게 싸우지 않을 확률이 높습니다.`;
  if (score >= 45) return `${partnerName}와는 취향은 다를 수 있지만, 먼저 말만 잘 맞추면 충분히 재밌게 다닐 수 있습니다.`;
  return `${partnerName}와는 여행지보다 방식에서 먼저 부딪힐 수 있습니다. 출발 전에 룰부터 정해야 합니다.`;
}

export default function TravelTogetherPage() {
  const [step, setStep] = useState<Step>("intro");
  const [history, setHistory] = useState<Step[]>(["intro"]);
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [relation, setRelation] = useState<Relation>("friend");
  const [agreed, setAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mySubmitted, setMySubmitted] = useState(false);
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerValue>("");
  const [slider, setSlider] = useState(50);
  const [myAnswers, setMyAnswers] = useState<AnswerMap>({});
  const [partnerProfileIndex, setPartnerProfileIndex] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("travel_together_state");
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        step?: Step;
        myName?: string;
        partnerName?: string;
        relation?: Relation;
        mySubmitted?: boolean;
        partnerSubmitted?: boolean;
        myAnswers?: AnswerMap;
        unlocked?: boolean;
        partnerProfileIndex?: number;
      };
      if (parsed.step) {
        setStep(parsed.step);
        setHistory(["intro", parsed.step]);
      }
      if (parsed.myName) setMyName(parsed.myName);
      if (parsed.partnerName) setPartnerName(parsed.partnerName);
      if (parsed.relation) setRelation(parsed.relation);
      if (parsed.mySubmitted) setMySubmitted(parsed.mySubmitted);
      if (parsed.partnerSubmitted) setPartnerSubmitted(parsed.partnerSubmitted);
      if (parsed.myAnswers) setMyAnswers(parsed.myAnswers);
      if (parsed.unlocked) setUnlocked(parsed.unlocked);
      if (typeof parsed.partnerProfileIndex === "number") setPartnerProfileIndex(parsed.partnerProfileIndex % PARTNER_PROFILES.length);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "travel_together_state",
        JSON.stringify({
          step,
          myName,
          partnerName,
          relation,
          mySubmitted,
          partnerSubmitted,
          myAnswers,
          unlocked,
          partnerProfileIndex,
        }),
      );
    } catch {}
  }, [step, myName, partnerName, relation, mySubmitted, partnerSubmitted, myAnswers, unlocked, partnerProfileIndex]);

  const goTo = useCallback((next: Step) => {
    setHistory((prev) => [...prev, next]);
    setStep(next);
  }, []);

  const goBack = () => {
    const next = [...history];
    next.pop();
    const prev = next[next.length - 1] ?? "intro";
    setHistory(next.length ? next : ["intro"]);
    setStep(prev);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://styledrop.cloud/travel-together?room=${Math.random().toString(36).slice(2, 8)}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const simulatePartner = () => {
    setPartnerProfileIndex((prev) => (prev + 1) % PARTNER_PROFILES.length);
    setPartnerSubmitted(true);
  };

  const question = QUESTIONS[qIdx];
  const answerReady = question?.type === "slider" ? true : String(currentAnswer).trim().length > 0;

  const submitAnswer = () => {
    if (!question) return;
    const value = question.type === "slider" ? slider : currentAnswer;
    const nextAnswers = { ...myAnswers, [question.id]: value };
    setMyAnswers(nextAnswers);
    if (qIdx < QUESTIONS.length - 1) {
      setQIdx((prev) => prev + 1);
      setCurrentAnswer("");
      setSlider(50);
      return;
    }
    setMySubmitted(true);
    setQIdx(0);
    setCurrentAnswer("");
    setSlider(50);
    setStep("waiting");
  };

  const results = useMemo(() => {
    const partnerAnswers = PARTNER_PROFILES[partnerProfileIndex];
    const categoryScores = new Map<string, number[]>();

    QUESTIONS.forEach((item) => {
      const myValue = myAnswers[item.id];
      const partnerValue = partnerAnswers[item.id];
      if (typeof myValue === "undefined" || typeof partnerValue === "undefined") return;

      const score =
        item.type === "slider"
          ? getSliderScore(Number(myValue), Number(partnerValue))
          : getChoiceScore(item, String(myValue), String(partnerValue));

      categoryScores.set(item.category, [...(categoryScores.get(item.category) ?? []), score]);
    });

    const categories = [...categoryScores.entries()].map(([label, scores]) => ({
      label,
      score: Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
    }));

    const overall = categories.length
      ? Math.round(categories.reduce((sum, item) => sum + item.score, 0) / categories.length)
      : 0;
    const tier = getTier(overall);
    const sorted = [...categories].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const photoScore = categories.find((item) => item.label === "행동 패턴")?.score ?? overall;
    const paceScore = categories.find((item) => item.label === "여행 페이스")?.score ?? overall;
    const spots = pickPreviewSpots(overall, photoScore, paceScore);

    return {
      overall,
      tier,
      categories,
      best,
      worst,
      toneLine: getToneLine(relation, overall, partnerName || "상대"),
      previewDomestic: spots.domestic[0],
      domestic: spots.domestic,
      overseas: spots.overseas,
    };
  }, [myAnswers, partnerProfileIndex, relation, partnerName]);

  const startTest = () => {
    setCurrentAnswer("");
    setSlider(50);
    setQIdx(0);
    goTo("questions");
  };

  return (
    <main className="min-h-screen bg-white flex flex-col" style={{ fontFamily: '"Pretendard", "SUIT Variable", sans-serif' }}>
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
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
          <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: T.text }}>여행을 같이 간다면</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.mid }} />
          <span className="text-[9px] font-black text-gray-400 tracking-[0.2em] uppercase">Beta</span>
        </div>
      </header>

      {step === "intro" && (
        <div className="flex flex-col pb-36">
          <section className="flex flex-col items-center px-6 pt-14 pb-8 text-center">
            <div className="relative mb-10 flex items-center justify-center" style={{ height: 100 }}>
              {["🧳", "📍", "📸", "☕", "✈️"].map((icon, index) => {
                const angle = (index / 5) * 2 * Math.PI - Math.PI / 2;
                const radius = 38;
                return (
                  <div
                    key={icon}
                    className="absolute w-11 h-11 rounded-full flex items-center justify-center text-[18px] shadow-sm"
                    style={{
                      transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                      background: T.bg,
                      border: `1.5px solid ${T.border}`,
                    }}
                  >
                    {icon}
                  </div>
                );
              })}
              <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-[24px] shadow-md" style={{ background: T.mid }}>🌍</div>
            </div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-4" style={{ color: T.mid }}>Travel Match Lab</p>
            <h1 className="text-[34px] font-black text-gray-900 leading-[1.12] mb-5">우리 여행 스타일,<br />진짜 맞을까?</h1>
            <p className="text-[16px] text-gray-500 leading-relaxed max-w-[295px]">
              둘이 각자 여행 취향을 답하면<br />
              <span className="text-[14px]" style={{ color: T.text }}>궁합 티어와 맞춤 여행지를 보여줘요</span>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["2인 여행 궁합", "20문항", "결과 무료 공개"].map((tag) => (
                <span key={tag} className="text-[12px] font-bold rounded-full px-3 py-1" style={{ background: T.bg, color: T.deep, border: `1px solid ${T.border}` }}>
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="px-6 py-8 flex flex-col gap-7 border-t border-gray-50">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">How it works</p>
            {[
              { num: "01", en: "CREATE", ko: "룸을 만들어요", desc: "상대 이름과 관계를 정하고\n초대 링크를 생성해요." },
              { num: "02", en: "INVITE", ko: "상대를 초대해요", desc: "링크를 보내고 각자\n본인 여행 스타일을 답해요." },
              { num: "03", en: "COMPARE", ko: "궁합을 비교해요", desc: "준비·행동·페이스·갈등·여행 후\n5개 축으로 비교합니다." },
              { num: "04", en: "UNLOCK", ko: "상세 결과를 열어요", desc: "무료 결과 후\n상세 분석과 여행지 추천을 해금해요." },
            ].map((item) => (
              <div key={item.num} className="flex gap-4 items-start">
                <span className="text-[26px] font-black text-gray-200 leading-none flex-shrink-0 w-10 text-right tabular-nums">{item.num}</span>
                <div className="flex-1 border-l-2 pl-4" style={{ borderColor: T.border }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: T.mid }}>{item.en}</p>
                  <p className="text-[20px] font-black text-gray-900 leading-tight mb-1">{item.ko}</p>
                  <p className="text-[14px] text-gray-500 leading-relaxed whitespace-pre-line">{item.desc}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer" onClick={() => setAgreed((prev) => !prev)}>
              <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all" style={{ background: agreed ? T.mid : "white", borderColor: agreed ? T.mid : "#D1D5DB" }}>
                {agreed && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <p className="text-[13px] text-gray-600">실험실 기능과 결과 예시에 동의합니다</p>
            </label>
            <button
              onClick={() => agreed && goTo("setup")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: agreed ? "#111" : "#F3F4F6", color: agreed ? "#fff" : "#9CA3AF" }}
            >
              테스트 시작하기
            </button>
          </div>
        </div>
      )}

      {step === "setup" && (
        <div className="flex flex-col pb-36">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: T.mid }}>Step 1 · 설정</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">누구와 가는 여행인지<br />정해요</h2>
            <p className="text-[14px] text-gray-500">이 정보는 결과 문구 톤과 표시용 이름에만 사용됩니다</p>
          </section>

          <section className="px-6 flex flex-col gap-5 pb-8">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">내 이름 *</label>
              <input
                value={myName}
                onChange={(event) => setMyName(event.target.value)}
                placeholder="예: 지환"
                className="w-full rounded-2xl border px-4 py-4 text-[16px] font-semibold text-gray-900 bg-white outline-none transition-all"
                style={{ borderColor: myName ? T.mid : "#E5E7EB", boxShadow: myName ? `0 0 0 3px ${T.bg}` : undefined }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">상대 이름 *</label>
              <input
                value={partnerName}
                onChange={(event) => setPartnerName(event.target.value)}
                placeholder="예: 민지"
                className="w-full rounded-2xl border px-4 py-4 text-[16px] font-semibold text-gray-900 bg-white outline-none transition-all"
                style={{ borderColor: partnerName ? T.mid : "#E5E7EB", boxShadow: partnerName ? `0 0 0 3px ${T.bg}` : undefined }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">여행 관계 설정</label>
              <div className="grid grid-cols-2 gap-2">
                {RELATION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRelation(option.id)}
                    className="rounded-2xl border px-4 py-3 text-left transition-all"
                    style={{
                      borderColor: relation === option.id ? T.mid : "#E5E7EB",
                      background: relation === option.id ? T.bg : "white",
                    }}
                  >
                    <p className="text-[14px] font-black text-gray-900">{option.label}</p>
                    <p className="text-[12px] text-gray-500 mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button
              onClick={() => myName.trim() && partnerName.trim() && goTo("link")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: myName.trim() && partnerName.trim() ? "#111" : "#F3F4F6", color: myName.trim() && partnerName.trim() ? "#fff" : "#9CA3AF" }}
            >
              초대 링크 만들기
            </button>
            {(!myName.trim() || !partnerName.trim()) && <p className="text-center text-[12px] text-gray-400 mt-2">이름 두 개를 모두 입력해주세요</p>}
          </div>
        </div>
      )}

      {step === "link" && (
        <div className="flex flex-col pb-12">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: T.mid }}>Step 2 · 초대</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">{partnerName}에게 보낼<br />링크가 준비됐어요</h2>
            <p className="text-[14px] text-gray-500">각자 본인 여행 스타일을 답하면 결과가 열립니다</p>
          </section>

          <section className="px-6 flex flex-col gap-4 pb-6">
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ border: `1px solid ${T.border}`, background: T.bg }}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: T.mid }}>초대 링크</p>
                <p className="text-[13px] font-semibold text-gray-700 truncate">styledrop.cloud/travel-together?room=ab12cd</p>
              </div>
              <button onClick={copyLink} className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-[13px] text-white transition-all" style={{ background: copied ? T.mid : "#111" }}>
                {copied ? "복사됨 ✓" : "복사"}
              </button>
            </div>

            <button className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2" style={{ background: "#FEE500", color: "#191919" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
              카카오톡으로 보내기
            </button>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-[13px] font-black text-gray-900 mb-3">결과에 포함되는 것</p>
              <div className="flex flex-col gap-2.5">
                {[
                  "궁합 점수 + 티어",
                  "잘 맞는 포인트 / 충돌 포인트",
                  "국내 3곳 + 해외 3곳 추천",
                  "관계 톤에 맞는 AI 한 줄 결과",
                ].map((text) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <span className="text-base flex-shrink-0">•</span>
                    <span className="text-[13px] text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => goTo("waiting")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: "#111", color: "#fff" }}
            >
              대기 화면으로
            </button>
          </section>
        </div>
      )}

      {step === "waiting" && (
        <div className="flex flex-col px-6 pt-10 pb-12 gap-5">
          <div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: T.mid }}>대기 중</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-1">둘 다 답하면<br />결과가 열려요</h2>
            <p className="text-[14px] text-gray-500">{myName || "나"} / {partnerName || "상대"} 두 사람의 응답이 모두 필요합니다</p>
          </div>

          <div className="rounded-3xl p-5" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-black text-gray-900">현재 응답 현황</p>
              <p className="text-[26px] font-black" style={{ color: T.mid }}>
                {(mySubmitted ? 1 : 0) + (partnerSubmitted ? 1 : 0)}<span className="text-[16px] text-gray-400"> / 2</span>
              </p>
            </div>
            <div className="flex gap-2 mb-3">
              {[0, 1].map((index) => (
                <div key={index} className="flex-1 h-2.5 rounded-full transition-all duration-500" style={{ background: index < (mySubmitted ? 1 : 0) + (partnerSubmitted ? 1 : 0) ? T.mid : T.light }} />
              ))}
            </div>
            <div className="flex flex-col gap-2 text-[13px] text-gray-600">
              <p>{mySubmitted ? `✅ ${myName || "내"} 응답 제출 완료` : `⏳ ${myName || "내"} 응답이 아직 없어요`}</p>
              <p>{partnerSubmitted ? `✅ ${partnerName || "상대"} 응답 제출 완료` : `⏳ ${partnerName || "상대"} 응답을 기다리는 중`}</p>
            </div>
          </div>

          {!mySubmitted && (
            <button onClick={startTest} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: "#111", color: "#fff" }}>
              내 여행 스타일 답하기
            </button>
          )}

          {mySubmitted && !partnerSubmitted && (
            <button onClick={simulatePartner} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: T.mid, color: "#fff" }}>
              상대 응답 시뮬레이션
            </button>
          )}

          {mySubmitted && partnerSubmitted && (
            <button onClick={() => goTo("results")} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: T.mid, color: "#fff" }}>
              결과 확인하기
            </button>
          )}
        </div>
      )}

      {step === "questions" && question && (
        <div className="flex flex-col pb-32 flex-1">
          <div className="px-5 py-2.5 text-center" style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
            <p className="text-[12px] font-bold" style={{ color: T.text }}>
              지금 <strong>{myName || "내"}</strong> 여행 스타일을 답하는 중이에요
            </p>
          </div>
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-gray-400">{qIdx + 1} / {QUESTIONS.length}</p>
              <p className="text-[12px] font-bold" style={{ color: T.mid }}>{question.category}</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.light }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((qIdx + 1) / QUESTIONS.length) * 100}%`, background: T.mid }} />
            </div>
          </div>

          <section className="px-6 pt-7 pb-4 flex flex-col gap-5 flex-1">
            <div className="flex flex-col gap-3">
              <span className="text-[42px] leading-none">{question.emoji}</span>
              <h2 className="text-[24px] font-black text-gray-900 leading-tight">{question.text}</h2>
            </div>

            {question.type === "choice" && (
              <div className="flex flex-col gap-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCurrentAnswer(option)}
                    className="w-full rounded-2xl border px-4 py-3.5 text-left font-semibold text-[15px] transition-all"
                    style={{
                      borderColor: currentAnswer === option ? T.mid : "#E5E7EB",
                      background: currentAnswer === option ? T.bg : "white",
                      color: currentAnswer === option ? T.text : "#374151",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {question.type === "slider" && (
              <div className="flex flex-col gap-5">
                <style>{`.travel-sl::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:${T.mid};cursor:pointer;box-shadow:0 2px 8px rgba(59,130,246,0.38)}.travel-sl::-webkit-slider-runnable-track{height:7px;border-radius:4px;background:linear-gradient(to right,${T.mid} var(--v,50%),#E5E7EB var(--v,50%))}.travel-sl{-webkit-appearance:none;appearance:none;outline:none}`}</style>
                <input type="range" min={0} max={100} value={slider} onChange={(event) => setSlider(Number(event.target.value))} className="w-full travel-sl" style={{ "--v": `${slider}%` } as React.CSSProperties} />
                <div className="flex justify-between text-[12px] font-bold text-gray-400">
                  <span>{question.labels[0]}</span>
                  <span>{question.labels[1]}</span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="px-8 py-3 rounded-2xl text-center" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
                    <span className="text-[40px] font-black leading-none" style={{ color: T.mid }}>{slider}</span>
                    <span className="text-[14px] text-gray-400 ml-1">/ 100</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button onClick={answerReady ? submitAnswer : undefined} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: answerReady ? "#111" : "#F3F4F6", color: answerReady ? "#fff" : "#9CA3AF" }}>
              {qIdx < QUESTIONS.length - 1 ? "다음" : "내 답변 제출"}
            </button>
            {!answerReady && <p className="text-center text-[12px] text-gray-400 mt-2">답변을 선택해주세요</p>}
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="flex flex-col pb-16">
          <section className="px-6 pt-10 pb-6 text-center">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: T.mid }}>Travel Result</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-1">{myName || "나"} × {partnerName || "상대"}</h2>
            <p className="text-[13px] text-gray-400">{RELATION_OPTIONS.find((item) => item.id === relation)?.label} 기준 · 여행 궁합 결과</p>
          </section>

          <section className="mx-6 rounded-3xl p-6 mb-4" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
            <div className="flex flex-col items-center gap-4">
              <ScoreRing score={results.overall} size={148} color={T.mid} />
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">궁합 티어</p>
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-black text-white" style={{ background: T.mid }}>
                  {results.tier.tier} · {results.tier.name}
                </span>
              </div>
              <p className="text-[14px] text-gray-600 leading-relaxed text-center">{results.toneLine}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <div className="bg-white rounded-2xl py-3 text-center px-2">
                <p className="text-[10px] font-bold text-gray-400">가장 잘 맞는 포인트</p>
                <p className="text-[15px] font-black mt-1" style={{ color: T.mid }}>{results.best?.label ?? "준비 스타일"}</p>
              </div>
              <div className="bg-white rounded-2xl py-3 text-center px-2">
                <p className="text-[10px] font-bold text-gray-400">주의 포인트</p>
                <p className="text-[15px] font-black mt-1 text-gray-900">{results.worst?.label ?? "여행 페이스"}</p>
              </div>
            </div>
          </section>

          <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">무료 공개</p>
            <div className="rounded-2xl px-4 py-4" style={{ background: T.bg }}>
              <p className="text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: T.text }}>국내 추천 미리보기</p>
              <p className="text-[20px] font-black text-gray-900 mt-2">{results.previewDomestic.title}</p>
              <p className="text-[13px] text-gray-500 mt-1">{results.previewDomestic.mood}</p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-3">{results.previewDomestic.blurb}</p>
            </div>
          </section>

          {unlocked ? (
            <>
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">카테고리별 궁합</p>
                <div className="flex flex-col gap-3">
                  {results.categories.map((item) => (
                    <BarRow key={item.label} label={item.label} score={item.score} />
                  ))}
                </div>
              </section>

              <section className="mx-6 grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">잘 맞는 영역</p>
                  <p className="text-[15px] font-black text-gray-900">{results.best?.label}</p>
                  <p className="text-[12px] text-gray-500 mt-2">이 부분은 둘 다 속도가 비슷해서 갈등이 적습니다.</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">충돌 가능성</p>
                  <p className="text-[15px] font-black text-gray-900">{results.worst?.label}</p>
                  <p className="text-[12px] text-gray-500 mt-2">출발 전에 합의가 없으면 체감 차이가 크게 날 수 있습니다.</p>
                </div>
              </section>

              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">국내 추천 3곳</p>
                <div className="flex flex-col gap-3">
                  {results.domestic.map((spot) => (
                    <div key={spot.id} className="rounded-xl px-4 py-4" style={{ background: T.bg }}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[16px] font-black text-gray-900">{spot.title}</p>
                        <span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ color: T.text, border: `1px solid ${T.border}` }}>{spot.mood}</span>
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed mt-3">{spot.blurb}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">해외 추천 3곳</p>
                <div className="flex flex-col gap-3">
                  {results.overseas.map((spot) => (
                    <div key={spot.id} className="rounded-xl border border-gray-100 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[16px] font-black text-gray-900">{spot.title}</p>
                        <span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ color: T.text, background: T.bg }}>{spot.mood}</span>
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed mt-3">{spot.blurb}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="mx-6 mb-4 relative overflow-hidden rounded-2xl border border-gray-100">
                <div className="blur-[3px] select-none pointer-events-none px-5 py-5" aria-hidden>
                  <p className="text-[11px] font-black text-gray-400 mb-4">카테고리별 궁합</p>
                  <div className="flex flex-col gap-3">
                    {results.categories.slice(0, 3).map((item) => (
                      <BarRow key={item.label} label={item.label} score={item.score} />
                    ))}
                  </div>
                </div>
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px]" />
              </section>

              <section className="mx-6 mb-4 grid grid-cols-2 gap-3 relative overflow-hidden">
                {["충돌 포인트", "해외 추천"].map((label) => (
                  <div key={label} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 blur-[2px] select-none" aria-hidden>
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
                    <p className="text-[15px] font-black text-gray-900">██████</p>
                  </div>
                ))}
              </section>

              <section className="mx-6 mb-4 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #172554 0%, #1D4ED8 100%)", border: `1px solid ${T.dark}` }}>
                <div className="px-6 py-7 flex flex-col items-center text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(59,130,246,0.14)", border: "1px solid rgba(147,197,253,0.28)" }}>
                    🔓
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: "#93C5FD" }}>Full Travel Report</p>
                    <p className="text-[22px] font-black text-white leading-tight mb-2">상세 결과 보기</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.58)" }}>
                      카테고리별 궁합 점수 · 충돌 포인트 전체<br />
                      국내 3곳 + 해외 3곳 전체 추천
                    </p>
                  </div>
                  <button onClick={() => setUnlocked(true)} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: "#60A5FA", color: "white" }}>
                    {DETAIL_UNLOCK_CREDITS}크레딧으로 상세 해금
                  </button>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>프로토타입 기준으로 한 번에 전체 공개됩니다</p>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}
