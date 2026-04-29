import { BALANCE_LEVEL_QUESTION_GROUPS } from "@/lib/balance-100-question-bank";

export type BalanceAnswerValue = "A" | "B";

export type BalanceDimension = "money" | "love" | "social" | "pride" | "risk" | "comfort";
export type BalanceLevel = 1 | 2 | 3 | 4 | 5;
export type BalanceQuestionCount = 30 | 50 | 100;

export type BalanceQuestion = {
  id: string;
  level: BalanceLevel;
  dimension: BalanceDimension;
  left: string;
  right: string;
  leftScore: number;
  rightScore: number;
  heat: number;
};

export type BalanceAnswers = Record<string, BalanceAnswerValue>;

export type BalanceScoreMap = Record<BalanceDimension, number>;

export type BalanceTopChoice = {
  id: string;
  text: string;
  picked: BalanceAnswerValue;
};

export type BalanceEvidenceChoice = {
  id: string;
  dimension: BalanceDimension;
  label: string;
  picked: BalanceAnswerValue;
  text: string;
  reason: string;
};

export type BalanceResultTrigger = {
  title: string;
  description: string;
};

export type BalanceResultStory = {
  verdictTitle: string;
  verdictSubtitle: string;
  patternIntro: string;
  patterns: string[];
  relationTitle: string;
  relationLines: string[];
  triggers: BalanceResultTrigger[];
  shareTitle: string;
  shareLines: string[];
};

export type BalanceResultSummary = {
  typeTitle: string;
  typeDesc: string;
  scores: BalanceScoreMap;
  matchCode: string;
  answeredCount: number;
  topChoices: BalanceTopChoice[];
  resultHeadline?: string;
  resultReason?: string;
  primaryDimension?: BalanceDimension;
  secondaryDimension?: BalanceDimension;
  lowestDimension?: BalanceDimension;
  evidenceChoices?: BalanceEvidenceChoice[];
  resultStory?: BalanceResultStory;
};

export type Balance100LocalState = {
  level?: BalanceLevel;
  questionCount?: BalanceQuestionCount;
  answers: BalanceAnswers;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: BalanceResultSummary;
  representativeImageUrl?: string;
};

export type BalanceSharePayload = {
  version: 1;
  level?: BalanceLevel;
  questionCount?: BalanceQuestionCount;
  typeTitle: string;
  typeDesc: string;
  scores: BalanceScoreMap;
  matchCode: string;
  completedAt: string;
  representativeImageUrl?: string;
  topChoices: BalanceTopChoice[];
  resultHeadline?: string;
  resultReason?: string;
  evidenceChoices?: BalanceEvidenceChoice[];
  resultStory?: BalanceResultStory;
};

const STORAGE_PREFIX = "styledrop_balance_100_v1";

export const BALANCE_QUESTION_COUNTS: BalanceQuestionCount[] = [30, 50, 100];

const DIMENSION_LABELS: Record<BalanceDimension, string> = {
  money: "돈/현실",
  love: "연애/감정",
  social: "관계/눈치",
  pride: "자존심",
  risk: "위험감수",
  comfort: "안정/휴식",
};

export const BALANCE_LEVELS: Array<{
  level: BalanceLevel;
  title: string;
  description: string;
  badge: string;
}> = [
  {
    level: 1,
    title: "일상 선택",
    description: "가볍게 시작하는\n쉬운 질문",
    badge: "EASY",
  },
  {
    level: 2,
    title: "관계 선택",
    description: "친구·연애 기준이\n보이는 질문",
    badge: "NORMAL",
  },
  {
    level: 3,
    title: "현실 선택",
    description: "돈·감정 기준이\n갈리는 질문",
    badge: "HARD",
  },
  {
    level: 4,
    title: "진지한 선택",
    description: "쉽게 못 고르는\n무거운 질문",
    badge: "VERY HARD",
  },
  {
    level: 5,
    title: "극한 선택",
    description: "친한 사이도 갈리는\n어려운 질문",
    badge: "EXTREME",
  },
];

const BALANCE_DIMENSION_ORDER: BalanceDimension[] = ["money", "love", "social", "pride", "risk", "comfort"];

function normalizeBalanceLevel(value: unknown): BalanceLevel {
  const numeric = Number(value);
  return numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5 ? numeric : 3;
}

