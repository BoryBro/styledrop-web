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
type RelationshipType = "friend" | "lover" | "crush" | "family" | "acquaintance";

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
  relationshipType?: RelationshipType;
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

const DEFAULT_RELATIONSHIP: RelationshipType = "friend";

const RELATIONSHIPS: Record<RelationshipType, { label: string; targetLabel: string; helper: string; answerBadge: string }> = {
  friend: {
    label: "친구",
    targetLabel: "친구 이름",
    helper: "찐친만 아는 습관과 반응을 맞혀요.",
    answerBadge: "친구",
  },
  lover: {
    label: "연인",
    targetLabel: "연인 이름",
    helper: "서운함, 애정표현, 연락 스타일을 맞혀요.",
    answerBadge: "연인",
  },
  crush: {
    label: "썸",
    targetLabel: "상대 이름",
    helper: "호감 신호와 애매한 반응을 맞혀요.",
    answerBadge: "썸",
  },
  family: {
    label: "가족",
    targetLabel: "가족 이름",
    helper: "집에서만 보이는 생활 패턴을 맞혀요.",
    answerBadge: "가족",
  },
  acquaintance: {
    label: "직장/학교 지인",
    targetLabel: "지인 이름",
    helper: "사회적 모습과 실제 성향 차이를 맞혀요.",
    answerBadge: "지인",
  },
};

