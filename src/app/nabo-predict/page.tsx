"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trackClientEvent } from "@/lib/client-events";

const P = {
  bg: "#FFF7ED",
  border: "#FED7AA",
  light: "#FFEDD5",
  mid: "#F97316",
  rose: "#FB7185",
  teal: "#14B8A6",
  dark: "#9A3412",
  text: "#C2410C",
  deep: "#7C2D12",
} as const;

const TOTAL_QUESTIONS = 8;

type Step =
  | "intro"
  | "setup"
  | "predictQuestions"
  | "share"
  | "answerIntro"
  | "answerQuestions"
  | "analyzing"
  | "result";

type TraitKey = "steady" | "spark" | "care" | "logic" | "direct" | "quiet";
type AnswerMap = Record<string, string>;

type Choice = {
  id: string;
  label: string;
  trait: TraitKey;
  summary: string;
};

type Question = {
  id: string;
  mark: string;
  short: string;
  category: string;
  text: (name: string) => string;
  options: Choice[];
};

type InvitePayload = {
  version: 1;
  ownerName: string;
  targetName: string;
  predictions: AnswerMap;
  createdAt: number;
  sessionId: string;
};

type Comparison = {
  question: Question;
  predicted: Choice;
  actual: Choice;
  exact: boolean;
  close: boolean;
};

type ResultTone = "perfect" | "high" | "middle" | "low";

type ResultProfile = {
  badge: string;
  tone: ResultTone;
};

