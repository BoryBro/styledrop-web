"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackClientEvent } from "@/lib/client-events";

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
type ResultAnalysisMode = "basic" | "detail";

const RESULT_ANALYSIS_STEPS: Record<ResultAnalysisMode, string[]> = {
  basic: ["응답 정렬 중", "여행 취향 비교 중", "궁합 포인트 추출 중", "결과 리포트 여는 중"],
  detail: ["크레딧 확인 중", "답변 차이 분석 중", "충돌 포인트 정리 중", "상세 리포트 여는 중"],
};
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
      scale: string[];
      descriptions?: string[];
    };

type NarrativeBlock = {
  title: string;
  body: string;
};

type FlashpointBlock = {
  key: string;
  title: string;
  body: string;
  rule: string;
};

type AnswerEvidenceBlock = {
  key: string;
  title: string;
  intro: string;
  myLabel: string;
  partnerLabel: string;
  takeaway: string;
};

type TravelParticipantRole = "host" | "guest";

type TravelRoomView = {
  roomId: string;
  relation: Relation;
  role: TravelParticipantRole;
  myName: string;
  partnerName: string;
  mySubmitted: boolean;
  partnerSubmitted: boolean;
  myAnswers: AnswerMap | null;
  partnerAnswers: AnswerMap | null;
  invitePath: string;
  partnerResultPath: string | null;
  unlocked: boolean;
};

type KakaoShareSDK = {
  init?: (key: string | undefined) => void;
  isInitialized?: () => boolean;
  Share?: {
    sendDefault?: (options: {
      objectType: "text";
      text: string;
      link: {
        mobileWebUrl: string;
        webUrl: string;
      };
    }) => void;
  };
};

const DETAIL_UNLOCK_CREDITS = 2;
const DEFAULT_SHARE_ORIGIN = "https://www.styledrop.cloud";

const RELATION_OPTIONS: Array<{ id: Relation; label: string; desc: string }> = [
  { id: "friend", label: "친한 친구", desc: "유쾌하고 직설적인 톤" },
  { id: "lover", label: "연인", desc: "감성적이고 로맨틱한 톤" },
  { id: "family", label: "가족", desc: "따뜻하고 현실적인 톤" },
  { id: "coworker", label: "직장 동료", desc: "정중하지만 솔직한 톤" },
];