const QUESTION_BANK: Record<RelationshipType, Question[]> = {
  friend: [
  {
    id: "q1",
    mark: "01",
    short: "연락 잠수",
    category: "친구 패턴",
    text: (name) => `${name}님이 갑자기 연락이 뜸해졌다면?`,
    options: [
      { id: "charge", label: "혼자 충전 중이다", trait: "quiet", summary: "혼자 충전" },
      { id: "busy", label: "진짜 바빠서 정신없다", trait: "logic", summary: "바쁨" },
      { id: "hurt", label: "은근히 서운한 게 있다", trait: "care", summary: "서운함" },
      { id: "forgot", label: "그냥 답장 타이밍을 놓쳤다", trait: "steady", summary: "타이밍 놓침" },
    ],
  },
  {
    id: "q2",
    mark: "02",
    short: "찐 삐짐",
    category: "감정 표현",
    text: (name) => `${name}님이 진짜 삐졌을 때 가장 티 나는 건?`,
    options: [
      { id: "quiet", label: "말수가 확 줄어든다", trait: "quiet", summary: "말수 줄어듦" },
      { id: "late", label: "답장이 갑자기 느려진다", trait: "steady", summary: "답장 느려짐" },
      { id: "fine", label: "괜찮다고 하는데 안 괜찮다", trait: "care", summary: "괜찮은 척" },
      { id: "direct", label: "그 자리에서 바로 말한다", trait: "direct", summary: "바로 말함" },
    ],
  },
  {
    id: "q3",
    mark: "03",
    short: "단톡방 역할",
    category: "친구 무리",
    text: (name) => `${name}님은 단톡방에서 보통 어떤 쪽?`,
    options: [
      { id: "react", label: "리액션으로 살린다", trait: "care", summary: "리액션 담당" },
      { id: "watch", label: "조용히 다 보고 있다", trait: "quiet", summary: "관전" },
      { id: "mood", label: "분위기를 띄운다", trait: "spark", summary: "분위기 담당" },
      { id: "need", label: "필요한 말만 한다", trait: "logic", summary: "필요한 말" },
    ],
  },
  {
    id: "q4",
    mark: "04",
    short: "칭찬 포인트",
    category: "자존감 버튼",
    text: (name) => `${name}님이 은근 제일 좋아할 칭찬은?`,
    options: [
      { id: "look", label: "오늘 분위기 좋다", trait: "spark", summary: "분위기 칭찬" },
      { id: "sense", label: "센스 있다", trait: "logic", summary: "센스 칭찬" },
      { id: "fun", label: "너 진짜 웃기다", trait: "direct", summary: "웃김 칭찬" },
      { id: "trust", label: "너랑 있으면 편하다", trait: "care", summary: "편안함 칭찬" },
    ],
  },
  {
    id: "q5",
    mark: "05",
    short: "돈 쓰는 곳",
    category: "취향",
    text: (name) => `${name}님이 돈 아깝지 않게 쓰는 쪽은?`,
    options: [
      { id: "food", label: "맛있는 음식", trait: "steady", summary: "음식" },
      { id: "style", label: "옷이나 꾸미는 것", trait: "spark", summary: "스타일" },
      { id: "travel", label: "여행과 경험", trait: "quiet", summary: "경험" },
      { id: "hobby", label: "취미나 덕질", trait: "direct", summary: "취미" },
    ],
  },
  {
    id: "q6",
    mark: "06",
    short: "편한 사람",
    category: "친밀도",
    text: (name) => `${name}님이 진짜 편한 사람 앞에서만 보이는 모습은?`,
    options: [
      { id: "talk", label: "말이 많아진다", trait: "spark", summary: "말 많아짐" },
      { id: "soft", label: "애교나 장난이 나온다", trait: "care", summary: "장난 많아짐" },
      { id: "blank", label: "무표정으로 편하게 있는다", trait: "quiet", summary: "무장해제" },
      { id: "eat", label: "아무거나 막 먹는다", trait: "steady", summary: "막 먹음" },
    ],
  },
  {
    id: "q7",
    mark: "07",
    short: "스트레스",
    category: "회복 방식",
    text: (name) => `${name}님이 스트레스 받을 때 제일 가까운 모습은?`,
    options: [
      { id: "sleep", label: "일단 잔다", trait: "steady", summary: "수면 회복" },
      { id: "eat", label: "먹는 걸로 푼다", trait: "spark", summary: "먹기" },
      { id: "buy", label: "갑자기 뭘 산다", trait: "direct", summary: "소비" },
      { id: "silent", label: "아무 말 안 한다", trait: "quiet", summary: "침묵" },
    ],
  },
  {
    id: "q8",
    mark: "08",
    short: "반전 포인트",
    category: "의외의 모습",
    text: (name) => `${name}님에게 제일 의외일 것 같은 면은?`,
    options: [
      { id: "sensitive", label: "생각보다 예민하다", trait: "quiet", summary: "예민함" },
      { id: "simple", label: "생각보다 단순하다", trait: "steady", summary: "단순함" },
      { id: "deep", label: "생각보다 깊게 생각한다", trait: "logic", summary: "깊은 생각" },
      { id: "wild", label: "생각보다 즉흥적이다", trait: "spark", summary: "즉흥성" },
    ],
  },
  ],
  lover: [
    {
      id: "q1", mark: "01", short: "서운함", category: "연애 패턴", text: (name) => `${name}님이 서운할 때 제일 가까운 반응은?`,
      options: [
        { id: "say", label: "바로 말한다", trait: "direct", summary: "바로 말함" },
        { id: "hide", label: "괜찮은 척하다가 티 난다", trait: "care", summary: "괜찮은 척" },
        { id: "quiet", label: "혼자 조용해진다", trait: "quiet", summary: "조용해짐" },
        { id: "logic", label: "왜 서운한지 정리해본다", trait: "logic", summary: "이유 정리" },
      ],
    },
    {
      id: "q2", mark: "02", short: "애정표현", category: "표현 방식", text: (name) => `${name}님이 가장 편하게 하는 애정표현은?`,
      options: [
        { id: "words", label: "말로 표현한다", trait: "direct", summary: "말 표현" },
        { id: "care", label: "챙겨주는 행동으로 보인다", trait: "care", summary: "챙김" },
        { id: "time", label: "시간을 같이 보내려 한다", trait: "steady", summary: "함께 시간" },
        { id: "joke", label: "장난과 스킨십으로 푼다", trait: "spark", summary: "장난 표현" },
      ],
    },
    {
      id: "q3", mark: "03", short: "질투", category: "감정 포인트", text: (name) => `${name}님이 은근 질투 날 가능성이 큰 순간은?`,
      options: [
        { id: "ex", label: "전 연인 얘기가 나올 때", trait: "quiet", summary: "전 연인 얘기" },
        { id: "reply", label: "답장이 늦는데 온라인일 때", trait: "logic", summary: "답장 타이밍" },
        { id: "friend", label: "다른 사람을 너무 챙길 때", trait: "care", summary: "다른 사람 챙김" },
        { id: "cool", label: "질투 안 나는 척할 때", trait: "steady", summary: "아닌 척" },
      ],
    },
    {
      id: "q4", mark: "04", short: "싸운 뒤", category: "화해 방식", text: (name) => `${name}님은 다툰 뒤 보통 어떻게 풀릴까?`,
      options: [
        { id: "talk", label: "대화를 해야 풀린다", trait: "direct", summary: "대화" },
        { id: "time", label: "시간이 조금 필요하다", trait: "quiet", summary: "시간 필요" },
        { id: "food", label: "같이 밥 먹으면 풀린다", trait: "steady", summary: "밥으로 화해" },
        { id: "hug", label: "따뜻하게 안아주면 풀린다", trait: "care", summary: "스킨십" },
      ],
    },
    {
      id: "q5", mark: "05", short: "연락", category: "연락 스타일", text: (name) => `${name}님에게 제일 편한 연락 방식은?`,
      options: [
        { id: "often", label: "짧아도 자주 연락", trait: "care", summary: "자주 연락" },
        { id: "deep", label: "적어도 길게 대화", trait: "quiet", summary: "깊은 대화" },
        { id: "call", label: "문자보다 전화", trait: "direct", summary: "전화" },
        { id: "free", label: "각자 시간 존중", trait: "steady", summary: "자유로운 연락" },
      ],
    },
    {
      id: "q6", mark: "06", short: "기념일", category: "관계 취향", text: (name) => `${name}님은 기념일에 더 가까운 쪽은?`,
      options: [
        { id: "plan", label: "미리 계획된 데이트", trait: "logic", summary: "계획형" },
        { id: "letter", label: "진심 담긴 편지", trait: "care", summary: "편지" },
        { id: "simple", label: "부담 없이 소소하게", trait: "steady", summary: "소소함" },
        { id: "surprise", label: "깜짝 이벤트", trait: "spark", summary: "이벤트" },
      ],
    },
    {
      id: "q7", mark: "07", short: "사랑 확인", category: "불안 신호", text: (name) => `${name}님이 사랑받는다고 느끼는 순간은?`,
      options: [
        { id: "remember", label: "작은 걸 기억해줄 때", trait: "care", summary: "기억해줌" },
        { id: "choose", label: "나를 우선순위에 둘 때", trait: "direct", summary: "우선순위" },
        { id: "stable", label: "늘 변함없이 있을 때", trait: "steady", summary: "안정감" },
        { id: "notice", label: "말 안 해도 알아줄 때", trait: "quiet", summary: "눈치" },
      ],
    },
    {
      id: "q8", mark: "08", short: "헤어짐 위기", category: "민감 버튼", text: (name) => `${name}님이 관계에서 제일 못 견디는 건?`,
      options: [
        { id: "lie", label: "거짓말", trait: "logic", summary: "거짓말" },
        { id: "cold", label: "차가운 태도", trait: "care", summary: "차가움" },
        { id: "control", label: "심한 간섭", trait: "direct", summary: "간섭" },
        { id: "neglect", label: "방치되는 느낌", trait: "quiet", summary: "방치" },
      ],
    },
  ],
  crush: [
    {
      id: "q1", mark: "01", short: "호감 신호", category: "썸 기류", text: (name) => `${name}님이 호감 있을 때 제일 티 나는 행동은?`,
      options: [
        { id: "reply", label: "답장이 빨라진다", trait: "direct", summary: "빠른 답장" },
        { id: "question", label: "질문이 많아진다", trait: "care", summary: "질문 많음" },
        { id: "joke", label: "괜히 장난친다", trait: "spark", summary: "장난" },
        { id: "hide", label: "오히려 티 안 내려 한다", trait: "quiet", summary: "숨김" },
      ],
    },
    {
      id: "q2", mark: "02", short: "답장 텀", category: "연락 눈치", text: (name) => `${name}님이 답장을 늦게 한다면 진짜 이유는?`,
      options: [
        { id: "think", label: "뭐라고 답할지 고민 중", trait: "logic", summary: "답장 고민" },
        { id: "busy", label: "진짜 바쁨", trait: "steady", summary: "바쁨" },
        { id: "push", label: "일부러 텀을 둠", trait: "quiet", summary: "일부러 텀" },
        { id: "forget", label: "보고 까먹음", trait: "spark", summary: "까먹음" },
      ],
    },
    {
      id: "q3", mark: "03", short: "만남 후", category: "썸 반응", text: (name) => `${name}님이 만남 후 좋았을 때 하는 행동은?`,
      options: [
        { id: "message", label: "먼저 연락한다", trait: "direct", summary: "먼저 연락" },
        { id: "story", label: "티 안 나게 스토리를 올린다", trait: "spark", summary: "스토리" },
        { id: "recall", label: "대화 내용을 다시 떠올린다", trait: "quiet", summary: "회상" },
        { id: "next", label: "다음 약속을 자연스럽게 만든다", trait: "care", summary: "다음 약속" },
      ],
    },
    {
      id: "q4", mark: "04", short: "선 긋기", category: "애매함", text: (name) => `${name}님이 관심 없을 때 제일 가까운 모습은?`,
      options: [
        { id: "short", label: "답장이 짧아진다", trait: "steady", summary: "짧은 답장" },
        { id: "busy", label: "바쁘다는 말이 많아진다", trait: "logic", summary: "바쁨 핑계" },
        { id: "friend", label: "친구 느낌을 강조한다", trait: "direct", summary: "친구 강조" },
        { id: "kind", label: "상처 안 주려고 애매하게 군다", trait: "care", summary: "애매한 배려" },
      ],
    },
    {
      id: "q5", mark: "05", short: "질투 테스트", category: "숨은 감정", text: (name) => `${name}님이 썸에서 질투를 느낄 만한 순간은?`,
      options: [
        { id: "other", label: "다른 사람 얘기가 자주 나올 때", trait: "quiet", summary: "다른 사람 얘기" },
        { id: "late", label: "약속 우선순위가 밀릴 때", trait: "care", summary: "우선순위" },
        { id: "seen", label: "읽고 답이 늦을 때", trait: "logic", summary: "읽씹 느낌" },
        { id: "none", label: "질투 안 하는 척 넘긴다", trait: "steady", summary: "아닌 척" },
      ],
    },
    {
      id: "q6", mark: "06", short: "첫 고백", category: "속도감", text: (name) => `${name}님은 관계가 애매할 때 어떻게 움직일까?`,
      options: [
        { id: "wait", label: "상대가 먼저 오길 기다린다", trait: "quiet", summary: "기다림" },
        { id: "hint", label: "티 나는 힌트를 준다", trait: "spark", summary: "힌트" },
        { id: "ask", label: "확실히 물어본다", trait: "direct", summary: "확인" },
        { id: "read", label: "분위기를 더 지켜본다", trait: "logic", summary: "관찰" },
      ],
    },
    {
      id: "q7", mark: "07", short: "설렘 포인트", category: "취향", text: (name) => `${name}님이 제일 설렐 만한 순간은?`,
      options: [
        { id: "remember", label: "작은 취향을 기억해줄 때", trait: "care", summary: "취향 기억" },
        { id: "direct", label: "솔직하게 표현할 때", trait: "direct", summary: "솔직함" },
        { id: "unexpected", label: "예상 밖으로 챙겨줄 때", trait: "spark", summary: "뜻밖의 챙김" },
        { id: "comfortable", label: "말 없어도 편할 때", trait: "steady", summary: "편안함" },
      ],
    },
    {
      id: "q8", mark: "08", short: "끝나는 신호", category: "반전", text: (name) => `${name}님이 마음이 식으면 제일 먼저 달라지는 건?`,
      options: [
        { id: "question", label: "질문이 줄어든다", trait: "quiet", summary: "질문 줄어듦" },
        { id: "schedule", label: "약속을 미룬다", trait: "logic", summary: "약속 미룸" },
        { id: "reaction", label: "리액션이 짧아진다", trait: "steady", summary: "짧은 리액션" },
        { id: "clear", label: "확실히 선을 긋는다", trait: "direct", summary: "선 긋기" },
      ],
    },
  ],
  family: [
    {
      id: "q1", mark: "01", short: "집 모드", category: "가족 패턴", text: (name) => `${name}님이 집에서 제일 자주 보이는 모습은?`,
      options: [
        { id: "room", label: "방에 들어가 혼자 있는다", trait: "quiet", summary: "방콕" },
        { id: "talk", label: "괜히 말을 건다", trait: "care", summary: "말 걸기" },
        { id: "routine", label: "늘 하던 루틴을 한다", trait: "steady", summary: "루틴" },
        { id: "move", label: "갑자기 뭔가 벌인다", trait: "spark", summary: "즉흥 행동" },
      ],
    },
    {
      id: "q2", mark: "02", short: "잔소리", category: "반응", text: (name) => `${name}님은 잔소리를 들으면?`,
      options: [
        { id: "yes", label: "대답은 잘하고 안 한다", trait: "steady", summary: "대답만" },
        { id: "why", label: "왜 그런지 따진다", trait: "logic", summary: "이유 따짐" },
        { id: "silent", label: "조용히 피한다", trait: "quiet", summary: "회피" },
        { id: "joke", label: "농담으로 넘긴다", trait: "spark", summary: "농담" },
      ],
    },
    {
      id: "q3", mark: "03", short: "기분 나쁨", category: "가족 앞 감정", text: (name) => `${name}님이 가족 앞에서 기분 안 좋을 때는?`,
      options: [
        { id: "face", label: "표정에 바로 나온다", trait: "direct", summary: "표정" },
        { id: "room", label: "방으로 들어간다", trait: "quiet", summary: "방으로 감" },
        { id: "normal", label: "아무렇지 않은 척한다", trait: "care", summary: "괜찮은 척" },
        { id: "eat", label: "먹을 걸 찾는다", trait: "steady", summary: "먹기" },
      ],
    },
    {
      id: "q4", mark: "04", short: "부탁", category: "생활 습관", text: (name) => `${name}님이 가족 부탁을 받으면?`,
      options: [
        { id: "now", label: "말은 투덜대도 해준다", trait: "care", summary: "투덜 챙김" },
        { id: "later", label: "이따 한다고 미룬다", trait: "steady", summary: "미룸" },
        { id: "why", label: "왜 나인지 먼저 묻는다", trait: "logic", summary: "이유 확인" },
        { id: "fast", label: "빨리 끝내고 자유를 얻는다", trait: "direct", summary: "빠른 처리" },
      ],
    },
    {
      id: "q5", mark: "05", short: "가족 칭찬", category: "민망함", text: (name) => `${name}님은 가족에게 칭찬받으면?`,
      options: [
        { id: "awkward", label: "민망해서 딴소리한다", trait: "quiet", summary: "민망함" },
        { id: "proud", label: "아닌 척 좋아한다", trait: "steady", summary: "좋아함" },
        { id: "joke", label: "바로 장난친다", trait: "spark", summary: "장난" },
        { id: "thanks", label: "고맙다고 말한다", trait: "direct", summary: "감사 표현" },
      ],
    },
    {
      id: "q6", mark: "06", short: "비밀", category: "숨기는 모습", text: (name) => `${name}님이 가족에게 제일 잘 숨기는 건?`,
      options: [
        { id: "worry", label: "걱정거리", trait: "care", summary: "걱정" },
        { id: "money", label: "쓴 돈", trait: "logic", summary: "소비" },
        { id: "love", label: "연애/호감", trait: "quiet", summary: "연애" },
        { id: "plan", label: "갑자기 세운 계획", trait: "spark", summary: "즉흥 계획" },
      ],
    },
    {
      id: "q7", mark: "07", short: "화해", category: "가족 싸움", text: (name) => `${name}님은 가족과 싸운 뒤 어떻게 풀릴까?`,
      options: [
        { id: "food", label: "밥 먹다가 자연스럽게 풀린다", trait: "steady", summary: "밥으로 풀림" },
        { id: "sorry", label: "먼저 사과한다", trait: "care", summary: "먼저 사과" },
        { id: "time", label: "시간 지나면 풀린다", trait: "quiet", summary: "시간" },
        { id: "talk", label: "확실히 얘기하고 끝낸다", trait: "direct", summary: "대화" },
      ],
    },
    {
      id: "q8", mark: "08", short: "가족만 아는 면", category: "진짜 모습", text: (name) => `${name}님이 밖에서는 잘 안 보이는 모습은?`,
      options: [
        { id: "baby", label: "은근 애교 있음", trait: "care", summary: "애교" },
        { id: "lazy", label: "생각보다 게으름", trait: "steady", summary: "게으름" },
        { id: "talkative", label: "집에서는 말 많음", trait: "spark", summary: "말 많음" },
        { id: "deep", label: "혼자 생각이 많음", trait: "quiet", summary: "생각 많음" },
      ],
    },
  ],
  acquaintance: [
    {
      id: "q1", mark: "01", short: "첫인상", category: "사회적 모습", text: (name) => `${name}님의 첫인상과 실제 성격 차이는?`,
      options: [
        { id: "cold", label: "차가워 보이지만 편해지면 다정함", trait: "care", summary: "숨은 다정함" },
        { id: "quiet", label: "조용해 보이지만 은근 웃김", trait: "spark", summary: "은근 웃김" },
        { id: "easy", label: "편해 보이지만 선이 확실함", trait: "direct", summary: "선 있음" },
        { id: "same", label: "첫인상과 실제가 비슷함", trait: "steady", summary: "그대로" },
      ],
    },
    {
      id: "q2", mark: "02", short: "일 처리", category: "업무/학교", text: (name) => `${name}님은 같이 일하거나 과제할 때 어떤 쪽?`,
      options: [
        { id: "plan", label: "계획을 먼저 잡는다", trait: "logic", summary: "계획형" },
        { id: "quiet", label: "맡은 건 조용히 해낸다", trait: "quiet", summary: "조용히 처리" },
        { id: "lead", label: "필요하면 주도한다", trait: "direct", summary: "주도" },
        { id: "mood", label: "분위기를 부드럽게 만든다", trait: "care", summary: "분위기 완충" },
      ],
    },
    {
      id: "q3", mark: "03", short: "모임", category: "사회생활", text: (name) => `${name}님은 회식/모임에서 보통?`,
      options: [
        { id: "talk", label: "말을 꽤 한다", trait: "spark", summary: "대화형" },
        { id: "listen", label: "듣는 쪽이 편하다", trait: "quiet", summary: "듣는 편" },
        { id: "leave", label: "적당히 있다가 빠진다", trait: "logic", summary: "타이밍 퇴장" },
        { id: "care", label: "주변 사람을 챙긴다", trait: "care", summary: "챙김" },
      ],
    },
    {
      id: "q4", mark: "04", short: "불편함", category: "선 긋기", text: (name) => `${name}님이 불편한 사람을 대하는 방식은?`,
      options: [
        { id: "polite", label: "예의 있게 거리를 둔다", trait: "logic", summary: "예의 거리" },
        { id: "clear", label: "티 나게 선을 긋는다", trait: "direct", summary: "선 긋기" },
        { id: "avoid", label: "가능하면 피한다", trait: "quiet", summary: "회피" },
        { id: "smooth", label: "분위기 안 깨게 넘긴다", trait: "care", summary: "부드럽게 넘김" },
      ],
    },
    {
      id: "q5", mark: "05", short: "칭찬", category: "인정 욕구", text: (name) => `${name}님이 지인에게 들으면 제일 좋아할 말은?`,
      options: [
        { id: "reliable", label: "믿고 맡길 수 있다", trait: "steady", summary: "신뢰" },
        { id: "sense", label: "센스 있다", trait: "logic", summary: "센스" },
        { id: "comfortable", label: "같이 있으면 편하다", trait: "care", summary: "편안함" },
        { id: "fun", label: "생각보다 재밌다", trait: "spark", summary: "재밌음" },
      ],
    },
    {
      id: "q6", mark: "06", short: "부탁", category: "관계 거리", text: (name) => `${name}님이 지인 부탁을 받으면?`,
      options: [
        { id: "possible", label: "가능한 선에서 도와준다", trait: "care", summary: "도움" },
        { id: "limit", label: "내 기준을 먼저 본다", trait: "logic", summary: "기준 확인" },
        { id: "refuse", label: "어려우면 확실히 거절한다", trait: "direct", summary: "거절" },
        { id: "delay", label: "일단 생각해본다고 한다", trait: "quiet", summary: "보류" },
      ],
    },
    {
      id: "q7", mark: "07", short: "숨은 성격", category: "반전", text: (name) => `${name}님에게 가까워지면 보일 것 같은 모습은?`,
      options: [
        { id: "talk", label: "말이 훨씬 많아진다", trait: "spark", summary: "말 많아짐" },
        { id: "soft", label: "생각보다 정이 많다", trait: "care", summary: "정 많음" },
        { id: "firm", label: "생각보다 단호하다", trait: "direct", summary: "단호함" },
        { id: "deep", label: "생각보다 생각이 많다", trait: "quiet", summary: "생각 많음" },
      ],
    },
    {
      id: "q8", mark: "08", short: "사회적 가면", category: "진짜 성향", text: (name) => `${name}님이 밖에서 가장 많이 숨기는 건?`,
      options: [
        { id: "tired", label: "사실 많이 피곤함", trait: "quiet", summary: "피곤함" },
        { id: "annoyed", label: "불편한 걸 참고 있음", trait: "logic", summary: "참는 중" },
        { id: "sensitive", label: "생각보다 예민함", trait: "care", summary: "예민함" },
        { id: "bold", label: "사실 더 튀고 싶음", trait: "spark", summary: "튀고 싶음" },
      ],
    },
  ],
};