function normalizeBalanceQuestionCount(value: unknown): BalanceQuestionCount {
  const numeric = Number(value);
  return numeric === 30 || numeric === 50 || numeric === 100 ? numeric : 100;
}

function getLevelHeatBonus(level: BalanceLevel) {
  return (level - 1) * 5;
}

function tuneScore(score: number, level: BalanceLevel) {
  const shift = (level - 3) * 4;
  return Math.max(8, Math.min(96, score + shift));
}

function getChoiceScore(level: BalanceLevel, questionNumber: number, side: "left" | "right") {
  const base = 38 + level * 7;
  const swing = side === "left"
    ? ((questionNumber * 11 + level * 5) % 34)
    : ((questionNumber * 17 + level * 3) % 34);
  return Math.max(12, Math.min(92, base + swing - 12));
}

function makeQuestions(level: BalanceLevel) {
  let offset = 0;
  const groups = BALANCE_LEVEL_QUESTION_GROUPS[level];

  return BALANCE_DIMENSION_ORDER.flatMap((dimension) => {
    const pairs = groups[dimension];
    const questions = pairs.map(([left, right], index) => {
      const questionNumber = offset + index + 1;
      return {
        id: `l${level}_q${String(questionNumber).padStart(3, "0")}`,
        level,
        dimension,
        left,
        right,
        leftScore: tuneScore(getChoiceScore(level, questionNumber, "left"), level),
        rightScore: tuneScore(getChoiceScore(level, questionNumber, "right"), level),
        heat: 56 + getLevelHeatBonus(level) + ((questionNumber * 7) % 38),
      };
    });
    offset += pairs.length;
    return questions;
  });
}

export { normalizeBalanceLevel, normalizeBalanceQuestionCount };

export const BALANCE_QUESTION_SETS: Record<BalanceLevel, BalanceQuestion[]> = {
  1: makeQuestions(1),
  2: makeQuestions(2),
  3: makeQuestions(3),
  4: makeQuestions(4),
  5: makeQuestions(5),
};

export const BALANCE_QUESTIONS: BalanceQuestion[] = BALANCE_QUESTION_SETS[3];
export const BALANCE_DIMENSION_LABELS = DIMENSION_LABELS;

export function getBalanceQuestions(level: BalanceLevel = 3, questionCount: BalanceQuestionCount = 100) {
  return BALANCE_QUESTION_SETS[normalizeBalanceLevel(level)].slice(0, normalizeBalanceQuestionCount(questionCount));
}

export function getBalance100StorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function getBalance100Progress(
  answers: BalanceAnswers | null | undefined,
  questions: BalanceQuestion[] = BALANCE_QUESTIONS,
) {
  return {
    answered: answers ? Object.keys(answers).length : 0,
    total: questions.length,
  };
}