const QUESTIONS: Question[] = [
  { id: "q1", emoji: "🧳", short: "계획", category: "준비 스타일", type: "slider", text: "여행 계획은 얼마나 미리 짜?", scale: ["당일", "1~2일 전", "3~6일 전", "1~2주 전", "3~4주 전", "한 달 이상"] },
  { id: "q2", emoji: "🏨", short: "숙소", category: "준비 스타일", type: "choice", text: "숙소 기준은?", options: ["위치", "가성비", "감성", "럭셔리"] },
  { id: "q3", emoji: "🗺️", short: "동선", category: "준비 스타일", type: "choice", text: "동선은 어떻게 짜?", options: ["분 단위 계획", "큰 틀만", "그냥 가서 봄"] },
  { id: "q4", emoji: "💸", short: "예산", category: "준비 스타일", type: "slider", text: "여행 예산 기준은?", scale: ["극한 절약", "아껴 씀", "보통", "조금 여유", "꽤 씀", "무제한"] },
  { id: "q5", emoji: "⏰", short: "기상", category: "행동 패턴", type: "choice", text: "아침 몇 시에 일어나?", options: ["6시 이전", "8시쯤", "10시 이후", "체크아웃 직전"] },
  { id: "q6", emoji: "🍜", short: "식사", category: "행동 패턴", type: "choice", text: "식사는 어떻게 해결해?", options: ["현지 맛집 필수", "편의점도 OK", "아무거나"] },
  { id: "q7", emoji: "🏝️", short: "코스", category: "행동 패턴", type: "slider", text: "관광지 vs 동네 골목, 어디 쪽이 더 좋아?", scale: ["관광지 위주", "관광지 조금 더", "반반", "골목 조금 더", "골목 위주"] },
  { id: "q8", emoji: "📸", short: "사진", category: "행동 패턴", type: "slider", text: "사진 찍는 빈도는?", scale: ["거의 안 찍음", "몇 장만", "적당히", "사람 따라 눈치 봐가면서", "자주 찍음", "매 순간 기록"] },
  { id: "q9", emoji: "🛍️", short: "쇼핑", category: "행동 패턴", type: "slider", text: "쇼핑에 쓰는 시간과 돈은?", scale: ["거의 없음", "잠깐만", "보이면 들어감", "꽤 큼", "여행의 메인"] },
  { id: "q10", emoji: "📱", short: "이동", category: "행동 패턴", type: "choice", text: "이동 중엔?", options: ["계속 대화", "반반", "각자 폰"] },
  {
    id: "q11",
    emoji: "🚶",
    short: "밀도",
    category: "여행 페이스",
    type: "slider",
    text: "하루에 몇 곳 가는 게 적당해?",
    scale: ["1곳", "2곳", "3곳", "4~6곳", "7곳 이상"],
    descriptions: [
      "여행은 쉬는 거야.. 쉬어야 해..",
      "한 군데만 더 보고, 나머지는 여유롭게.",
      "적당히 보고 적당히 쉬는 게 제일 좋아.",
      "온 김에 볼 건 봐야지. 대신 동선은 잘 짜야 해.",
      "잠은 나중에 자고, 일단 다 찍고 와야 함.",
    ],
  },
  { id: "q12", emoji: "☕", short: "휴식", category: "여행 페이스", type: "slider", text: "카페에서 쉬는 시간은?", scale: ["안 감", "잠깐 1번", "카페 1번", "카페 2번", "3번 이상"] },
  { id: "q13", emoji: "🚧", short: "변수", category: "여행 페이스", type: "choice", text: "길 막힘, 웨이팅 같은 변수가 생기면?", options: ["바로 플랜 B 가동", "일단 기다리기", "다음 일정으로 넘기기"] },
  { id: "q14", emoji: "🛏️", short: "체크인", category: "여행 페이스", type: "choice", text: "숙소 체크인 후 다시 나가?", options: ["무조건 나감", "피곤하면 쉼", "안 나감", "상대가 원하면 맞춰 나감"] },
  { id: "q15", emoji: "⚖️", short: "충돌", category: "갈등 & 결정", type: "choice", text: "가고 싶은 곳이 충돌하면?", options: ["상대 의견 먼저 들음", "중간 지점 협상", "각자 가기", "이번엔 내가 양보"] },
  { id: "q16", emoji: "🍽️", short: "식당 결정", category: "갈등 & 결정", type: "choice", text: "밥 먹을 곳을 못 정하면?", options: ["내가 정함", "상대 따름", "계속 탐색"] },
  { id: "q17", emoji: "🫥", short: "혼자 시간", category: "갈등 & 결정", type: "slider", text: "여행 중 혼자만의 시간이 필요해?", scale: ["전혀 없음", "잠깐만", "1시간 정도", "반나절", "꽤 많이"] },
  { id: "q18", emoji: "🗂️", short: "정리", category: "여행 후", type: "choice", text: "여행 사진 정리는?", options: ["당일 앨범 정리", "나중에 몰아서", "안 함"] },
  { id: "q19", emoji: "📲", short: "업로드", category: "여행 후", type: "slider", text: "여행 후 SNS 업로드는?", scale: ["안 함", "스토리 1~2개", "스토리만", "피드 1개", "스토리+피드"] },
  { id: "q20", emoji: "✈️", short: "다음 여행", category: "여행 후", type: "choice", text: "다음 여행은 언제 또 계획해?", options: ["돌아오는 길에", "1달 후", "한참 뒤", "당분간 없음"] },
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

function getChoicePosition(question: Extract<Question, { type: "choice" }>, answer: string) {
  const index = question.options.indexOf(answer);
  if (index < 0 || question.options.length <= 1) return 50;
  return Math.round((index / (question.options.length - 1)) * 100);
}

function getSliderPosition(question: Extract<Question, { type: "slider" }>, value: AnswerValue) {
  const numeric = Number(value);
  const maxIndex = question.scale.length - 1;
  if (!Number.isFinite(numeric) || maxIndex <= 0) return 50;
  const safeIndex = Math.min(Math.max(Math.round(numeric), 0), maxIndex);
  return Math.round((safeIndex / maxIndex) * 100);
}

function getDefaultSliderValue(question: Extract<Question, { type: "slider" }>) {
  return Math.floor((question.scale.length - 1) / 2);
}

function getQuestionValue(questionId: string, answers: AnswerMap) {
  const question = QUESTIONS.find((item) => item.id === questionId);
  if (!question) return 50;
  const value = answers[questionId];
  if (typeof value === "undefined") return 50;
  if (question.type === "slider") return getSliderPosition(question, value);
  return getChoicePosition(question, String(value));
}

function getAnswerLabel(questionId: string, answers: AnswerMap) {
  const question = QUESTIONS.find((item) => item.id === questionId);
  const value = answers[questionId];
  if (!question || typeof value === "undefined") return "응답 없음";
  if (question.type === "slider") {
    const index = Math.min(Math.max(Math.round(Number(value)), 0), question.scale.length - 1);
    return question.scale[index] ?? "응답 없음";
  }
  return String(value);
}

function getAnswerGap(questionId: string, myAnswers: AnswerMap, partnerAnswers: AnswerMap) {
  return Math.abs(getQuestionValue(questionId, myAnswers) - getQuestionValue(questionId, partnerAnswers));
}

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

function getChoiceScore(question: Extract<Question, { type: "choice" }>, myAnswer: string, partnerAnswer: string) {
  const myIndex = question.options.indexOf(myAnswer);
  const partnerIndex = question.options.indexOf(partnerAnswer);
  if (myIndex < 0 || partnerIndex < 0) return 50;
  if (question.options.length <= 1) return 100;
  const distance = Math.abs(myIndex - partnerIndex) / (question.options.length - 1);
  return Math.max(0, Math.round(100 - distance * 100));
}

function getSliderScore(question: Extract<Question, { type: "slider" }>, myValue: number, partnerValue: number) {
  const myPosition = getSliderPosition(question, myValue);
  const partnerPosition = getSliderPosition(question, partnerValue);
  return Math.max(0, Math.round(100 - Math.abs(myPosition - partnerPosition)));
}

function getTier(score: number) {
  return TIER_RULES.find((rule) => score >= rule.min) ?? TIER_RULES[TIER_RULES.length - 1];
}

function buildDemoTravelAnswers(seed = 0): AnswerMap {
  return Object.fromEntries(
    QUESTIONS.map((question, index) => {
      if (question.type === "slider") {
        return [question.id, (index + seed) % question.scale.length];
      }

      return [question.id, question.options[(index + seed) % question.options.length]];
    }),
  );
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

function getFinalVerdict(score: number) {
  if (score >= 85) {
    return {
      title: "같이 가도 되는 사이",
      body: "굳이 많은 설명이 없어도 리듬이 맞습니다. 일정과 휴식 타이밍이 크게 어긋나지 않는 편입니다.",
    };
  }
  if (score >= 65) {
    return {
      title: "재밌지만 룰이 필요한 사이",
      body: "같이 가면 재밌는데, 디테일에서 부딪힐 여지가 있습니다. 출발 전에 몇 가지만 정하면 훨씬 편해집니다.",
    };
  }
  if (score >= 45) {
    return {
      title: "1박까진 가능, 3박부터 위험",
      body: "짧게는 버틸 수 있지만 일정이 길어질수록 서로의 템포 차이가 크게 느껴질 가능성이 높습니다.",
    };
  }
  return {
    title: "여행은 따로 가는 게 평화로운 사이",
    body: "같이 가면 누군가는 꽤 참게 될 조합입니다. 여행 자체보다 룰 정리가 더 먼저 필요한 타입입니다.",
  };
}

function getPlanningPhrase(answers: AnswerMap) {
  const prep = getQuestionValue("q1", answers);
  const route = String(answers.q3 ?? "큰 틀만");

  if (prep >= 70 || route === "분 단위 계획") {
    return `일정을 미리 세워두고 동선은 "${route}" 쪽으로 굳혀두는 편입니다.`;
  }
  if (prep <= 35 || route === "그냥 가서 봄") {
    return `현장에서 바꾸는 데 부담이 적고, 동선도 "${route}" 쪽에 가깝습니다.`;
  }
  return `큰 틀은 잡되 현장에서 조정하는 편이고, 동선은 "${route}"에 가깝습니다.`;
}

function getPacePhrase(answers: AnswerMap) {
  const density = getQuestionValue("q11", answers);
  const rest = getQuestionValue("q12", answers);
  const afterCheckIn = String(answers.q14 ?? "피곤하면 쉼");

  if (density >= 70 && rest <= 40) {
    return `하루에 여러 곳을 도는 편이고, 체크인 후에도 "${afterCheckIn}" 쪽이라 템포가 빠릅니다.`;
  }
  if (density <= 35 && rest >= 60) {
    return `하루 코스를 적게 잡고 쉬는 시간을 자주 가져야 편한 편입니다. 체크인 후에는 "${afterCheckIn}" 쪽에 가깝습니다.`;
  }
  return `무리하게 달리기보다 상황을 보며 속도를 조절하는 편이고, 체크인 후 선택도 "${afterCheckIn}"에 가깝습니다.`;
}

function getPhotoPhrase(answers: AnswerMap) {
  const photo = getQuestionValue("q8", answers);
  const upload = getQuestionValue("q19", answers);

  if (photo >= 70 || upload >= 70) {
    return "사진과 기록을 여행의 중요한 일부로 보는 편입니다.";
  }
  if (photo <= 35 && upload <= 35) {
    return "기록보다 현장 흐름을 더 중요하게 보는 편입니다.";
  }
  return "기록은 남기되, 여행 흐름을 깨지 않을 정도로만 챙기는 편입니다.";
}

function getBudgetPhrase(answers: AnswerMap) {
  const budget = getQuestionValue("q4", answers);
  const shopping = getQuestionValue("q9", answers);

  if (budget >= 65 || shopping >= 65) {
    return "돈을 조금 더 써도 만족도가 높으면 괜찮다고 보는 편입니다.";
  }
  if (budget <= 35 && shopping <= 35) {
    return "예산선을 넘지 않는 게 중요하고, 쇼핑에도 오래 머물지 않는 편입니다.";
  }
  return "예산과 만족도 사이에서 균형을 보려는 편입니다.";
}

function getAfterCheckInPaceBonus(answer: AnswerValue | undefined) {
  const value = String(answer ?? "피곤하면 쉼");
  if (value === "무조건 나감") return 20;
  if (value === "상대가 원하면 맞춰 나감") return 12;
  if (value === "피곤하면 쉼") return 8;
  return 0;
}

function getTravelFinalContent(myAnswers: AnswerMap, partnerAnswers: AnswerMap, myName: string, partnerName: string) {
  const safeMyName = myName || "A";
  const safePartnerName = partnerName || "B";

  const planningMy = getQuestionValue("q1", myAnswers) + getQuestionValue("q3", myAnswers);
  const planningPartner = getQuestionValue("q1", partnerAnswers) + getQuestionValue("q3", partnerAnswers);

  const photoMy = getQuestionValue("q8", myAnswers) + getQuestionValue("q19", myAnswers) + (String(myAnswers.q2) === "감성" ? 20 : 0);
  const photoPartner = getQuestionValue("q8", partnerAnswers) + getQuestionValue("q19", partnerAnswers) + (String(partnerAnswers.q2) === "감성" ? 20 : 0);

  const budgetGuardMy = (100 - getQuestionValue("q4", myAnswers)) + (100 - getQuestionValue("q9", myAnswers));
  const budgetGuardPartner = (100 - getQuestionValue("q4", partnerAnswers)) + (100 - getQuestionValue("q9", partnerAnswers));

  const spendMy = getQuestionValue("q4", myAnswers) + getQuestionValue("q9", myAnswers);
  const spendPartner = getQuestionValue("q4", partnerAnswers) + getQuestionValue("q9", partnerAnswers);

  const paceMy =
    getQuestionValue("q11", myAnswers) +
    (100 - getQuestionValue("q12", myAnswers)) +
    getAfterCheckInPaceBonus(myAnswers.q14);
  const pacePartner =
    getQuestionValue("q11", partnerAnswers) +
    (100 - getQuestionValue("q12", partnerAnswers)) +
    getAfterCheckInPaceBonus(partnerAnswers.q14);

  const spontaneityMy = (100 - getQuestionValue("q1", myAnswers)) + (100 - getQuestionValue("q3", myAnswers));
  const spontaneityPartner = (100 - getQuestionValue("q1", partnerAnswers)) + (100 - getQuestionValue("q3", partnerAnswers));

  const rechargeMy = getQuestionValue("q12", myAnswers) + getQuestionValue("q17", myAnswers);
  const rechargePartner = getQuestionValue("q12", partnerAnswers) + getQuestionValue("q17", partnerAnswers);

  const moodMy = getQuestionValue("q10", myAnswers) + getQuestionValue("q8", myAnswers);
  const moodPartner = getQuestionValue("q10", partnerAnswers) + getQuestionValue("q8", partnerAnswers);

  const foodStrictMy = (100 - getQuestionValue("q6", myAnswers)) + (100 - getQuestionValue("q16", myAnswers));
  const foodStrictPartner = (100 - getQuestionValue("q6", partnerAnswers)) + (100 - getQuestionValue("q16", partnerAnswers));

  const matchCandidates: Array<NarrativeBlock & { score: number }> = [
    {
      title: "준비 단계에서 크게 안 부딪힐 가능성",
      score: Math.round(100 - (Math.abs(planningMy - planningPartner) / 2)),
      body:
        `${safeMyName}님은 ${getPlanningPhrase(myAnswers)} ` +
        `${safePartnerName}님도 ${getPlanningPhrase(partnerAnswers)} ` +
        `${Math.abs(planningMy - planningPartner) < 35 ? "준비 단계에서 누가 더 앞장서야 하는지 큰 충돌 없이 정리될 가능성이 큽니다." : "완전히 같은 방식은 아니지만, 서로 어느 지점에서 타협해야 하는지는 비교적 보이는 편입니다."}`,
    },
    {
      title: "여행 리듬은 그나마 비슷한 편",
      score: Math.round(100 - (Math.abs(paceMy - pacePartner) / 2)),
      body:
        `${safeMyName}님은 ${getPacePhrase(myAnswers)} ` +
        `${safePartnerName}님은 ${getPacePhrase(partnerAnswers)} ` +
        `${Math.abs(paceMy - pacePartner) < 35 ? "둘 다 하루를 쓰는 템포가 아주 멀진 않아서, 일정만 과하게 밀어넣지 않으면 리듬이 크게 깨지지 않을 조합입니다." : "속도 차이는 있지만, 미리 쉬는 타이밍만 정하면 중간까지는 안정적으로 갈 수 있습니다."}`,
    },
    {
      title: "기록 방식은 이해 가능한 범위",
      score: Math.round(100 - (Math.abs(photoMy - photoPartner) / 2)),
      body:
        `${safeMyName}님은 ${getPhotoPhrase(myAnswers)} ` +
        `${safePartnerName}님도 ${getPhotoPhrase(partnerAnswers)} ` +
        `${Math.abs(photoMy - photoPartner) < 35 ? "기록 욕구 차이가 크지 않아 사진 때문에 흐름이 끊길 가능성은 비교적 낮습니다." : "완전히 같진 않지만, 어느 정도는 서로 맞춰줄 수 있는 구간으로 보입니다."}`,
    },
    {
      title: "돈 쓰는 기준은 설명하면 통할 편",
      score: Math.round(100 - (Math.abs(spendMy - spendPartner) / 2)),
      body:
        `${safeMyName}님은 ${getBudgetPhrase(myAnswers)} ` +
        `${safePartnerName}님도 ${getBudgetPhrase(partnerAnswers)} ` +
        `${Math.abs(spendMy - spendPartner) < 35 ? "소비 기준이 아주 멀지 않아서, 상한선만 정해두면 감정 소모가 크지 않을 가능성이 높습니다." : "지출 기준은 다르지만, 미리 숫자로 합의하면 조정 가능한 범위입니다."}`,
    },
  ].sort((a, b) => b.score - a.score);

  const mismatchCandidates: Array<FlashpointBlock & { score: number; delta: number; partnerPressure: string; myPressure: string }> = [
    {
      key: "pace",
      title: "하루 템포 차이",
      score: Math.abs(paceMy - pacePartner),
      delta: paceMy - pacePartner,
      body:
        `${safeMyName}님은 ${getPacePhrase(myAnswers)} ` +
        `${safePartnerName}님은 ${getPacePhrase(partnerAnswers)} ` +
        "오전엔 괜찮아도 오후부터 체감 속도 차이가 커질 수 있습니다.",
      partnerPressure:
        `${safeMyName}님은 ${getPacePhrase(myAnswers)} 반면 ${safePartnerName}님은 ${getPacePhrase(partnerAnswers)} ` +
        `그래서 ${safePartnerName}님은 중간부터 쫓기는 느낌을 받을 수 있습니다.`,
      myPressure:
        `${safePartnerName}님은 ${getPacePhrase(partnerAnswers)} 반면 ${safeMyName}님은 ${getPacePhrase(myAnswers)} ` +
        `그래서 ${safeMyName}님은 일정이 자꾸 끊긴다고 느낄 수 있습니다.`,
      rule: "하루에 꼭 가야 할 곳 2곳만 먼저 고정하고, 나머지는 체력 보고 추가하기",
    },
    {
      key: "food",
      title: "식사 결정 방식 차이",
      score:
        Math.abs(getQuestionValue("q6", myAnswers) - getQuestionValue("q6", partnerAnswers)) +
        Math.abs(getQuestionValue("q16", myAnswers) - getQuestionValue("q16", partnerAnswers)),
      delta: foodStrictMy - foodStrictPartner,
      body:
        `${safeMyName}님은 식사를 "${String(myAnswers.q6 ?? "")}" 기준으로 보고, 못 정하면 "${String(myAnswers.q16 ?? "")}" 쪽에 가깝습니다. ` +
        `${safePartnerName}님은 "${String(partnerAnswers.q6 ?? "")}" / "${String(partnerAnswers.q16 ?? "")}" 쪽이라 밥 먹기 전 결정 속도에서 차이가 날 수 있습니다.`,
      partnerPressure:
        `${safeMyName}님은 식사 기준이 더 분명하고 결정도 빠르게 내리려는 쪽입니다. ` +
        `${safePartnerName}님은 "${String(partnerAnswers.q16 ?? "")}" 쪽이라, 밥 먹기 전부터 선택을 재촉받는 느낌이 들 수 있습니다.`,
      myPressure:
        `${safePartnerName}님은 식사 앞에서 더 오래 보고 결정하려는 쪽입니다. ` +
        `${safeMyName}님은 "${String(myAnswers.q16 ?? "")}" 쪽으로 답해서, 끼니마다 시간이 길어진다고 느낄 수 있습니다.`,
      rule: "식당 결정권은 끼니마다 번갈아 맡기기",
    },
    {
      key: "photo",
      title: "사진 찍는 텐션 차이",
      score: Math.abs(photoMy - photoPartner),
      delta: photoMy - photoPartner,
      body:
        `${safeMyName}님은 ${getPhotoPhrase(myAnswers)} ` +
        `${safePartnerName}님은 ${getPhotoPhrase(partnerAnswers)} ` +
        "같은 풍경을 봐도 한쪽은 멈추고 싶고 한쪽은 빨리 넘어가고 싶어질 수 있습니다.",
      partnerPressure:
        `${safeMyName}님은 사진과 기록을 더 강하게 남기고 싶어하는 답변을 했습니다. ` +
        `${safePartnerName}님은 흐름을 더 중요하게 보는 편이라 사진 구간이 길어질수록 지칠 수 있습니다.`,
      myPressure:
        `${safePartnerName}님은 기록 욕구가 더 큰 편이라 멈춰 세우는 순간이 잦아질 수 있습니다. ` +
        `${safeMyName}님은 현장 흐름을 더 중요하게 보는 답변을 해서 템포가 끊긴다고 느낄 수 있습니다.`,
      rule: "사진 촬영 시간은 장소마다 10분처럼 상한을 정해두기",
    },
    {
      key: "budget",
      title: "예산과 쇼핑 감각 차이",
      score: Math.abs(spendMy - spendPartner),
      delta: spendMy - spendPartner,
      body:
        `${safeMyName}님은 ${getBudgetPhrase(myAnswers)} ` +
        `${safePartnerName}님은 ${getBudgetPhrase(partnerAnswers)} ` +
        "쇼핑이나 추가 지출이 생기는 순간 누가 먼저 멈추고 누가 더 밀어붙이는지가 드러날 수 있습니다.",
      partnerPressure:
        `${safeMyName}님은 만족도가 높으면 쓰는 쪽에 더 가깝고, ${safePartnerName}님은 예산선에 더 민감한 편입니다. ` +
        `${safePartnerName}님은 작은 지출이 계속 누적될 때 피로를 느낄 수 있습니다.`,
      myPressure:
        `${safePartnerName}님은 현장에서 더 쓰는 쪽에 가깝고, ${safeMyName}님은 예산선에 더 민감한 답변을 했습니다. ` +
        `${safeMyName}님은 소비 순간마다 브레이크를 걸어야 해서 피곤해질 수 있습니다.`,
      rule: "하루 지출 상한과 쇼핑 예산은 따로 분리해서 먼저 정하기",
    },
    {
      key: "plan",
      title: "변수 생겼을 때 판단 충돌",
      score:
        Math.abs(spontaneityMy - spontaneityPartner) +
        Math.abs(getQuestionValue("q13", myAnswers) - getQuestionValue("q13", partnerAnswers)),
      delta: spontaneityMy - spontaneityPartner,
      body:
        `${safeMyName}님은 ${getPlanningPhrase(myAnswers)} ` +
        `${safePartnerName}님은 ${getPlanningPhrase(partnerAnswers)} ` +
        `변수가 생기면 ${safeMyName}님은 "${String(myAnswers.q13 ?? "")}", ${safePartnerName}님은 "${String(partnerAnswers.q13 ?? "")}" 쪽으로 반응합니다.`,
      partnerPressure:
        `${safeMyName}님은 현장에서 바꾸는 쪽으로 더 기울어 있고, ${safePartnerName}님은 준비된 흐름을 지키는 쪽에 더 가깝습니다. ` +
        `${safePartnerName}님은 계획이 흐트러질 때 피로를 느낄 가능성이 큽니다.`,
      myPressure:
        `${safePartnerName}님은 계획을 굳혀두는 쪽에 더 가깝고, ${safeMyName}님은 현장 조정을 허용하는 편입니다. ` +
        `${safeMyName}님은 매번 허락을 받고 움직이는 느낌이 들 수 있습니다.`,
      rule: "돌발 상황이 생기면 누가 최종 결정을 내릴지 미리 정하기",
    },
  ].sort((a, b) => b.score - a.score);

  const partnerPressure =
    mismatchCandidates.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta)[0] ??
    mismatchCandidates[0];
  const myPressure =
    mismatchCandidates.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta)[0] ??
    mismatchCandidates[1] ??
    mismatchCandidates[0];

  const planner = planningMy >= planningPartner ? safeMyName : safePartnerName;
  const restBrake = rechargeMy >= rechargePartner ? safeMyName : safePartnerName;
  const budgetLead = budgetGuardMy >= budgetGuardPartner ? safeMyName : safePartnerName;
  const spendLead = spendMy >= spendPartner ? safeMyName : safePartnerName;
  const moodLead = moodMy >= moodPartner ? safeMyName : safePartnerName;

  const roleStories: NarrativeBlock[] = [
    {
      title: "일정 큰 틀은 누가 잡는 게 나은지",
      body: `${planner}님이 일정 큰 틀을 먼저 잡고, ${restBrake}님이 중간 휴식 타이밍에 브레이크를 거는 편이 덜 부딪힙니다. ${planner}님이 계획 관련 답변에서 더 선명하게 움직였습니다.`,
    },
    {
      title: "돈 쓰는 기준은 누가 잡아야 하는지",
      body: `${budgetLead}님이 예산 상한을 먼저 정하고, ${spendLead}님이 현장 추가 지출이 정말 필요한지 한 번 더 설명하는 구조가 안정적입니다. 두 사람의 소비 감각 차이를 그냥 두면 쇼핑 구간에서 감정이 쌓일 수 있습니다.`,
    },
    {
      title: "분위기 회복은 누가 맡는 게 나은지",
      body: `${moodLead}님이 사진이나 분위기 전환 포인트를 챙기고, ${restBrake}님이 피로 신호를 먼저 말하는 편이 좋습니다. 한쪽이 참고 있다가 터지는 패턴을 막는 역할 분담입니다.`,
    },
  ];

  const answerEvidence = [
    {
      key: "pace-density",
      score: getAnswerGap("q11", myAnswers, partnerAnswers),
      title: "하루를 쓰는 밀도",
      intro:
        `${safeMyName}님은 하루 방문 수를 "${getAnswerLabel("q11", myAnswers)}"로 봤고, ` +
        `${safePartnerName}님은 "${getAnswerLabel("q11", partnerAnswers)}" 쪽에 가까웠습니다.`,
      myLabel: getAnswerLabel("q11", myAnswers),
      partnerLabel: getAnswerLabel("q11", partnerAnswers),
      takeaway:
        Math.abs(paceMy - pacePartner) > 35
          ? "여기서 한쪽은 더 보고 싶고, 다른 한쪽은 이미 충분하다고 느낄 수 있습니다."
          : "방문 수 감각은 크게 멀지 않아서, 쉬는 타이밍만 맞추면 흐름이 부드럽습니다.",
    },
    {
      key: "variable",
      score: getAnswerGap("q13", myAnswers, partnerAnswers),
      title: "변수가 생겼을 때의 반응",
      intro:
        `${safeMyName}님은 "${getAnswerLabel("q13", myAnswers)}", ` +
        `${safePartnerName}님은 "${getAnswerLabel("q13", partnerAnswers)}"로 답했습니다.`,
      myLabel: getAnswerLabel("q13", myAnswers),
      partnerLabel: getAnswerLabel("q13", partnerAnswers),
      takeaway:
        getAnswerGap("q13", myAnswers, partnerAnswers) > 35
          ? "돌발 상황에서 누가 결정을 멈추고, 누가 방향을 바꿀지 미리 정해야 합니다."
          : "돌발 상황 처리 방식은 비슷해서 큰 충돌보다는 빠른 합의가 나올 가능성이 높습니다.",
    },
    {
      key: "photo",
      score: getAnswerGap("q8", myAnswers, partnerAnswers) + getAnswerGap("q19", myAnswers, partnerAnswers) / 2,
      title: "기록을 남기는 온도",
      intro:
        `사진 빈도는 ${safeMyName}님이 "${getAnswerLabel("q8", myAnswers)}", ` +
        `${safePartnerName}님이 "${getAnswerLabel("q8", partnerAnswers)}"로 갈렸습니다.`,
      myLabel: getAnswerLabel("q8", myAnswers),
      partnerLabel: getAnswerLabel("q8", partnerAnswers),
      takeaway:
        Math.abs(photoMy - photoPartner) > 35
          ? "사진 시간이 길어지면 한쪽은 추억을 남긴다고 느끼고, 다른 한쪽은 여행이 멈춘다고 느낄 수 있습니다."
          : "기록에 대한 온도는 크게 다르지 않아, 사진 때문에 흐름이 끊길 가능성은 낮습니다.",
    },
    {
      key: "food",
      score: getAnswerGap("q6", myAnswers, partnerAnswers) + getAnswerGap("q16", myAnswers, partnerAnswers),
      title: "밥 앞에서 드러나는 결정 방식",
      intro:
        `${safeMyName}님은 "${getAnswerLabel("q6", myAnswers)}" / "${getAnswerLabel("q16", myAnswers)}", ` +
        `${safePartnerName}님은 "${getAnswerLabel("q6", partnerAnswers)}" / "${getAnswerLabel("q16", partnerAnswers)}" 쪽입니다.`,
      myLabel: `${getAnswerLabel("q6", myAnswers)} · ${getAnswerLabel("q16", myAnswers)}`,
      partnerLabel: `${getAnswerLabel("q6", partnerAnswers)} · ${getAnswerLabel("q16", partnerAnswers)}`,
      takeaway:
        Math.abs(foodStrictMy - foodStrictPartner) > 35
          ? "끼니마다 작은 의사결정이 쌓일 수 있어서, 한 끼씩 결정권을 나누는 편이 안전합니다."
          : "식사 기준은 설명하면 통하는 범위라, 메뉴보다 결정 시간을 줄이는 게 더 중요합니다.",
    },
    {
      key: "check-in",
      score: getAnswerGap("q14", myAnswers, partnerAnswers),
      title: "숙소에 들어간 뒤의 에너지",
      intro:
        `${safeMyName}님은 체크인 후 "${getAnswerLabel("q14", myAnswers)}", ` +
        `${safePartnerName}님은 "${getAnswerLabel("q14", partnerAnswers)}"로 답했습니다.`,
      myLabel: getAnswerLabel("q14", myAnswers),
      partnerLabel: getAnswerLabel("q14", partnerAnswers),
      takeaway:
        getAnswerGap("q14", myAnswers, partnerAnswers) > 35
          ? "숙소에 들어간 순간부터 에너지 차이가 선명해질 수 있습니다."
          : "체크인 이후 움직임은 서로 맞출 여지가 있습니다.",
    },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      key: item.key,
      title: item.title,
      intro: item.intro,
      myLabel: item.myLabel,
      partnerLabel: item.partnerLabel,
      takeaway: item.takeaway,
    })) satisfies AnswerEvidenceBlock[];

  const topMismatch = mismatchCandidates[0];
  const bestMatch = matchCandidates[0];

  return {
    verdictStory:
      `${bestMatch.title} 쪽에서는 합의 여지가 보이지만, ${topMismatch.title} 구간에 들어가면 갑자기 감정 소모가 커질 가능성이 큽니다. ` +
      `즉 여행 자체가 안 되는 조합이라기보다, 어디에서 리듬이 깨지는지를 먼저 알고 출발해야 덜 싸우는 타입입니다.`,
    matchStories: matchCandidates.slice(0, 2),
    partnerPressure: {
      title: `${safePartnerName}님이 힘들 수 있는 순간`,
      body: partnerPressure.delta > 0 ? partnerPressure.partnerPressure : partnerPressure.myPressure,
    },
    myPressure: {
      title: `${safeMyName}님이 답답해질 수 있는 순간`,
      body: myPressure.delta < 0 ? myPressure.myPressure : myPressure.partnerPressure,
    },
    flashpoints: mismatchCandidates.slice(0, 3),
    answerEvidence,
    roleStories,
    rules: mismatchCandidates.slice(0, 3).map((item) => item.rule),
  };
}