function getQuestions(relationshipType: RelationshipType = DEFAULT_RELATIONSHIP) {
  return QUESTION_BANK[relationshipType] ?? QUESTION_BANK[DEFAULT_RELATIONSHIP];
}

function resolveRelationship(value: unknown): RelationshipType {
  return typeof value === "string" && value in RELATIONSHIPS ? (value as RelationshipType) : DEFAULT_RELATIONSHIP;
}

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
    "상대 사용 설명서 보유자",
    "이건 거의 정답지",
  ],
  high: [
    "거의 다 맞힘",
    "이 정도면 눈치왕",
    "꽤 잘 봤네?",
    "반쯤은 마음 읽기",
    "상대 레이더 좋음",
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
    "상대 설명서 업데이트 필요",
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
    "상대가 고를 답을 하나도 놓치지 않았어요. 꽤 오래 본 사이 느낌이에요.",
    "결과가 너무 깔끔해요. 서로의 기본값을 아주 잘 알고 있어요.",
    "8문항 전부 같은 답이에요. 이 정도면 다음 선택도 맞힐 기세예요.",
    "완전 일치가 나왔어요. 둘 사이에 설명이 필요 없는 부분이 많네요.",
  ],
  high: [
    "대부분의 선택을 맞혔어요. 몇 개만 살짝 다른 게 오히려 더 재밌어요.",
    "큰 방향은 거의 맞았어요. 상대의 익숙한 모습을 잘 기억하고 있네요.",
    "맞힌 답이 꽤 많아요. 평소 행동을 그냥 넘기지 않고 보고 있었던 쪽이에요.",
    "이 정도면 충분히 잘 맞혔어요. 다른 답은 톡에서 물어보면 딱 좋아요.",
    "예측력이 꽤 좋아요. 상대의 기본 선택을 잘 알고 있는 관계예요.",
    "많이 맞고 조금 갈렸어요. 그래서 결과가 너무 뻔하지 않고 좋아요.",
    "상대의 자주 나오는 선택을 잘 잡았어요. 다른 부분은 새로 알게 된 포인트예요.",
    "거의 맞혔지만 완전 복붙은 아니에요. 딱 대화하기 좋은 결과예요.",
  ],
  middle: [
    "맞은 답과 다른 답이 섞였어요. 서로 아는 모습과 의외의 모습이 같이 나왔어요.",
    "절반쯤은 감을 잡았고, 절반쯤은 새로 알게 됐어요.",
    "예상과 실제가 적당히 갈렸어요. 결과를 보면서 웃을 포인트가 많아요.",
    "친한 것 같은데 은근히 다른 선택도 있어요. 바로 얘기해보기 좋은 결과예요.",
    "익숙한 부분은 맞혔고, 디테일은 꽤 달랐어요. 여기서부터 재밌어집니다.",
    "완전히 틀리진 않았지만 반전도 있어요. 상대의 새 면이 조금 보였어요.",
    "딱 중간 정도예요. 서로가 생각한 이미지와 실제 선택이 살짝 다르네요.",
  ],
  low: [
    "예상과 실제가 많이 달랐어요. 그래서 오히려 상대를 새로 보는 느낌이에요.",
    "생각한 답과 다른 선택이 많아요. 오늘 결과로 업데이트할 게 꽤 있어요.",
    "상대가 은근히 반전 많은 타입일 수 있어요. 바로 물어보고 싶은 답이 많네요.",
    "많이 엇갈렸지만 실패는 아니에요. 몰랐던 취향을 발견한 결과예요.",
    "예측은 빗나갔지만 대화거리는 확실히 생겼어요.",
    "상대의 실제 선택이 생각보다 달랐어요. 다음엔 더 잘 맞힐 수 있을지도요.",
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
  return getQuestions(payload.relationshipType).map((question) => {
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
      body: "상대의 기본 선택을 정말 잘 알고 있었어요. 이건 그냥 자랑해도 됩니다.",
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
  const totalCount = comparisons.length || TOTAL_QUESTIONS;
  const score = Math.round((exactCount / totalCount) * 100);
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
    totalCount,
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
    const relationshipType = resolveRelationship(parsed.relationshipType);
    const questions = getQuestions(relationshipType);
    const predictions: AnswerMap = {};
    for (const question of questions) {
      const answer = parsed.predictions[question.id];
      if (typeof answer !== "string" || !question.options.some((option) => option.id === answer)) return null;
      predictions[question.id] = answer;
    }
    return {
      version: 1,
      ownerName: parsed.ownerName.trim().slice(0, 16) || "나",
      targetName: parsed.targetName.trim().slice(0, 16) || "친구",
      relationshipType,
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

function ProgressBar({ index, total = TOTAL_QUESTIONS }: { index: number; total?: number }) {
  const pct = ((index + 1) / total) * 100;
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
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(DEFAULT_RELATIONSHIP);
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
  const activeRelationship = sharePayload?.relationshipType ?? relationshipType;
  const relationshipMeta = RELATIONSHIPS[activeRelationship];
  const currentQuestions = useMemo(() => getQuestions(activeRelationship), [activeRelationship]);
  const friendName = targetName.trim() || relationshipMeta.label;
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
      setRelationshipType(decoded.relationshipType ?? DEFAULT_RELATIONSHIP);
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
    if (!sharePayload || Object.keys(actualAnswers).length < getQuestions(sharePayload.relationshipType).length) return null;
    return buildResult(sharePayload, actualAnswers);
  }, [actualAnswers, sharePayload]);

  const currentQuestion = currentQuestions[questionIndex];
  const activeAnswers = step === "answerQuestions" ? actualAnswers : predictionAnswers;
  const selectedChoice = currentQuestion ? activeAnswers[currentQuestion.id] : "";

  const canStart = ownerName.trim().length > 0 && targetName.trim().length > 0;
  const selectRelationship = (type: RelationshipType) => {
    setRelationshipType(type);
    setPredictionAnswers({});
    setActualAnswers({});
    setQuestionIndex(0);
    setSharePayload(null);
    setErrorMessage("");
  };

  const resetAll = useCallback(() => {
    setStep("intro");
    setOwnerName("");
    setTargetName("");
    setRelationshipType(DEFAULT_RELATIONSHIP);
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

    if (questionIndex < currentQuestions.length - 1) {
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
      relationshipType,
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
              내가 먼저 상대의 선택을 예측하고, 상대가 실제로 답하면 두 답안지를 비교해요.
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
                ["01", "내가 먼저 예측", "상대라면 어떤 행동을 할지 8개 질문에 답해요."],
                ["02", "링크 보내기", "예측 답안지는 링크 안에 숨겨지고, 상대는 결과 전까지 볼 수 없어요."],
                ["03", "상대가 실제 답변", "상대가 같은 질문에 직접 답하면 바로 비교 카드가 열려요."],
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
            <p className="text-[14px] text-gray-500">보낼 대상을 고르고 이름만 입력하면 바로 시작할 수 있어요.</p>
          </section>
          <section className="grid gap-5 px-6">
            <div className="grid gap-3">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">누구한테 보낼건가요?</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(RELATIONSHIPS) as Array<[RelationshipType, (typeof RELATIONSHIPS)[RelationshipType]]>).map(([type, item]) => {
                  const active = relationshipType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectRelationship(type)}
                      className="rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98]"
                      style={{
                        borderColor: active ? P.mid : "#E5E7EB",
                        background: active ? P.bg : "#FFFFFF",
                        boxShadow: active ? `0 0 0 3px ${P.light}` : undefined,
                      }}
                    >
                      <span className="block text-[15px] font-black text-gray-900">{item.label}</span>
                      <span className="mt-1 block text-[11px] font-bold leading-snug text-gray-400">{item.helper}</span>
                    </button>
                  );
                })}
              </div>
            </div>
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
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">{relationshipMeta.targetLabel}</label>
              <input
                value={targetName}
                onChange={(event) => setTargetName(event.target.value)}
                placeholder={relationshipType === "family" ? "예: 엄마" : "예: 지환"}
                className="w-full rounded-2xl border bg-white px-4 py-4 text-[16px] font-semibold text-gray-900 outline-none transition-all"
                style={{ borderColor: targetName ? P.rose : "#E5E7EB", boxShadow: targetName ? "0 0 0 3px #FFE4E6" : undefined }}
              />
            </div>
            <div className="rounded-2xl p-4" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <p className="text-[13px] font-black text-gray-900">답변 패턴 기준으로 생성</p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                내 예측과 상대의 실제 선택을 비교해서 관계 리포트 카드로 정리해요.
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
              {!canStart && <p className="mt-2 text-center text-[12px] text-gray-400">내 이름과 상대 이름을 입력해주세요</p>}
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
              <p className="text-[12px] font-bold text-gray-400">{questionIndex + 1} / {currentQuestions.length}</p>
              <p className="text-[12px] font-bold" style={{ color: P.mid }}>{currentQuestion.category}</p>
            </div>
            <ProgressBar index={questionIndex} total={currentQuestions.length} />
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
                {questionIndex < currentQuestions.length - 1 ? "다음" : step === "predictQuestions" ? "예측 답안지 완성" : "결과 답안지 생성"}
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
              <p className="text-[13px] font-black text-gray-900">상대는 로그인 없이 바로 참여할 수 있어요</p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                결과는 상대가 8개 질문에 모두 답한 뒤에만 열립니다.
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
              <span className="text-[22px] font-black" style={{ color: P.mid }}>{relationshipMeta.answerBadge}</span>
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
              예측 {result.totalCount}문항 비교 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
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
              <MiniStat label="다른 선택" value={`${result.totalCount - result.exactCount}개`} tone="teal" />
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
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">같이 얘기할 거리</p>
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
              <p className="text-[12px] font-black tabular-nums" style={{ color: P.mid }}>{result.exactCount}/{result.totalCount}</p>
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