type ConversationCard = {
  label: string;
  title: string;
  body: string;
  tone: "green" | "orange" | "dark";
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

const TRAITS: Record<TraitKey, { label: string; title: string; copy: string }> = {
  steady: {
    label: "안정",
    title: "익숙한 걸 편하게 고름",
    copy: "새로운 것보다 이미 편한 선택을 더 좋아하는 모습이에요.",
  },
  spark: {
    label: "즉흥",
    title: "재밌으면 바로 해봄",
    copy: "생각이 길어지기보다 분위기 타면 움직이는 쪽이에요.",
  },
  care: {
    label: "배려",
    title: "상대를 먼저 생각함",
    copy: "내 선택보다 같이 있는 사람의 기분을 먼저 보는 편이에요.",
  },
  logic: {
    label: "정리",
    title: "확인하고 움직임",
    copy: "그냥 고르기보다 이유와 조건을 먼저 보는 쪽이에요.",
  },
  direct: {
    label: "직진",
    title: "바로 말하는 편",
    copy: "돌려 말하기보다 바로 표현하고 정리하는 편이에요.",
  },
  quiet: {
    label: "관찰",
    title: "혼자 생각하는 편",
    copy: "바로 드러내기보다 먼저 혼자 정리하는 모습이 보여요.",
  },
};

const QUESTIONS: Question[] = [
  {
    id: "q1",
    mark: "01",
    short: "빈 시간",
    category: "예상 밖 상황",
    text: (name) => `${name}님은 약속이 갑자기 취소되면?`,
    options: [
      { id: "rest", label: "집에서 조용히 쉰다", trait: "steady", summary: "쉬는 쪽" },
      { id: "reroute", label: "바로 다른 약속을 잡는다", trait: "spark", summary: "다른 약속" },
      { id: "solo", label: "혼자 가고 싶던 곳을 간다", trait: "quiet", summary: "혼자 이동" },
      { id: "organize", label: "밀린 일을 정리한다", trait: "logic", summary: "정리 모드" },
    ],
  },
  {
    id: "q2",
    mark: "02",
    short: "메뉴 결정",
    category: "선택 방식",
    text: (name) => `${name}님은 메뉴를 못 정할 때?`,
    options: [
      { id: "same", label: "늘 먹던 안전한 메뉴를 고른다", trait: "steady", summary: "안전한 선택" },
      { id: "new", label: "처음 보는 메뉴를 시도한다", trait: "spark", summary: "새로운 선택" },
      { id: "other", label: "상대가 먹고 싶은 걸 먼저 묻는다", trait: "care", summary: "상대 우선" },
      { id: "review", label: "후기와 평점을 빠르게 본다", trait: "logic", summary: "후기 확인" },
    ],
  },
  {
    id: "q3",
    mark: "03",
    short: "기분 상함",
    category: "감정 표현",
    text: (name) => `${name}님은 기분이 상하면?`,
    options: [
      { id: "say", label: "바로 말한다", trait: "direct", summary: "바로 말함" },
      { id: "cool", label: "티 안 내고 혼자 정리한다", trait: "quiet", summary: "혼자 정리" },
      { id: "soft", label: "분위기 상하지 않게 돌려 말한다", trait: "care", summary: "부드럽게 말함" },
      { id: "reason", label: "왜 그랬는지 먼저 따져본다", trait: "logic", summary: "이유 확인" },
    ],
  },
  {
    id: "q4",
    mark: "04",
    short: "답장",
    category: "연락 패턴",
    text: (name) => `${name}님은 메시지 답장이 늦어졌을 때?`,
    options: [
      { id: "explain", label: "늦은 이유를 설명한다", trait: "care", summary: "이유 설명" },
      { id: "normal", label: "아무 일 없듯 이어간다", trait: "steady", summary: "자연스럽게 이어감" },
      { id: "short", label: "짧게 답하고 다시 사라진다", trait: "quiet", summary: "짧은 답장" },
      { id: "call", label: "답장보다 전화가 빠르다고 본다", trait: "direct", summary: "전화 선호" },
    ],
  },
  {
    id: "q5",
    mark: "05",
    short: "새 제안",
    category: "행동 속도",
    text: (name) => `${name}님은 갑자기 새로운 제안을 받으면?`,
    options: [
      { id: "yes", label: "재밌겠다며 일단 한다", trait: "spark", summary: "일단 해봄" },
      { id: "check", label: "일정과 조건을 먼저 확인한다", trait: "logic", summary: "조건 확인" },
      { id: "ask", label: "다른 사람 의견을 먼저 듣는다", trait: "care", summary: "의견 확인" },
      { id: "pass", label: "익숙하지 않으면 보류한다", trait: "steady", summary: "보류" },
    ],
  },
  {
    id: "q6",
    mark: "06",
    short: "칭찬 반응",
    category: "표현 방식",
    text: (name) => `${name}님은 칭찬을 들으면?`,
    options: [
      { id: "deny", label: "아니라고 하면서 살짝 좋아한다", trait: "quiet", summary: "살짝 좋아함" },
      { id: "thanks", label: "고맙다고 바로 받는다", trait: "direct", summary: "바로 받음" },
      { id: "return", label: "상대도 같이 칭찬해준다", trait: "care", summary: "칭찬 돌려줌" },
      { id: "joke", label: "농담으로 분위기를 넘긴다", trait: "spark", summary: "농담으로 넘김" },
    ],
  },
  {
    id: "q7",
    mark: "07",
    short: "돈 쓰기",
    category: "소비 판단",
    text: (name) => `${name}님은 갖고 싶은 게 생기면?`,
    options: [
      { id: "buy", label: "마음 가면 바로 산다", trait: "spark", summary: "바로 구매" },
      { id: "compare", label: "가격 비교 후 산다", trait: "logic", summary: "가격 비교" },
      { id: "wait", label: "며칠 지나도 생각나면 산다", trait: "steady", summary: "며칠 대기" },
      { id: "gift", label: "내 것보다 선물에 더 잘 쓴다", trait: "care", summary: "선물 우선" },
    ],
  },
  {
    id: "q8",
    mark: "08",
    short: "피곤한 날",
    category: "에너지 회복",
    text: (name) => `${name}님은 피곤한 날에 더 가까운 쪽은?`,
    options: [
      { id: "alone", label: "혼자 있어야 회복된다", trait: "quiet", summary: "혼자 회복" },
      { id: "routine", label: "평소 루틴을 지키며 회복한다", trait: "steady", summary: "루틴 회복" },
      { id: "people", label: "좋아하는 사람을 만나야 풀린다", trait: "care", summary: "사람으로 회복" },
      { id: "move", label: "나가서 움직여야 풀린다", trait: "spark", summary: "움직이며 회복" },
    ],
  },
];

const RESULT_PROFILES: Array<{ min: number; profile: ResultProfile }> = [
  {
    min: 100,
    profile: {
      badge: "모두 일치",
      tone: "perfect",
    },
  },
  {
    min: 75,
    profile: {
      badge: "높은 일치",
      tone: "high",
    },
  },
  {
    min: 50,
    profile: {
      badge: "보통 일치",
      tone: "middle",
    },
  },
  {
    min: 0,
    profile: {
      badge: "낮은 일치",
      tone: "low",
    },
  },
];

const RESULT_TITLE_VARIANTS: Record<ResultTone, string[]> = {
  perfect: [
    "이 정도면 거의 도플갱어?!",
    "답안 복붙 수준",
    "마음속을 본 줄",
    "너무 잘 아는 사이",
    "완전 일치 모드",
    "소름 돋는 예측력",
    "친구 사용 설명서 보유자",
    "이건 거의 정답지",
  ],
  high: [
    "거의 다 맞힘",
    "이 정도면 눈치왕",
    "꽤 잘 봤네?",
    "반쯤은 마음 읽기",
    "친구 레이더 좋음",
    "아는 만큼 맞혔다",
    "예측 감각 살아있음",
    "거의 손바닥 안",
  ],
  middle: [
    "알 듯 말 듯한 사이",
    "반은 맞고 반은 새로움",
    "생각보다 의외였음",
    "익숙함과 반전 사이",
    "꽤 재밌게 갈림",
    "아는 얼굴에 새 선택",
    "대화거리 생김",
  ],
  low: [
    "생각보다 다른 사람",
    "반전이 꽤 많음",
    "친구 설명서 업데이트 필요",
    "예상 밖 선택 모음",
    "오히려 더 궁금해짐",
    "새로운 면 발견",
    "다시 맞혀보고 싶음",
  ],
};

const RESULT_BODY_VARIANTS: Record<ResultTone, string[]> = {
  perfect: [
    "8개 질문이 전부 같았어요. 평소 선택을 정말 가까이서 보고 있었네요.",
    "이건 찍은 게 아니라 기억한 수준이에요. 작은 습관까지 꽤 정확했어요.",
    "둘의 답이 완전히 맞았어요. 서로의 선택 흐름을 거의 그대로 알고 있어요.",
    "예측과 실제 답변이 모두 일치했어요. 오늘 결과는 자랑해도 됩니다.",
    "친구가 고를 답을 하나도 놓치지 않았어요. 꽤 오래 본 사이 느낌이에요.",
    "결과가 너무 깔끔해요. 서로의 기본값을 아주 잘 알고 있어요.",
    "8문항 전부 같은 답이에요. 이 정도면 다음 선택도 맞힐 기세예요.",
    "완전 일치가 나왔어요. 둘 사이에 설명이 필요 없는 부분이 많네요.",
  ],
  high: [
    "대부분의 선택을 맞혔어요. 몇 개만 살짝 다른 게 오히려 더 재밌어요.",
    "큰 방향은 거의 맞았어요. 친구의 익숙한 모습을 잘 기억하고 있네요.",
    "맞힌 답이 꽤 많아요. 평소 행동을 그냥 넘기지 않고 보고 있었던 쪽이에요.",
    "이 정도면 충분히 잘 맞혔어요. 다른 답은 톡에서 물어보면 딱 좋아요.",
    "예측력이 꽤 좋아요. 친구의 기본 선택을 잘 알고 있는 관계예요.",
    "많이 맞고 조금 갈렸어요. 그래서 결과가 너무 뻔하지 않고 좋아요.",
    "친구의 자주 나오는 선택을 잘 잡았어요. 다른 부분은 새로 알게 된 포인트예요.",
    "거의 맞혔지만 완전 복붙은 아니에요. 딱 대화하기 좋은 결과예요.",
  ],
  middle: [
    "맞은 답과 다른 답이 섞였어요. 서로 아는 모습과 의외의 모습이 같이 나왔어요.",
    "절반쯤은 감을 잡았고, 절반쯤은 새로 알게 됐어요.",
    "예상과 실제가 적당히 갈렸어요. 결과를 보면서 웃을 포인트가 많아요.",
    "친한 것 같은데 은근히 다른 선택도 있어요. 바로 얘기해보기 좋은 결과예요.",
    "익숙한 부분은 맞혔고, 디테일은 꽤 달랐어요. 여기서부터 재밌어집니다.",
    "완전히 틀리진 않았지만 반전도 있어요. 친구의 새 면이 조금 보였어요.",
    "딱 중간 정도예요. 서로가 생각한 이미지와 실제 선택이 살짝 다르네요.",
  ],
  low: [
    "예상과 실제가 많이 달랐어요. 그래서 오히려 친구를 새로 보는 느낌이에요.",
    "생각한 답과 다른 선택이 많아요. 오늘 결과로 업데이트할 게 꽤 있어요.",
    "친구가 은근히 반전 많은 타입일 수 있어요. 바로 물어보고 싶은 답이 많네요.",
    "많이 엇갈렸지만 실패는 아니에요. 몰랐던 취향을 발견한 결과예요.",
    "예측은 빗나갔지만 대화거리는 확실히 생겼어요.",
    "친구의 실제 선택이 생각보다 달랐어요. 다음엔 더 잘 맞힐 수 있을지도요.",
    "의외의 답이 많았어요. 관계가 얕다는 뜻보다 새로 알 부분이 많다는 쪽에 가까워요.",
  ],
};

const TRAIT_TONE_LINES: Record<ResultTone, string[]> = {
  perfect: [
    "둘이 본 모습이 거의 같았어요.",
    "이 부분은 서로 확실히 알고 있었네요.",
    "평소 이미지와 실제 답이 잘 맞았어요.",
    "서로 떠올린 모습이 거의 한 방향이에요.",
  ],
  high: [
    "큰 흐름은 잘 맞았어요.",
    "자주 보이던 모습은 정확히 잡았네요.",
    "대체로 예상한 이미지와 가까워요.",
    "몇 가지 차이는 있지만 방향은 비슷해요.",
  ],
  middle: [
    "맞는 부분도 있고 다른 부분도 있어요.",
    "생각보다 다른 선택이 섞여 있었어요.",
    "익숙한 모습과 새로운 모습이 같이 보여요.",
    "이 부분은 톡에서 물어보면 재밌겠어요.",
  ],
  low: [
    "예상과 실제가 꽤 달랐어요.",
    "알고 있던 이미지와 다른 면이 보였어요.",
    "새로 업데이트할 부분이 많아 보여요.",
    "다음에 다시 맞혀보면 더 재밌겠어요.",
  ],
};

function pickVariant<T>(items: T[], seed: number, offset = 0): T {
  return items[Math.abs(seed + offset) % items.length];
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getChoice(question: Question, choiceId?: string) {
  return question.options.find((option) => option.id === choiceId) ?? question.options[0];
}

function getTopTrait(choices: Choice[]) {
  const counts = new Map<TraitKey, number>();
  choices.forEach((choice) => counts.set(choice.trait, (counts.get(choice.trait) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "steady";
}

function buildComparisons(payload: InvitePayload, answers: AnswerMap): Comparison[] {
  return QUESTIONS.map((question) => {
    const predicted = getChoice(question, payload.predictions[question.id]);
    const actual = getChoice(question, answers[question.id]);
    return {
      question,
      predicted,
      actual,
      exact: predicted.id === actual.id,
      close: predicted.trait === actual.trait,
    };
  });
}

function getTraitCopy(trait: TraitKey, tone: ResultTone, seed: number) {
  return `${TRAITS[trait].copy} ${pickVariant(TRAIT_TONE_LINES[tone], seed)}`;
}

function buildConversationCards(comparisons: Comparison[], senderName: string, friendName: string): ConversationCard[] {
  const bestMatch = comparisons.find((item) => item.exact);
  const biggestGap = comparisons.find((item) => !item.exact);
  const cards: ConversationCard[] = [];

  if (bestMatch) {
    cards.push({
      label: "같이 고른 장면",
      title: bestMatch.question.short,
      body: `둘 다 "${bestMatch.actual.summary}" 쪽이었어요. 이건 서로 생각한 모습이 잘 맞은 부분이에요.`,
      tone: "green",
    });
  } else {
    cards.push({
      label: "첫 대화 포인트",
      title: "예상 밖 선택",
      body: "이번 결과는 서로 다르게 본 장면이 많아요. 하나씩 물어보면 바로 얘기가 이어져요.",
      tone: "orange",
    });
  }

  if (biggestGap) {
    cards.push({
      label: "다르게 본 장면",
      title: biggestGap.question.short,
      body: `${senderName}님은 "${biggestGap.predicted.summary}"을 예상했고, ${friendName}님은 "${biggestGap.actual.summary}"을 골랐어요.`,
      tone: "orange",
    });
    cards.push({
      label: "톡에서 물어볼 말",
      title: `왜 "${biggestGap.actual.label}" 골랐어?`,
      body: "이 질문 하나만 던져도 결과 얘기가 자연스럽게 이어져요.",
      tone: "dark",
    });
  } else {
    cards.push({
      label: "소름 포인트",
      title: "8문항 전부 같은 답",
      body: "친구의 기본 선택을 정말 잘 알고 있었어요. 이건 그냥 자랑해도 됩니다.",
      tone: "green",
    });
    cards.push({
      label: "톡에서 물어볼 말",
      title: "우리 진짜 다 같네?",
      body: "전부 맞은 이유를 서로 얘기하면 결과 카드가 더 재밌어져요.",
      tone: "dark",
    });
  }

  return cards;
}

function buildResult(payload: InvitePayload, answers: AnswerMap) {
  const comparisons = buildComparisons(payload, answers);
  const exactCount = comparisons.filter((item) => item.exact).length;
  const closeCount = comparisons.filter((item) => !item.exact && item.close).length;
  const score = Math.round((exactCount / TOTAL_QUESTIONS) * 100);
  const profile = RESULT_PROFILES.find((item) => score >= item.min)?.profile ?? RESULT_PROFILES[RESULT_PROFILES.length - 1].profile;
  const predictedTrait = getTopTrait(comparisons.map((item) => item.predicted));
  const actualTrait = getTopTrait(comparisons.map((item) => item.actual));
  const seed = hashText(`${payload.sessionId}:${score}:${exactCount}`);

  return {
    comparisons,
    exactCount,
    closeCount,
    score,
    profile,
    resultTitle: pickVariant(RESULT_TITLE_VARIANTS[profile.tone], seed, 1),
    resultBody: pickVariant(RESULT_BODY_VARIANTS[profile.tone], seed, 2),
    predictedTrait,
    actualTrait,
    predictedCopy: getTraitCopy(predictedTrait, profile.tone, seed + 3),
    actualCopy: getTraitCopy(actualTrait, profile.tone, seed + 4),
    conversationCards: buildConversationCards(comparisons, payload.ownerName, payload.targetName),
  };
}

function encodePayload(payload: InvitePayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePayload(value: string): InvitePayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<InvitePayload>;
    if (parsed.version !== 1) return null;
    if (typeof parsed.ownerName !== "string" || typeof parsed.targetName !== "string") return null;
    if (!parsed.predictions || typeof parsed.predictions !== "object") return null;
    const predictions: AnswerMap = {};
    for (const question of QUESTIONS) {
      const answer = parsed.predictions[question.id];
      if (typeof answer !== "string" || !question.options.some((option) => option.id === answer)) return null;
      predictions[question.id] = answer;
    }
    return {
      version: 1,
      ownerName: parsed.ownerName.trim().slice(0, 16) || "나",
      targetName: parsed.targetName.trim().slice(0, 16) || "친구",
      predictions,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : String(Date.now()),
    };
  } catch {
    return null;
  }
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ProgressBar({ index }: { index: number }) {
  const pct = ((index + 1) / TOTAL_QUESTIONS) * 100;
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: P.light }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${P.mid}, ${P.rose})` }}
      />
    </div>
  );
}

function ChoiceButton({
  choice,
  active,
  onClick,
}: {
  choice: Choice;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98]"
      style={{
        borderColor: active ? P.mid : "#E5E7EB",
        background: active ? P.bg : "#FFFFFF",
        boxShadow: active ? `0 0 0 3px ${P.light}` : undefined,
      }}
    >
      <span className="block text-[15px] font-black leading-snug text-gray-900">{choice.label}</span>
    </button>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "teal" | "rose" }) {
  const color = tone === "teal" ? P.teal : tone === "rose" ? P.rose : P.mid;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <p className="mt-1 text-[20px] font-black tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function getConversationToneStyle(tone: ConversationCard["tone"]) {
  if (tone === "green") {
    return { background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#047857" };
  }
  if (tone === "dark") {
    return { background: "#111827", border: "1px solid #111827", color: "#F97316" };
  }
  return { background: P.bg, border: `1px solid ${P.border}`, color: P.text };
}

function QuestionCard({
  comparison,
  ownerName,
  targetName,
  className = "",
}: {
  comparison: Comparison;
  ownerName: string;
  targetName: string;
  className?: string;
}) {
  const badgeLabel = comparison.exact ? "일치" : "불일치";
  return (
    <section className={`rounded-2xl border border-gray-100 bg-white px-5 py-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">{comparison.question.short}</p>
        <span
          className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-[12px] font-black shadow-sm"
          style={{
            background: comparison.exact ? "#059669" : "#FFF7ED",
            borderColor: comparison.exact ? "#047857" : "#FB923C",
            color: comparison.exact ? "#FFFFFF" : P.text,
          }}
        >
          {badgeLabel}
        </span>
      </div>
      <p className="text-[15px] font-black leading-snug text-gray-900">{comparison.question.text(targetName)}</p>
      <div className="mt-4 grid gap-2">
        <div className="rounded-xl px-4 py-3" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: P.text }}>
            {ownerName}님의 예측
          </p>
          <p className="mt-1 text-[14px] font-bold text-gray-800">{comparison.predicted.label}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{targetName}님의 실제 답변</p>
          <p className="mt-1 text-[14px] font-bold text-gray-900">{comparison.actual.label}</p>
        </div>
      </div>
    </section>
  );
}