export function getFirstUnansweredIndex(
  answers: BalanceAnswers,
  questions: BalanceQuestion[] = BALANCE_QUESTIONS,
) {
  const index = questions.findIndex((question) => !answers[question.id]);
  return index === -1 ? questions.length - 1 : index;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function getResultType(scores: BalanceScoreMap) {
  const entries = Object.entries(scores) as Array<[BalanceDimension, number]>;
  const [topDimension, topScore] = entries.sort((a, b) => b[1] - a[1])[0];
  const risk = scores.risk;
  const money = scores.money;
  const love = scores.love;
  const comfort = scores.comfort;
  const pride = scores.pride;
  const social = scores.social;

  if (risk >= 72 && comfort <= 48) {
    return {
      typeTitle: "재미 우선형",
      typeDesc: "안정보다 재미와 자극을 먼저 봅니다. 선택이 빠르고, 재미없는 선택은 오래 붙잡지 않는 편입니다.",
    };
  }
  if (money >= 72 && pride >= 64) {
    return {
      typeTitle: "현실 계산형",
      typeDesc: "감정보다 결과와 손익을 먼저 봅니다. 손해가 커 보이는 선택은 오래 참지 않는 편입니다.",
    };
  }
  if (love >= 72) {
    return {
      typeTitle: "감정 몰입형",
      typeDesc: "관계의 온도와 감정의 밀도를 크게 봅니다. 마음이 움직이면 생각보다 과감해지는 편입니다.",
    };
  }
  if (social >= 72) {
    return {
      typeTitle: "관계 감지형",
      typeDesc: "사람 사이의 분위기와 반응을 빠르게 읽습니다. 선택할 때도 내 기준만큼 주변 흐름을 같이 봅니다.",
    };
  }
  if (comfort >= 72) {
    return {
      typeTitle: "안정 우선형",
      typeDesc: "새로움보다 컨디션과 편안함을 중요하게 봅니다. 무리해서 얻는 선택에는 쉽게 지치는 편입니다.",
    };
  }
  if (topScore >= 68) {
    return {
      typeTitle: `${DIMENSION_LABELS[topDimension]} 기준형`,
      typeDesc: "선택 기준이 비교적 또렷합니다. 애매한 타협보다 내 기준에 더 맞는 쪽을 고르는 편입니다.",
    };
  }
  return {
    typeTitle: "상황 판단형",
    typeDesc: "한 가지 기준으로만 밀어붙이지 않습니다. 질문의 상황에 따라 현실, 감정, 관계 기준을 바꿔 쓰는 편입니다.",
  };
}

function sortDimensionsByScore(scores: BalanceScoreMap) {
  return (Object.entries(scores) as Array<[BalanceDimension, number]>)
    .sort((a, b) => b[1] - a[1])
    .map(([dimension]) => dimension);
}

function buildResultNarrative(scores: BalanceScoreMap) {
  const sortedDimensions = sortDimensionsByScore(scores);
  const primaryDimension = sortedDimensions[0];
  const secondaryDimension = sortedDimensions[1];
  const lowestDimension = sortedDimensions[sortedDimensions.length - 1];
  const primaryLabel = DIMENSION_LABELS[primaryDimension];
  const secondaryLabel = DIMENSION_LABELS[secondaryDimension];
  const lowestLabel = DIMENSION_LABELS[lowestDimension];
  const topGap = scores[primaryDimension] - scores[secondaryDimension];
  const spread = scores[primaryDimension] - scores[lowestDimension];

  if (topGap <= 4 && spread <= 12) {
    return {
      primaryDimension,
      secondaryDimension,
      lowestDimension,
      resultHeadline: "상황마다 기준을 바꾸는 타입",
      resultReason:
        `${primaryLabel}와 ${secondaryLabel} 기준이 비슷하게 높고, ${lowestLabel}도 크게 낮지 않습니다. 한 가지 성향으로 몰리기보다 질문의 맥락에 맞춰 답을 바꾼 쪽에 가깝습니다.`,
    };
  }

  if (topGap <= 5) {
    return {
      primaryDimension,
      secondaryDimension,
      lowestDimension,
      resultHeadline: `${primaryLabel}와 ${secondaryLabel} 사이에서 많이 흔들리는 타입`,
      resultReason:
        `${primaryLabel} 기준이 가장 높지만 ${secondaryLabel}도 거의 비슷하게 따라옵니다. 그래서 단순한 취향보다 상황, 사람, 손익을 같이 재는 선택이 많았습니다.`,
    };
  }

  return {
    primaryDimension,
    secondaryDimension,
    lowestDimension,
    resultHeadline: `${primaryLabel}을 먼저 보는 타입`,
    resultReason:
      `${primaryLabel} 기준이 가장 자주 드러났고, 다음으로 ${secondaryLabel} 기준이 따라왔습니다. 반대로 ${lowestLabel} 쪽은 상대적으로 덜 중요하게 본 선택이 많았습니다.`,
  };
}

const VERDICT_START: Record<BalanceDimension, string> = {
  money: "겉으론 현실적인데",
  love: "마음이 움직이면 약해지는데",
  social: "눈치 안 보는 척하지만",
  pride: "평소엔 넘기는 듯해도",
  risk: "안전한 척하지만",
  comfort: "무리하지 않는 척하지만",
};

const VERDICT_END: Record<BalanceDimension, string> = {
  money: "결국 손익을 놓치지 않는 타입",
  love: "정이 끼면 계산이 느려지는 타입",
  social: "사람 분위기에 오래 반응하는 타입",
  pride: "선을 넘으면 바로 닫히는 타입",
  risk: "확신이 생기면 크게 움직이는 타입",
  comfort: "편하지 않으면 오래 못 버티는 타입",
};

const VERDICT_SUBTITLE: Record<BalanceDimension, string> = {
  money: "좋고 싫음보다 나중에 후회가 적은지를 먼저 재는 편입니다.",
  love: "마음이 걸리는 순간부터는 답이 쉽게 깔끔해지지 않습니다.",
  social: "괜찮은 척해도 분위기와 상대 반응을 꽤 오래 기억합니다.",
  pride: "손해는 넘겨도, 만만하게 보이는 느낌은 오래 못 넘깁니다.",
  risk: "평소엔 신중하지만, 납득되면 생각보다 빠르게 움직입니다.",
  comfort: "잘 버티는 것처럼 보여도 회복 없는 선택은 오래 못 갑니다.",
};

const PATTERN_LINES: Record<BalanceDimension, string[]> = {
  money: [
    "마음이 가도 나중에 손해가 적은 쪽",
    "좋은 말보다 실제로 남는 게 있는 쪽",
    "큰 보상보다 후폭풍이 덜한 쪽",
  ],
  love: [
    "맞는 말보다 마음이 덜 상하는 쪽",
    "계산보다 정이 덜 찝찝한 쪽",
    "끝나고도 마음에 남지 않는 쪽",
  ],
  social: [
    "이기는 말보다 관계가 덜 깨지는 쪽",
    "내 기준보다 분위기가 덜 상하는 쪽",
    "불편해도 티를 덜 내는 쪽",
  ],
  pride: [
    "손해보다 만만해 보이지 않는 쪽",
    "참는 것보다 선을 지키는 쪽",
    "좋게 넘어가도 내 기준은 남기는 쪽",
  ],
  risk: [
    "안전한 답보다 나중에 후회가 적은 쪽",
    "애매한 안정감보다 확실한 자극이 있는 쪽",
    "실패해도 내가 고른 느낌이 남는 쪽",
  ],
  comfort: [
    "대단한 보상보다 내가 덜 무너지는 쪽",
    "무리해서 얻는 것보다 오래 편한 쪽",
    "남는 일정보다 회복할 틈이 있는 쪽",
  ],
};

const RELATION_COPY: Record<BalanceDimension, { title: string; lines: string[] }> = {
  money: {
    title: "사람 문제도 결국 기준을 세우는 편",
    lines: [
      "좋아하는 사람이어도 계속 손해 보는 흐름은 오래 못 둡니다.",
      "정은 있지만, 관계가 내 생활을 망가뜨리면 마음이 천천히 식습니다.",
    ],
  },
  love: {
    title: "정이 들면 계산이 느려지는 편",
    lines: [
      "쉽게 마음을 다 주는 사람은 아니지만, 한 번 들어오면 오래 챙깁니다.",
      "문제는 괜찮은 척하는 시간이 길어서 상대가 모를 때가 있다는 것.",
    ],
  },
  social: {
    title: "겉보다 분위기를 더 많이 읽는 편",
    lines: [
      "별말 안 해도 누가 불편한지, 흐름이 어디서 꼬였는지 꽤 빨리 봅니다.",
      "그래서 내 기분보다 관계가 덜 깨지는 쪽을 먼저 고를 때가 있습니다.",
    ],
  },
  pride: {
    title: "선을 넘는 순간 마음이 먼저 닫히는 편",
    lines: [
      "평소엔 넘기는 척해도 무시당했다는 느낌은 쉽게 잊지 않습니다.",
      "말로 크게 싸우기보다 마음속에서 조용히 거리를 벌리는 쪽에 가깝습니다.",
    ],
  },
  risk: {
    title: "확신이 생기면 관계에서도 빠르게 움직이는 편",
    lines: [
      "계속 재기만 하는 관계보다, 방향이 보이면 먼저 움직이는 쪽입니다.",
      "다만 확신이 없을 땐 생각보다 오래 관찰합니다.",
    ],
  },
  comfort: {
    title: "편하지 않은 관계는 오래 못 끌고 가는 편",
    lines: [
      "좋은 사람이어도 계속 에너지를 빼앗기면 마음이 먼저 지칩니다.",
      "무리해서 맞추기보다 자연스럽게 편한 사람에게 오래 남습니다.",
    ],
  },
};

const TRIGGER_COPY: Record<BalanceDimension, BalanceResultTrigger> = {
  money: {
    title: "계속 손해 보는 느낌",
    description: "한두 번은 넘겨도, 반복되면 마음속 계산서가 조용히 쌓입니다.",
  },
  love: {
    title: "정이 든 애매한 관계",
    description: "확실히 좋다 싫다보다 흐리게 끌려가는 상태에서 더 흔들립니다.",
  },
  social: {
    title: "분위기가 싸해지는 순간",
    description: "내 잘못이 아니어도 흐름이 깨지면 괜히 더 신경이 갑니다.",
  },
  pride: {
    title: "무시당하는 느낌",
    description: "손해 보는 건 참아도, 만만하게 보는 건 오래 못 참습니다.",
  },
  risk: {
    title: "기회가 지나가는 느낌",
    description: "안정적인 선택이어도 나중에 후회할 것 같으면 마음이 흔들립니다.",
  },
  comfort: {
    title: "쉴 틈 없이 몰리는 상황",
    description: "할 수는 있어도, 회복할 시간이 없으면 선택 자체가 무겁게 느껴집니다.",
  },
};

const SHARE_LINES: Record<BalanceDimension, string> = {
  money: "현실적인 척이 아니라 실제로 후폭풍을 계산함.",
  love: "마음이 걸리면 계산이 조금 느려짐.",
  social: "괜찮은 척해도 분위기는 다 보고 있음.",
  pride: "손해보다 무시당하는 느낌을 더 못 넘김.",
  risk: "확신이 생기면 생각보다 크게 움직임.",
  comfort: "오래 편하지 않은 선택은 결국 정리함.",
};

function uniqueValues<T>(values: T[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function buildResultStory(scores: BalanceScoreMap): BalanceResultStory {
  const sortedDimensions = sortDimensionsByScore(scores);
  const primaryDimension = sortedDimensions[0];
  const secondaryDimension = sortedDimensions[1];
  const thirdDimension = sortedDimensions[2];
  const topGap = scores[primaryDimension] - scores[secondaryDimension];
  const spread = scores[primaryDimension] - scores[sortedDimensions[sortedDimensions.length - 1]];
  const isBalanced = topGap <= 4 && spread <= 12;
  const relationDimension = [primaryDimension, secondaryDimension, thirdDimension]
    .find((dimension) => dimension === "love" || dimension === "social" || dimension === "pride")
    ?? primaryDimension;
  const triggerDimensions = uniqueValues([primaryDimension, secondaryDimension, ...sortedDimensions]).slice(0, 2);

  return {
    verdictTitle: isBalanced
      ? "한쪽으로 쉽게 몰리지 않는 타입"
      : `${VERDICT_START[primaryDimension]}, ${VERDICT_END[secondaryDimension]}`,
    verdictSubtitle: isBalanced
      ? "상황마다 기준을 바꾸지만, 그래서 오히려 쉽게 휘둘리지는 않습니다."
      : VERDICT_SUBTITLE[primaryDimension],
    patternIntro: "너는 이런 선택을 자주 골랐다.",
    patterns: uniqueValues([
      PATTERN_LINES[primaryDimension][0],
      PATTERN_LINES[secondaryDimension][0],
      PATTERN_LINES[thirdDimension][0],
      ...PATTERN_LINES[primaryDimension],
    ]).slice(0, 3),
    relationTitle: RELATION_COPY[relationDimension].title,
    relationLines: RELATION_COPY[relationDimension].lines,
    triggers: triggerDimensions.map((dimension) => TRIGGER_COPY[dimension]),
    shareTitle: "나는 이런 선택을 하는 사람",
    shareLines: uniqueValues([
      SHARE_LINES[primaryDimension],
      SHARE_LINES[secondaryDimension],
      SHARE_LINES[thirdDimension],
      SHARE_LINES[relationDimension],
      ...sortedDimensions.map((dimension) => SHARE_LINES[dimension]),
    ]).slice(0, 4),
  };
}

export function getBalanceResultStory(result: Pick<BalanceResultSummary, "scores" | "resultStory">): BalanceResultStory {
  return result.resultStory ?? buildResultStory(result.scores);
}

function getEvidenceReason(dimension: BalanceDimension, picked: string) {
  switch (dimension) {
    case "money":
      return `${picked}을 고른 건 감정보다 손익, 효율, 현실성을 먼저 계산한 선택입니다.`;
    case "love":
      return `${picked}을 고른 건 관계의 온도와 마음의 움직임을 크게 본 선택입니다.`;
    case "social":
      return `${picked}을 고른 건 내 기준만큼 분위기와 사람 사이의 흐름을 의식한 선택입니다.`;
    case "pride":
      return `${picked}을 고른 건 자존심, 인정, 체면이 걸린 상황에서 기준이 드러난 선택입니다.`;
    case "risk":
      return `${picked}을 고른 건 안정적인 쪽보다 변화나 자극을 받아들이는지 보여주는 선택입니다.`;
    case "comfort":
      return `${picked}을 고른 건 무리해서 얻는 것보다 오래 편한 쪽을 중요하게 본 선택입니다.`;
  }
}

function buildEvidenceChoices(
  questions: BalanceQuestion[],
  answers: BalanceAnswers,
  sortedDimensions: BalanceDimension[],
) {
  const priorityDimensions = new Set(sortedDimensions.slice(0, 3));
  const pickedQuestions = questions.filter((question) => answers[question.id]);
  const primary = pickedQuestions
    .filter((question) => priorityDimensions.has(question.dimension))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 4);

  const fallback = pickedQuestions
    .filter((question) => !primary.some((item) => item.id === question.id))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, Math.max(0, 4 - primary.length));

  return [...primary, ...fallback].map((question) => {
    const picked = answers[question.id] as BalanceAnswerValue;
    const text = picked === "A" ? question.left : question.right;

    return {
      id: question.id,
      dimension: question.dimension,
      label: DIMENSION_LABELS[question.dimension],
      picked,
      text,
      reason: getEvidenceReason(question.dimension, text),
    };
  });
}

export function analyzeBalanceAnswers(
  answers: BalanceAnswers,
  levelOrQuestions: BalanceLevel | BalanceQuestion[] = 3,
): BalanceResultSummary {
  const questions = Array.isArray(levelOrQuestions)
    ? levelOrQuestions
    : getBalanceQuestions(levelOrQuestions);
  const scoreState: Record<BalanceDimension, { sum: number; count: number }> = {
    money: { sum: 0, count: 0 },
    love: { sum: 0, count: 0 },
    social: { sum: 0, count: 0 },
    pride: { sum: 0, count: 0 },
    risk: { sum: 0, count: 0 },
    comfort: { sum: 0, count: 0 },
  };

  questions.forEach((question) => {
    const picked = answers[question.id];
    if (!picked) return;
    const score = picked === "A" ? question.leftScore : question.rightScore;
    scoreState[question.dimension].sum += score;
    scoreState[question.dimension].count += 1;
  });

  const scores = Object.fromEntries(
    (Object.entries(scoreState) as Array<[BalanceDimension, { sum: number; count: number }]>)
      .map(([dimension, state]) => [dimension, state.count ? Math.round(state.sum / state.count) : 0])
  ) as BalanceScoreMap;

  const pickedText = questions.map((question) => answers[question.id] ?? "-").join("");
  const { typeTitle, typeDesc } = getResultType(scores);
  const narrative = buildResultNarrative(scores);
  const sortedDimensions = sortDimensionsByScore(scores);
  const resultStory = buildResultStory(scores);

  const topChoices = questions
    .filter((question) => answers[question.id])
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 5)
    .map((question) => {
      const picked = answers[question.id] as BalanceAnswerValue;
      return {
        id: question.id,
        picked,
        text: picked === "A" ? question.left : question.right,
      };
    });
  const evidenceChoices = buildEvidenceChoices(questions, answers, sortedDimensions);

  return {
    typeTitle,
    typeDesc,
    scores,
    matchCode: hashString(pickedText).slice(0, 6),
    answeredCount: Object.keys(answers).length,
    topChoices,
    ...narrative,
    evidenceChoices,
    resultStory,
  };
}

export function encodeBalanceSharePayload(payload: BalanceSharePayload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function decodeBalanceSharePayload(value: string): BalanceSharePayload | null {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as BalanceSharePayload;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