function TravelTogetherFallback() {
  return <main className="min-h-screen bg-white" />;
}

function TravelTogetherPageContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("intro");
  const [history, setHistory] = useState<Step[]>(["intro"]);
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [relation, setRelation] = useState<Relation>("friend");
  const [agreed, setAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [participantToken, setParticipantToken] = useState("");
  const [participantRole, setParticipantRole] = useState<TravelParticipantRole | null>(null);
  const [invitePath, setInvitePath] = useState("");
  const [partnerResultPath, setPartnerResultPath] = useState("");
  const [shareOrigin, setShareOrigin] = useState(DEFAULT_SHARE_ORIGIN);
  const [isSharingKakao, setIsSharingKakao] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "sent" | "copied">("idle");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const [isUnlockingDetails, setIsUnlockingDetails] = useState(false);
  const [resultAnalysisMode, setResultAnalysisMode] = useState<ResultAnalysisMode | null>(null);
  const [resultAnalysisProgress, setResultAnalysisProgress] = useState(0);
  const [resultAnalysisStepIndex, setResultAnalysisStepIndex] = useState(0);
  const [roomError, setRoomError] = useState("");
  const [mySubmitted, setMySubmitted] = useState(false);
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerValue>("");
  const [slider, setSlider] = useState(
    QUESTIONS[0].type === "slider" ? getDefaultSliderValue(QUESTIONS[0]) : 0,
  );
  const [myAnswers, setMyAnswers] = useState<AnswerMap>({});
  const [partnerAnswersState, setPartnerAnswersState] = useState<AnswerMap>({});
  const resultAnalysisCompleteRef = useRef<(() => void) | null>(null);
  const resultOnlyView = searchParams.get("view") === "result";
  const isLocalDebug =
    shareOrigin.includes("localhost") || shareOrigin.includes("127.0.0.1");

  const applyRoomView = useCallback((view: TravelRoomView) => {
    setRoomId(view.roomId);
    setParticipantRole(view.role);
    setRelation(view.relation);
    setMyName(view.myName);
    setPartnerName(view.partnerName);
    setMySubmitted(view.mySubmitted);
    setPartnerSubmitted(view.partnerSubmitted);
    setMyAnswers(view.myAnswers ?? {});
    setPartnerAnswersState(view.partnerAnswers ?? {});
    setInvitePath(view.invitePath);
    setPartnerResultPath(view.partnerResultPath ?? "");
    setUnlocked(Boolean(view.unlocked));
    setRoomError("");
  }, []);

  const resetRoomSession = useCallback((clearNames = false) => {
    setRoomId("");
    setParticipantToken("");
    setParticipantRole(null);
    setInvitePath("");
    setPartnerResultPath("");
    setCopied(false);
    setShareStatus("idle");
    setRoomError("");
    setMySubmitted(false);
    setPartnerSubmitted(false);
    setUnlocked(false);
    setMyAnswers({});
    setPartnerAnswersState({});
    setQIdx(0);
    setCurrentAnswer("");
    if (QUESTIONS[0].type === "slider") {
      setSlider(getDefaultSliderValue(QUESTIONS[0]));
    }
    if (clearNames) {
      setMyName("");
      setPartnerName("");
      setRelation("friend");
    }
  }, []);

  const fetchRoomView = useCallback(async (nextRoomId: string, token: string) => {
    const response = await fetch(`/api/travel-together/room/${encodeURIComponent(nextRoomId)}?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.view) {
      throw new Error(payload?.error ?? "방을 불러오지 못했습니다.");
    }
    applyRoomView(payload.view as TravelRoomView);
    return payload.view as TravelRoomView;
  }, [applyRoomView]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("travel_together_state");
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        step?: Step;
        myName?: string;
        partnerName?: string;
        relation?: Relation;
        roomId?: string;
        participantToken?: string;
        participantRole?: TravelParticipantRole;
        invitePath?: string;
        partnerResultPath?: string;
        mySubmitted?: boolean;
        partnerSubmitted?: boolean;
        myAnswers?: AnswerMap;
        partnerAnswersState?: AnswerMap;
        unlocked?: boolean;
      };
      if (parsed.step) {
        setStep(parsed.step);
        setHistory(["intro", parsed.step]);
      }
      if (parsed.myName) setMyName(parsed.myName);
      if (parsed.partnerName) setPartnerName(parsed.partnerName);
      if (parsed.relation) setRelation(parsed.relation);
      const shouldRestoreRoom = parsed.step !== "intro" && parsed.step !== "setup";
      if (shouldRestoreRoom) {
        if (parsed.roomId) setRoomId(parsed.roomId);
        if (parsed.participantToken) setParticipantToken(parsed.participantToken);
        if (parsed.participantRole) setParticipantRole(parsed.participantRole);
        if (parsed.invitePath) setInvitePath(parsed.invitePath);
        if (parsed.partnerResultPath) setPartnerResultPath(parsed.partnerResultPath);
        if (parsed.mySubmitted) setMySubmitted(parsed.mySubmitted);
        if (parsed.partnerSubmitted) setPartnerSubmitted(parsed.partnerSubmitted);
        if (parsed.myAnswers) setMyAnswers(parsed.myAnswers);
        if (parsed.partnerAnswersState) setPartnerAnswersState(parsed.partnerAnswersState);
        if (parsed.unlocked) setUnlocked(parsed.unlocked);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const nextRoomId = searchParams.get("room");
    const nextToken = searchParams.get("token");
    if (!nextRoomId || !nextToken) return;

    setRoomId(nextRoomId);
    setParticipantToken(nextToken);

    let cancelled = false;
    (async () => {
      try {
        const view = await fetchRoomView(nextRoomId, nextToken);
        if (cancelled) return;
        if (view.mySubmitted && view.partnerSubmitted) {
          setPartnerAnswersState(view.partnerAnswers ?? {});
          if (resultOnlyView) {
            setHistory(["intro", "results"]);
            setStep("results");
          } else {
            setHistory(["intro", "waiting"]);
            setStep("waiting");
          }
        } else {
          setHistory(["intro", "waiting"]);
          setStep("waiting");
        }
      } catch (error) {
        if (cancelled) return;
        setRoomError(error instanceof Error ? error.message : "초대 링크를 불러오지 못했습니다.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchRoomView, resultOnlyView, searchParams]);

  useEffect(() => {
    if (!roomId || !participantToken) return;
    if (searchParams.get("room") && searchParams.get("token")) return;
    if (step === "intro" || step === "setup") return;

    let cancelled = false;
    (async () => {
      try {
        await fetchRoomView(roomId, participantToken);
      } catch (error) {
        if (cancelled) return;
        setRoomError(error instanceof Error ? error.message : "방 상태를 불러오지 못했습니다.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchRoomView, participantToken, roomId, searchParams, step]);

  useEffect(() => {
    if (!roomId || !participantToken) return;
    if (step === "intro" || step === "setup" || step === "questions") return;

    const timer = window.setInterval(() => {
      fetchRoomView(roomId, participantToken).catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [fetchRoomView, participantToken, roomId, step]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "travel_together_state",
        JSON.stringify({
          step,
          myName,
          partnerName,
          relation,
          roomId,
          participantToken,
          participantRole,
          invitePath,
          partnerResultPath,
          mySubmitted,
          partnerSubmitted,
          myAnswers,
          partnerAnswersState,
          unlocked,
        }),
      );
    } catch {}
  }, [step, myName, partnerName, relation, roomId, participantToken, participantRole, invitePath, partnerResultPath, mySubmitted, partnerSubmitted, myAnswers, partnerAnswersState, unlocked]);

  useEffect(() => {
    if (!resultAnalysisMode) return;

    const steps = RESULT_ANALYSIS_STEPS[resultAnalysisMode];
    let progress = 6;
    setResultAnalysisProgress(progress);
    setResultAnalysisStepIndex(0);

    const progressTimer = window.setInterval(() => {
      progress = Math.min(94, progress + 5 + Math.random() * 7);
      setResultAnalysisProgress(Math.round(progress));
      setResultAnalysisStepIndex(Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length)));
    }, 120);

    const finishTimer = window.setTimeout(() => {
      window.clearInterval(progressTimer);
      setResultAnalysisProgress(100);
      setResultAnalysisStepIndex(steps.length - 1);

      window.setTimeout(() => {
        const onComplete = resultAnalysisCompleteRef.current;
        resultAnalysisCompleteRef.current = null;
        setResultAnalysisMode(null);
        onComplete?.();
      }, 280);
    }, 1650);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(finishTimer);
    };
  }, [resultAnalysisMode]);

  const goTo = useCallback((next: Step) => {
    setHistory((prev) => [...prev, next]);
    setStep(next);
  }, []);

  const startResultAnalysis = useCallback((mode: ResultAnalysisMode, onComplete?: () => void) => {
    resultAnalysisCompleteRef.current = onComplete ?? null;
    setResultAnalysisMode(mode);
  }, []);

  const goBack = () => {
    const next = [...history];
    next.pop();
    const prev = next[next.length - 1] ?? "intro";
    setHistory(next.length ? next : ["intro"]);
    setStep(prev);
  };

  const startSetup = () => {
    resetRoomSession(true);
    goTo("setup");
  };

  const handleViewResults = useCallback(() => {
    startResultAnalysis("basic", () => goTo("results"));
  }, [goTo, startResultAnalysis]);

  const inviteLink = useMemo(() => {
    if (invitePath) return `${shareOrigin}${invitePath}`;
    return `${shareOrigin}/travel-together?room=ab12cd`;
  }, [invitePath, shareOrigin]);

  const resultNotifyLink = useMemo(() => {
    if (partnerResultPath) return `${shareOrigin}${partnerResultPath}`;
    if (participantRole === "host" && invitePath) return `${shareOrigin}${invitePath}&view=result`;
    return "";
  }, [invitePath, participantRole, partnerResultPath, shareOrigin]);

  const writeClipboard = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }, []);

  const copyLink = async () => {
    await writeClipboard(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const createRoom = async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    setCopied(false);
    setShareStatus("idle");
    setRoomError("");
    try {
      const response = await fetch("/api/travel-together/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myName: myName.trim(),
          partnerName: partnerName.trim(),
          relation,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.view || !payload?.participantToken) {
        throw new Error(payload?.error ?? "초대 링크 생성에 실패했습니다.");
      }

      applyRoomView(payload.view as TravelRoomView);
      setParticipantToken(String(payload.participantToken));
      setInvitePath(String(payload.invitePath ?? ""));
      void trackClientEvent("lab_travel_room_created");
      goTo("link");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "초대 링크 생성에 실패했습니다.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleKakaoShare = async (mode: "invite" | "result" = "invite") => {
    const shareLink = mode === "result" ? resultNotifyLink : inviteLink;
    if (!shareLink || isSharingKakao) return;
    setIsSharingKakao(true);
    try {
      const Kakao = (window as Window & { Kakao?: KakaoShareSDK }).Kakao;
      const isInitialized = Kakao?.isInitialized?.() ?? false;
      if (!isInitialized) {
        Kakao?.init?.(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      }

      const sendDefault = Kakao?.Share?.sendDefault;
      if (!sendDefault) throw new Error("Kakao SDK unavailable");

      sendDefault({
        objectType: "text",
        text: mode === "result"
          ? `${myName || "친구"}님과의 여행 궁합 결과가 열렸어요 ✈️\n링크 눌러 바로 결과를 확인해보세요.`
          : `${myName || "친구"}님이 ${partnerName || "당신"}에게 여행 궁합 테스트를 보냈어요 ✈️\n링크 열고 같이 답하면 결과가 열립니다.`,
        link: {
          mobileWebUrl: shareLink,
          webUrl: shareLink,
        },
      });
      setShareStatus("sent");
      setTimeout(() => setShareStatus("idle"), 1800);
    } catch {
      const didCopy = await writeClipboard(shareLink);
      if (didCopy) {
        setShareStatus("copied");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        setTimeout(() => setShareStatus("idle"), 1800);
      }
    } finally {
      setTimeout(() => setIsSharingKakao(false), 1200);
    }
  };

  const question = QUESTIONS[qIdx];
  const answerReady = question?.type === "slider" ? true : String(currentAnswer).trim().length > 0;

  const submitAnswer = async () => {
    if (!question) return;
    const value = question.type === "slider" ? slider : currentAnswer;
    const nextAnswers = { ...myAnswers, [question.id]: value };
    setMyAnswers(nextAnswers);
    if (qIdx < QUESTIONS.length - 1) {
      const nextQuestion = QUESTIONS[qIdx + 1];
      setQIdx((prev) => prev + 1);
      setCurrentAnswer("");
      if (nextQuestion?.type === "slider") {
        setSlider(getDefaultSliderValue(nextQuestion));
      }
      return;
    }
    if (!roomId || !participantToken) {
      setRoomError("방 정보가 없어서 응답을 제출할 수 없습니다.");
      return;
    }

    setIsSubmittingAnswers(true);
    setRoomError("");
    try {
      const response = await fetch(`/api/travel-together/room/${encodeURIComponent(roomId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: participantToken,
          answers: nextAnswers,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.view) {
        throw new Error(payload?.error ?? "응답 제출에 실패했습니다.");
      }

      applyRoomView(payload.view as TravelRoomView);
      setQIdx(0);
      setCurrentAnswer("");
      if (QUESTIONS[0].type === "slider") {
        setSlider(getDefaultSliderValue(QUESTIONS[0]));
      }
      void trackClientEvent("lab_travel_response_completed");
      setStep("waiting");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "응답 제출에 실패했습니다.");
    } finally {
      setIsSubmittingAnswers(false);
    }
  };

  const handleUnlock = async () => {
    if (!roomId || !participantToken || isUnlockingDetails) return;
    setIsUnlockingDetails(true);
    setRoomError("");
    try {
      const response = await fetch(
        `/api/travel-together/room/${encodeURIComponent(roomId)}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: participantToken }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.view) {
        throw new Error(payload?.error ?? "상세 결과 결제에 실패했습니다.");
      }

      applyRoomView(payload.view as TravelRoomView);
      void trackClientEvent("lab_travel_unlock", {
        room_id: roomId,
        charged_credits: payload.chargedCredits ?? 0,
      });
      startResultAnalysis("detail");
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "상세 결과 결제에 실패했습니다.",
      );
    } finally {
      setIsUnlockingDetails(false);
    }
  };

  const results = useMemo(() => {
    const partnerAnswers = partnerAnswersState;
    const categoryScores = new Map<string, number[]>();

    QUESTIONS.forEach((item) => {
      const myValue = myAnswers[item.id];
      const partnerValue = partnerAnswers[item.id];
      if (typeof myValue === "undefined" || typeof partnerValue === "undefined") return;

      const score =
        item.type === "slider"
          ? getSliderScore(item, Number(myValue), Number(partnerValue))
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
    const finalContent = getTravelFinalContent(myAnswers, partnerAnswers, myName, partnerName);

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
      finalVerdict: getFinalVerdict(overall),
      finalContent,
    };
  }, [myAnswers, partnerAnswersState, relation, myName, partnerName]);

  const startTest = () => {
    setCurrentAnswer("");
    if (QUESTIONS[0].type === "slider") {
      setSlider(getDefaultSliderValue(QUESTIONS[0]));
    }
    setQIdx(0);
    goTo("questions");
  };

  const fillLocalPreviewResults = () => {
    const demoMyName = myName.trim() || "지환";
    const demoPartnerName = partnerName.trim() || "민지";
    setMyName(demoMyName);
    setPartnerName(demoPartnerName);
    setRoomId("");
    setParticipantToken("");
    setParticipantRole(null);
    setInvitePath("");
    setMySubmitted(true);
    setPartnerSubmitted(true);
    setUnlocked(true);
    setMyAnswers(buildDemoTravelAnswers(1));
    setPartnerAnswersState(buildDemoTravelAnswers(3));
    setQIdx(0);
    setCurrentAnswer("");
    setRoomError("");
    setHistory(["intro", "results"]);
    setStep("results");
  };

  const resultAnalysisSteps = resultAnalysisMode ? RESULT_ANALYSIS_STEPS[resultAnalysisMode] : RESULT_ANALYSIS_STEPS.basic;
  const resultAnalysisLabel = resultAnalysisSteps[resultAnalysisStepIndex] ?? resultAnalysisSteps[0];

  return (
    <main className="min-h-screen bg-white flex flex-col" style={{ fontFamily: '"Pretendard", "SUIT Variable", sans-serif' }}>
      {resultAnalysisMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080B13]/96 px-6 text-white">
          <style>{`
            @keyframes travel-analysis-spin {
              to { transform: rotate(360deg); }
            }
            @keyframes travel-analysis-float {
              0%, 100% { transform: translateY(0); opacity: 0.72; }
              50% { transform: translateY(-7px); opacity: 1; }
            }
          `}</style>
          <div className="w-full max-w-[390px]">
            <div className="mb-6 flex items-center justify-center gap-2">
              {["🧳", "📍", "☕", "✈️"].map((icon, index) => (
                <span
                  key={icon}
                  className="text-[26px]"
                  style={{ animation: `travel-analysis-float 1.6s ease-in-out ${index * 0.16}s infinite` }}
                >
                  {icon}
                </span>
              ))}
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-3xl bg-white/[0.08]">
                  <div
                    className="absolute inset-0 rounded-3xl border border-[#60A5FA]/50"
                    style={{ animation: "travel-analysis-spin 1.15s linear infinite" }}
                  />
                  <span className="text-[28px]">{resultAnalysisMode === "detail" ? "🔓" : "🔎"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/35">
                    {resultAnalysisMode === "detail" ? "Premium Report" : "Travel Analysis"}
                  </p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.04em] text-white">
                    {resultAnalysisLabel}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-relaxed text-white/42">
                    두 사람의 답변 차이를 정리하고 있어요. 잠시만 기다려주세요.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#60A5FA] to-[#93C5FD] transition-all duration-200"
                    style={{ width: `${resultAnalysisProgress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-white/35">
                  <span>리포트 구성 중</span>
                  <span className="tabular-nums text-[#93C5FD]">{resultAnalysisProgress}%</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {resultAnalysisSteps.map((stepLabel, index) => (
                  <div
                    key={stepLabel}
                    className="h-1.5 rounded-full transition-colors"
                    style={{ background: index <= resultAnalysisStepIndex ? "#60A5FA" : "rgba(255,255,255,0.1)" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {roomError && (
        <div className="mx-5 mt-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#B91C1C]">{roomError}</p>
        </div>
      )}

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
              <span className="text-[14px]" style={{ color: T.text }}>궁합 티어와 최종 여행 결과를 보여줘요</span>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["2인 여행 궁합", "20문항", "기본 결과 무료 공개", "상세 결과 2크레딧"].map((tag) => (
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
              { num: "04", en: "DETAIL", ko: "상세 결과를 봐요", desc: "기본 결과 확인 후\n상세 결과를 2크레딧으로 봐요." },
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
              onClick={() => agreed && startSetup()}
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
              onClick={() => myName.trim() && partnerName.trim() && createRoom()}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: myName.trim() && partnerName.trim() ? "#111" : "#F3F4F6", color: myName.trim() && partnerName.trim() ? "#fff" : "#9CA3AF" }}
            >
              {isCreatingRoom ? "링크 만드는 중..." : "초대 링크 만들기"}
            </button>
            {isLocalDebug && (
              <button
                type="button"
                onClick={fillLocalPreviewResults}
                className="mt-3 w-full py-4 rounded-2xl font-black text-[15px] transition-all active:scale-[0.97]"
                style={{ background: T.bg, color: T.text, border: `1px solid ${T.border}` }}
              >
                로컬 테스트용 결과 바로 보기
              </button>
            )}
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
                <p className="text-[13px] font-semibold text-gray-700 truncate">{inviteLink.replace(/^https?:\/\//, "")}</p>
              </div>
              <button onClick={copyLink} className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-[13px] text-white transition-all" style={{ background: copied ? T.mid : "#111" }}>
                {copied ? "복사됨 ✓" : "복사"}
              </button>
            </div>

            <button
              onClick={() => void handleKakaoShare("invite")}
              disabled={!invitePath || isSharingKakao}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-70"
              style={{ background: "#FEE500", color: "#191919" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
              {isSharingKakao ? "보내는 중..." : shareStatus === "sent" ? "카카오톡 열림 ✓" : shareStatus === "copied" ? "링크 복사됨 ✓" : "카카오톡으로 보내기"}
            </button>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-[13px] font-black text-gray-900 mb-3">결과에 포함되는 것</p>
              <div className="flex flex-col gap-2.5">
                {[
                  "궁합 점수 + 티어",
                  "잘 맞는 포인트 / 주의 포인트",
                  "기본 한 줄 결과",
                  "둘이 잘 맞는 장면",
                  "서로 힘들어질 순간 분석",
                  "같이 가면 터지는 순간 TOP3",
                  "여행 역할 분담 결과",
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
            {participantRole && (
              <p className="text-[12px] font-semibold mt-2" style={{ color: T.text }}>
                {participantRole === "host" ? "내가 만든 방" : "초대 링크로 입장한 상태"}
              </p>
            )}
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
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-[14px] font-black text-gray-900">상대 응답 기다리기</p>
              <p className="text-[13px] text-gray-500 mt-1">상대가 링크에서 답변을 마치면 이 화면이 자동으로 갱신됩니다.</p>
            </div>
          )}

          {mySubmitted && partnerSubmitted && (
            <div className="flex flex-col gap-3">
              <button onClick={handleViewResults} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: T.mid, color: "#fff" }}>
                결과 확인하기
              </button>
              <button
                type="button"
                onClick={() => void handleKakaoShare("result")}
                disabled={!resultNotifyLink || isSharingKakao}
                className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                style={{ background: "#FEE500", color: "#191919" }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
                {isSharingKakao ? "보내는 중..." : shareStatus === "sent" ? "카카오톡 열림 ✓" : shareStatus === "copied" ? "링크 복사됨 ✓" : "친구에게 결과 알리기"}
              </button>
            </div>
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
                    className="w-full rounded-[24px] border px-6 py-5 text-left transition-all min-h-[78px]"
                    style={{
                      borderColor: currentAnswer === option ? T.mid : "#E5E7EB",
                      background: currentAnswer === option ? T.bg : "white",
                      color: currentAnswer === option ? T.text : "#1F2937",
                      boxShadow: currentAnswer === option ? `0 0 0 3px ${T.bg}` : undefined,
                    }}
                  >
                    <span className="text-[18px] font-black tracking-[-0.01em]">{option}</span>
                  </button>
                ))}
              </div>
            )}

            {question.type === "slider" && (
              <div className="flex flex-col gap-2">
                {question.scale.map((label, index) => {
                  const active = slider === index;
                  const description = question.descriptions?.[index];
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSlider(index)}
                      className="w-full rounded-[24px] border px-6 py-5 text-left transition-all min-h-[78px]"
                      style={{
                        borderColor: active ? T.mid : "#E5E7EB",
                        background: active ? T.bg : "white",
                        color: active ? T.text : "#1F2937",
                        boxShadow: active ? `0 0 0 3px ${T.bg}` : undefined,
                      }}
                    >
                      <span className="block text-[18px] font-black tracking-[-0.01em]">{label}</span>
                      {description && (
                        <span className="mt-1 block text-[13px] font-bold leading-snug opacity-60">
                          {description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button onClick={answerReady ? submitAnswer : undefined} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]" style={{ background: answerReady ? "#111" : "#F3F4F6", color: answerReady ? "#fff" : "#9CA3AF" }}>
              {isSubmittingAnswers ? "제출 중..." : qIdx < QUESTIONS.length - 1 ? "다음" : "내 답변 제출"}
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
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">기본 공개</p>
            <div className="rounded-2xl px-4 py-4" style={{ background: T.bg }}>
              <p className="text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: T.text }}>국내 추천 미리보기</p>
              <p className="text-[20px] font-black text-gray-900 mt-2">{results.previewDomestic.title}</p>
              <p className="text-[13px] text-gray-500 mt-1">{results.previewDomestic.mood}</p>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-3">{results.previewDomestic.blurb}</p>
            </div>
          </section>

          {unlocked ? (
            <>
              <section className="mx-6 border-t border-gray-200 pt-8 pb-7">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-gray-400 mb-4">Paid Report</p>
                <h3 className="text-[34px] font-black tracking-[-0.055em] leading-[1.05] text-gray-950">
                  {results.finalVerdict.title}
                </h3>
                <p className="mt-5 text-[16px] font-bold leading-[1.75] text-gray-700">
                  {results.finalContent.verdictStory}
                </p>
              </section>

              <section className="mx-6 border-t border-gray-200 py-7">
                <div className="mb-6">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-gray-400">Answer Gap</p>
                  <h3 className="mt-2 text-[25px] font-black tracking-[-0.05em] leading-tight text-gray-950">
                    실제 답변에서 갈린 지점
                  </h3>
                </div>
                <div className="flex flex-col gap-5">
                  {results.finalContent.answerEvidence.map((item, index) => (
                    <article key={item.key} className="rounded-[24px] border border-gray-200 bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-950 text-[12px] font-black text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-[19px] font-black tracking-[-0.04em] leading-tight text-gray-950">{item.title}</h4>
                          <p className="mt-2 text-[13px] font-semibold leading-[1.55] text-gray-500">{item.intro}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-gray-50 px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">{myName || "나"}</p>
                          <p className="mt-1 text-[14px] font-black leading-snug text-gray-950">{item.myLabel}</p>
                        </div>
                        <div className="rounded-2xl px-3 py-3" style={{ background: T.bg }}>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: T.text }}>{partnerName || "상대"}</p>
                          <p className="mt-1 text-[14px] font-black leading-snug text-gray-950">{item.partnerLabel}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[13px] font-black leading-relaxed" style={{ color: T.text }}>{item.takeaway}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mx-6 border-t border-gray-200 py-7">
                <div className="mb-5">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-gray-400">Flash Point</p>
                  <h3 className="mt-2 text-[25px] font-black tracking-[-0.05em] leading-tight text-gray-950">
                    같이 가면 터질 수 있는 순간
                  </h3>
                </div>
                <div className="flex flex-col divide-y divide-gray-100">
                  {results.finalContent.flashpoints.map((item, index) => (
                    <article key={item.key} className="py-5 first:pt-0">
                      <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: T.text }}>Top {index + 1}</p>
                      <h4 className="mt-2 text-[22px] font-black tracking-[-0.045em] leading-tight text-gray-950">{item.title}</h4>
                      <p className="mt-3 text-[14px] font-semibold leading-[1.65] text-gray-600">{item.body}</p>
                      <p className="mt-4 rounded-2xl px-4 py-3 text-[13px] font-black leading-relaxed" style={{ background: T.bg, color: T.text }}>
                        합의 포인트 · {item.rule}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mx-6 border-t border-gray-200 py-7">
                <div className="mb-5">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-gray-400">Rules</p>
                  <h3 className="mt-2 text-[25px] font-black tracking-[-0.05em] leading-tight text-gray-950">
                    여행 전 이것만 정하기
                  </h3>
                </div>
                <div className="flex flex-col gap-4">
                  {results.finalContent.rules.map((rule, index) => (
                    <article key={rule} className="grid grid-cols-[44px_1fr] gap-3 border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                      <p className="text-[13px] font-black uppercase tracking-[0.12em]" style={{ color: T.text }}>R{index + 1}</p>
                      <p className="text-[15px] font-black leading-relaxed text-gray-800">{rule}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="mx-6 mb-4 relative overflow-hidden rounded-2xl border border-gray-100">
                <div className="blur-[3px] select-none pointer-events-none px-5 py-5" aria-hidden>
                  <p className="text-[11px] font-black text-gray-400 mb-3">최종 여행 동행 판정</p>
                  <p className="text-[24px] font-black text-gray-900 leading-tight">{results.finalVerdict.title}</p>
                  <p className="text-[14px] text-gray-600 leading-relaxed mt-3">{results.finalContent.verdictStory}</p>
                </div>
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px]" />
              </section>

              <section className="mx-6 mb-4 relative overflow-hidden rounded-2xl border border-gray-100">
                <div className="blur-[3px] select-none pointer-events-none px-5 py-5" aria-hidden>
                  <p className="text-[11px] font-black text-gray-400 mb-3">둘이 잘 맞는 장면</p>
                  <div className="flex flex-col gap-3">
                    {results.finalContent.matchStories.map((item) => (
                      <div key={item.title} className="rounded-xl px-4 py-4" style={{ background: "#F8FAFC" }}>
                        <p className="text-[16px] font-black text-gray-900">{item.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px]" />
              </section>

              <section className="mx-6 mb-4 grid grid-cols-2 gap-3 relative overflow-hidden">
                {[
                  `${partnerName || "상대"}가 힘들 수 있는 순간`,
                  `${myName || "나"}가 답답해질 순간`,
                  "여행 역할 분담 결과",
                  "합의해야 할 규칙",
                ].map((label) => (
                  <div key={label} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 blur-[2px] select-none" aria-hidden>
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
                    <p className="text-[15px] font-black text-gray-900">██████</p>
                  </div>
                ))}
              </section>

              <section className="mx-6 mb-4 rounded-3xl overflow-hidden border border-[#BFDBFE] bg-[#0F172A]">
                <div className="px-6 py-7 flex flex-col items-center text-center gap-4">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: "#93C5FD" }}>Final Travel Report</p>
                    <p className="text-[22px] font-black text-white leading-tight mb-2">상세 결과 보기</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.58)" }}>
                      서로 잘 맞는 장면 · 서로 힘들어질 순간 분석<br />
                      터지는 순간 TOP3 · 역할 분담 결과
                    </p>
                  </div>
                  <button onClick={handleUnlock} disabled={isUnlockingDetails} className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97] disabled:opacity-70" style={{ background: "#60A5FA", color: "white" }}>
                    {isUnlockingDetails ? "결제 중..." : `${DETAIL_UNLOCK_CREDITS}크레딧으로 보기`}
                  </button>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>한 명만 결제하면 두 사람 모두 같은 상세 결과를 볼 수 있어요</p>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </main>
  );
}

export default function TravelTogetherPage() {
  return (
    <Suspense fallback={<TravelTogetherFallback />}>
      <TravelTogetherPageContent />
    </Suspense>
  );
}