export default function NaboPredictPage() {
  const [step, setStep] = useState<Step>("intro");
  const [ownerName, setOwnerName] = useState("");
  const [targetName, setTargetName] = useState("");
  const [predictionAnswers, setPredictionAnswers] = useState<AnswerMap>({});
  const [actualAnswers, setActualAnswers] = useState<AnswerMap>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sharePayload, setSharePayload] = useState<InvitePayload | null>(null);
  const [shareOrigin, setShareOrigin] = useState("https://www.styledrop.cloud");
  const [isSharingKakao, setIsSharingKakao] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisIndex, setAnalysisIndex] = useState(0);
  const senderName = ownerName.trim() || "나";
  const friendName = targetName.trim() || "친구";
  const analysisSteps = useMemo(
    () => [
      `${senderName}님의 예측 답안지를 불러오는 중`,
      `${friendName}님의 실제 선택과 비교 중`,
      "행동 패턴 차이를 정리 중",
      "결과 답안지를 생성 중",
    ],
    [friendName, senderName],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setShareOrigin(window.location.origin);
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("data");
      if (!encoded) return;

      const decoded = decodePayload(encoded);
      if (!decoded) {
        setErrorMessage("링크 정보를 읽지 못했어요. 새 링크로 다시 시도해주세요.");
        return;
      }

      setSharePayload(decoded);
      setOwnerName(decoded.ownerName);
      setTargetName(decoded.targetName);
      setPredictionAnswers(decoded.predictions);
      setActualAnswers({});
      setQuestionIndex(0);
      setStep("answerIntro");
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (step !== "analyzing") return;

    const timers = analysisSteps.slice(1).map((_, index) =>
      window.setTimeout(() => setAnalysisIndex(index + 1), (index + 1) * 720),
    );
    const done = window.setTimeout(() => setStep("result"), analysisSteps.length * 720 + 520);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(done);
    };
  }, [analysisSteps, step]);

  const inviteLink = useMemo(() => {
    if (!sharePayload) return "";
    return `${shareOrigin}/nabo-predict?data=${encodeURIComponent(encodePayload(sharePayload))}`;
  }, [shareOrigin, sharePayload]);

  const result = useMemo(() => {
    if (!sharePayload || Object.keys(actualAnswers).length < TOTAL_QUESTIONS) return null;
    return buildResult(sharePayload, actualAnswers);
  }, [actualAnswers, sharePayload]);

  const currentQuestion = QUESTIONS[questionIndex];
  const activeAnswers = step === "answerQuestions" ? actualAnswers : predictionAnswers;
  const selectedChoice = currentQuestion ? activeAnswers[currentQuestion.id] : "";

  const canStart = ownerName.trim().length > 0 && targetName.trim().length > 0;

  const resetAll = useCallback(() => {
    setStep("intro");
    setOwnerName("");
    setTargetName("");
    setPredictionAnswers({});
    setActualAnswers({});
    setQuestionIndex(0);
    setSharePayload(null);
    setShareNotice("");
    setIsSharingKakao(false);
    setCopied(false);
    setErrorMessage("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/nabo-predict");
    }
  }, []);

  const startPrediction = () => {
    if (!canStart) return;
    setPredictionAnswers({});
    setQuestionIndex(0);
    setErrorMessage("");
    setStep("predictQuestions");
  };

  const startAnswer = () => {
    setActualAnswers({});
    setQuestionIndex(0);
    setErrorMessage("");
    setStep("answerQuestions");
  };

  const chooseAnswer = (choiceId: string) => {
    if (!currentQuestion) return;
    if (step === "answerQuestions") {
      setActualAnswers((current) => ({ ...current, [currentQuestion.id]: choiceId }));
      return;
    }
    setPredictionAnswers((current) => ({ ...current, [currentQuestion.id]: choiceId }));
  };

  const nextQuestion = () => {
    if (!currentQuestion || !selectedChoice) return;

    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    if (step === "answerQuestions") {
      setAnalysisIndex(0);
      setStep("analyzing");
      return;
    }

    const payload: InvitePayload = {
      version: 1,
      ownerName: ownerName.trim().slice(0, 16),
      targetName: targetName.trim().slice(0, 16),
      predictions: predictionAnswers,
      createdAt: Date.now(),
      sessionId: createSessionId(),
    };
    setSharePayload(payload);
    void trackClientEvent("lab_nabo_predict_link_created");
    setStep("share");
  };

  const previousQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex((current) => current - 1);
      return;
    }
    setStep(step === "answerQuestions" ? "answerIntro" : "setup");
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard?.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setShareNotice("링크를 복사했어요.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleKakaoShare = async () => {
    if (!inviteLink || isSharingKakao) return;
    setIsSharingKakao(true);
    setShareNotice("");

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
        text: `${senderName}님이 ${friendName}님의 행동을 예측했어요.\n8개 질문에 답하고 얼마나 맞았는지 확인해보세요.`,
        link: {
          mobileWebUrl: inviteLink,
          webUrl: inviteLink,
        },
      });
      setShareNotice("카카오톡 공유창을 열었어요.");
    } catch {
      await navigator.clipboard?.writeText(inviteLink).catch(() => {});
      setCopied(true);
      setShareNotice("카카오 공유가 어려워서 링크를 복사했어요.");
      window.setTimeout(() => setCopied(false), 2000);
    } finally {
      window.setTimeout(() => setIsSharingKakao(false), 1200);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-gray-900" style={{ fontFamily: '"Pretendard", "SUIT Variable", sans-serif' }}>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-100 bg-white/90 px-5 backdrop-blur">
        {step === "intro" ? (
          <Link href="/studio" className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-400 transition-colors hover:text-gray-900">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            돌아가기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (step === "predictQuestions" || step === "answerQuestions") {
                previousQuestion();
                return;
              }
              if (step === "setup") setStep("intro");
              else if (step === "share") setStep("predictQuestions");
              else if (step === "answerIntro") resetAll();
              else resetAll();
            }}
            className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-400 transition-colors hover:text-gray-900"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            이전
          </button>
        )}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
          <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: P.text }}>
            예측 실험실
          </span>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: P.mid }} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">베타</span>
        </div>
        <div className="w-[60px]" />
      </header>

      {errorMessage && step !== "answerQuestions" && step !== "predictQuestions" && (
        <div className="mx-auto mt-4 max-w-2xl px-5">
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">{errorMessage}</div>
        </div>
      )}

      {step === "intro" && (
        <div className="mx-auto flex w-full max-w-2xl flex-col pb-32">
          <section className="px-6 pb-8 pt-14 text-center">
            <div className="mx-auto mb-9 flex h-[104px] w-[104px] items-center justify-center rounded-[32px] shadow-sm" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-[30px] font-black text-white" style={{ background: `linear-gradient(135deg, ${P.mid}, ${P.rose})` }}>
                ?
              </div>
            </div>
            <p className="mb-4 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: P.mid }}>
              행동 예측 테스트
            </p>
            <h1 className="mb-5 text-[33px] font-black leading-[1.12] text-gray-900">
              너라면
              <br />
              그럴 줄 알았어
            </h1>
            <p className="mx-auto max-w-[310px] text-[16px] leading-relaxed text-gray-500">
              내가 먼저 친구의 선택을 예측하고, 친구가 실제로 답하면 두 답안지를 비교해요.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["패턴 분석", "링크 공유", "결과 답안지 생성"].map((tag) => (
                <span key={tag} className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: P.bg, color: P.deep, border: `1px solid ${P.border}` }}>
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="border-t border-gray-50 px-6 py-8">
            <p className="mb-6 text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">진행 방식</p>
            <div className="grid gap-5">
              {[
                ["01", "내가 먼저 예측", "친구라면 어떤 행동을 할지 8개 질문에 답해요."],
                ["02", "링크 보내기", "예측 답안지는 링크 안에 숨겨지고, 친구는 결과 전까지 볼 수 없어요."],
                ["03", "친구가 실제 답변", "친구가 같은 질문에 직접 답하면 바로 비교 카드가 열려요."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4">
                  <span className="w-10 shrink-0 text-right text-[26px] font-black leading-none text-gray-200">{num}</span>
                  <div className="border-l-2 pl-4" style={{ borderColor: P.border }}>
                    <p className="text-[19px] font-black leading-tight text-gray-900">{title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-8 pt-5">
            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={() => setStep("setup")}
                className="w-full rounded-2xl py-4 text-[17px] font-black text-white transition-all active:scale-[0.97]"
                style={{ background: "#111827" }}
              >
                예측 링크 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "setup" && (
        <div className="mx-auto flex w-full max-w-2xl flex-col pb-32">
          <section className="px-6 pb-6 pt-10">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: P.mid }}>
              1단계 · 예측 대상
            </p>
            <h2 className="mb-2 text-[28px] font-black leading-tight text-gray-900">누구의 행동을<br />예측할까요?</h2>
            <p className="text-[14px] text-gray-500">내 이름과 친구 이름만 정하면 바로 시작할 수 있어요.</p>
          </section>
          <section className="grid gap-5 px-6">
            <div className="grid gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">내 이름</label>
              <input
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder="예: 민지"
                className="w-full rounded-2xl border bg-white px-4 py-4 text-[16px] font-semibold text-gray-900 outline-none transition-all"
                style={{ borderColor: ownerName ? P.mid : "#E5E7EB", boxShadow: ownerName ? `0 0 0 3px ${P.bg}` : undefined }}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">친구/지인 이름</label>
              <input
                value={targetName}
                onChange={(event) => setTargetName(event.target.value)}
                placeholder="예: 지환"
                className="w-full rounded-2xl border bg-white px-4 py-4 text-[16px] font-semibold text-gray-900 outline-none transition-all"
                style={{ borderColor: targetName ? P.rose : "#E5E7EB", boxShadow: targetName ? "0 0 0 3px #FFE4E6" : undefined }}
              />
            </div>
            <div className="rounded-2xl p-4" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <p className="text-[13px] font-black text-gray-900">답변 패턴 기준으로 생성</p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                내 예측과 친구의 실제 선택을 비교해서 관계 리포트 카드로 정리해요.
              </p>
            </div>
          </section>
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-8 pt-5">
            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={startPrediction}
                className="w-full rounded-2xl py-4 text-[17px] font-black transition-all active:scale-[0.97]"
                style={{ background: canStart ? "#111827" : "#F3F4F6", color: canStart ? "#FFFFFF" : "#9CA3AF" }}
              >
                {friendName}님 답변 예측하기
              </button>
              {!canStart && <p className="mt-2 text-center text-[12px] text-gray-400">내 이름과 친구 이름을 입력해주세요</p>}
            </div>
          </div>
        </div>
      )}

      {(step === "predictQuestions" || step === "answerQuestions") && currentQuestion && (
        <div className="mx-auto flex w-full max-w-2xl flex-col pb-32">
          <div className="px-5 py-2.5 text-center" style={{ background: P.bg, borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[12px] font-bold" style={{ color: P.text }}>
              {step === "predictQuestions"
                ? `${senderName}님이 ${friendName}님의 행동을 예측 중`
                : `${friendName}님이 실제 답변 중`}
            </p>
          </div>
          <section className="px-6 pb-4 pt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-gray-400">{questionIndex + 1} / {TOTAL_QUESTIONS}</p>
              <p className="text-[12px] font-bold" style={{ color: P.mid }}>{currentQuestion.category}</p>
            </div>
            <ProgressBar index={questionIndex} />
          </section>

          <section className="flex flex-1 flex-col gap-5 px-6 pb-4 pt-7">
            <div>
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[16px] font-black text-white" style={{ background: `linear-gradient(135deg, ${P.mid}, ${P.rose})` }}>
                {currentQuestion.mark}
              </span>
              <p className="mb-2 text-[12px] font-black uppercase tracking-[0.22em] text-gray-400">{currentQuestion.short}</p>
              <h2 className="text-[24px] font-black leading-tight text-gray-900">{currentQuestion.text(friendName)}</h2>
            </div>

            <div className="grid gap-2">
              {currentQuestion.options.map((choice) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  active={selectedChoice === choice.id}
                  onClick={() => chooseAnswer(choice.id)}
                />
              ))}
            </div>
          </section>

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-8 pt-5">
            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={nextQuestion}
                className="w-full rounded-2xl py-4 text-[17px] font-black transition-all active:scale-[0.97]"
                style={{ background: selectedChoice ? "#111827" : "#F3F4F6", color: selectedChoice ? "#FFFFFF" : "#9CA3AF" }}
              >
                {questionIndex < QUESTIONS.length - 1 ? "다음" : step === "predictQuestions" ? "예측 답안지 완성" : "결과 답안지 생성"}
              </button>
              {!selectedChoice && <p className="mt-2 text-center text-[12px] text-gray-400">하나를 선택해주세요</p>}
            </div>
          </div>
        </div>
      )}

      {step === "share" && sharePayload && (
        <div className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden pb-12">
          <section className="px-6 pb-6 pt-10">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: P.mid }}>
              2단계 · 링크 공유
            </p>
            <h2 className="mb-2 text-[28px] font-black leading-tight text-gray-900">{targetName}님의<br />예측 링크가 완성됐어요</h2>
            <p className="text-[14px] leading-relaxed text-gray-500">{friendName}님이 링크를 누르면 {senderName}님의 예측은 숨겨진 상태로 같은 질문에 답해요.</p>
          </section>
          <section className="grid min-w-0 gap-4 px-6">
            <button
              type="button"
              onClick={() => void handleKakaoShare()}
              disabled={!inviteLink || isSharingKakao}
              className="w-full max-w-full rounded-2xl px-4 py-4 text-[17px] font-black transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "#FEE500", color: "#3C1E1E" }}
            >
              {isSharingKakao ? "카카오 여는 중..." : "카카오로 공유하기"}
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!inviteLink}
              className="w-full max-w-full rounded-2xl px-4 py-3.5 text-[15px] font-black text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: copied ? P.teal : "#111827" }}
            >
              {copied ? "링크 복사됨" : "링크 복사하기"}
            </button>
            <div className="rounded-2xl px-4 py-4" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <p className="text-[13px] font-black text-gray-900">친구는 로그인 없이 바로 참여할 수 있어요</p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                결과는 친구가 8개 질문에 모두 답한 뒤에만 열립니다.
              </p>
            </div>
            {shareNotice && <p className="text-center text-[12px] font-bold text-gray-400">{shareNotice}</p>}
          </section>
        </div>
      )}

      {step === "answerIntro" && sharePayload && (
        <div className="mx-auto flex w-full max-w-2xl flex-col pb-32">
          <section className="px-6 pb-8 pt-14 text-center">
            <div className="mx-auto mb-8 flex h-[92px] w-[92px] items-center justify-center rounded-[30px]" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <span className="text-[22px] font-black" style={{ color: P.mid }}>친구</span>
            </div>
            <p className="mb-4 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: P.mid }}>초대 도착</p>
            <h1 className="mb-5 text-[30px] font-black leading-tight text-gray-900">
              {ownerName}님이<br />
              {targetName}님의 행동을 예측했어요
            </h1>
            <p className="mx-auto max-w-[310px] text-[15px] leading-relaxed text-gray-500">
              같은 질문에 직접 답하면, {senderName}님의 예측과 {friendName}님의 실제 답변을 비교한 결과 카드가 열려요.
            </p>
          </section>
          <section className="px-6">
            <div className="rounded-2xl p-4" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <p className="text-[13px] font-black text-gray-900">예측 답안지는 아직 숨겨져 있어요</p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">결과 화면에서만 한 문항씩 비교해서 보여줍니다.</p>
            </div>
          </section>
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-8 pt-5">
            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={startAnswer}
                className="w-full rounded-2xl py-4 text-[17px] font-black text-white transition-all active:scale-[0.97]"
                style={{ background: "#111827" }}
              >
                내 실제 답변 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "analyzing" && (
        <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[32px]" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
            <div
              className="h-12 w-12 rounded-full border-4 border-gray-200"
              style={{ borderTopColor: P.mid, animation: "spin 0.9s linear infinite" }}
            />
          </div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: P.mid }}>패턴 분석</p>
          <h2 className="mb-7 text-[26px] font-black leading-tight text-gray-900">결과 답안지를<br />생성하고 있어요</h2>
          <div className="w-full rounded-3xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
            <div className="grid gap-3 text-left">
              {analysisSteps.map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                    style={{
                      background: index <= analysisIndex ? P.mid : "#F3F4F6",
                      color: index <= analysisIndex ? "#FFFFFF" : "#9CA3AF",
                    }}
                  >
                    {index < analysisIndex ? "✓" : index + 1}
                  </span>
                  <span className={`text-[13px] font-bold ${index <= analysisIndex ? "text-gray-900" : "text-gray-400"}`}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "result" && sharePayload && result && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-12 pt-10">
          <section className="text-center">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: P.mid }}>
              분석 완료
            </p>
            <h2 className="text-[28px] font-black leading-tight text-gray-900">{ownerName}님이 본 {targetName}님</h2>
            <p className="mt-2 text-[13px] text-gray-400">
              예측 {TOTAL_QUESTIONS}문항 비교 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </p>
          </section>

          <section className="rounded-3xl p-6 text-center" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: P.text }}>
              {result.profile.badge}
            </p>
            <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-sm">
              <div>
                <p className="text-[42px] font-black leading-none tabular-nums" style={{ color: P.mid }}>{result.score}</p>
                <p className="text-[12px] font-black text-gray-400">/ 100</p>
              </div>
            </div>
            <h3
              className="mb-2 text-[30px] leading-tight text-gray-900"
              style={{ fontFamily: '"BMKkubulim", sans-serif' }}
            >
              {result.resultTitle}
            </h3>
            <p className="text-[14px] leading-relaxed text-gray-600">{result.resultBody}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniStat label="일치" value={`${result.exactCount}개`} />
              <MiniStat label="비슷한 답" value={`${result.closeCount}개`} tone="rose" />
              <MiniStat label="다른 선택" value={`${TOTAL_QUESTIONS - result.exactCount}개`} tone="teal" />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">{senderName}님이 예상한 {friendName}님</p>
              <p className="text-[19px] font-black text-gray-900">{TRAITS[result.predictedTrait].title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{result.predictedCopy}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">{friendName}님의 실제 선택</p>
              <p className="text-[19px] font-black text-gray-900">{TRAITS[result.actualTrait].title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{result.actualCopy}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">친구랑 얘기할 거리</p>
            <div className="grid gap-3">
              {result.conversationCards.map((card) => {
                const toneStyle = getConversationToneStyle(card.tone);
                const isDark = card.tone === "dark";

                return (
                  <div key={`${card.label}-${card.title}`} className="rounded-xl px-4 py-3" style={{ background: toneStyle.background, border: toneStyle.border }}>
                    <p className="text-[12px] font-black" style={{ color: toneStyle.color }}>{card.label}</p>
                    <p className={`mt-1 text-[17px] font-black leading-snug ${isDark ? "text-white" : "text-gray-900"}`}>{card.title}</p>
                    <p className={`mt-1 text-[13px] font-bold leading-relaxed ${isDark ? "text-white/70" : "text-gray-600"}`}>{card.body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="-mx-6">
            <div className="mb-3 flex items-end justify-between px-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">질문별 비교</p>
                <p className="mt-1 text-[13px] font-semibold text-gray-500">좌우로 넘겨서 일치/불일치를 확인해요.</p>
              </div>
              <p className="text-[12px] font-black tabular-nums" style={{ color: P.mid }}>{result.exactCount}/{TOTAL_QUESTIONS}</p>
            </div>
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
              {result.comparisons.map((comparison) => (
                <QuestionCard
                  key={comparison.question.id}
                  comparison={comparison}
                  ownerName={senderName}
                  targetName={friendName}
                  className="min-h-[300px] w-[82vw] max-w-[360px] shrink-0 snap-center"
                />
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={resetAll}
            className="mt-2 w-full rounded-2xl py-4 text-[17px] font-black text-white transition-all active:scale-[0.97]"
            style={{ background: `linear-gradient(135deg, ${P.mid}, ${P.rose})` }}
          >
            나도 해보기
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 360px) {
          h1, h2 { word-break: keep-all; }
        }
      `}</style>
    </main>
  );
}
