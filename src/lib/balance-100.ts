export type BalanceAnswerValue = "A" | "B";

export type BalanceDimension = "money" | "love" | "social" | "pride" | "risk" | "comfort";
export type BalanceLevel = 1 | 2 | 3 | 4 | 5;

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
};

export type Balance100LocalState = {
  level?: BalanceLevel;
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
};

const STORAGE_PREFIX = "styledrop_balance_100_v1";

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

const questionGroups: Record<BalanceDimension, Array<[string, string, number, number]>> = {
  money: [
    ["월 250 칼퇴", "월 500 평생 야근", 32, 82],
    ["10억 받고 10년 늙기", "그냥 지금처럼 살기", 86, 24],
    ["평생 무료 집", "평생 무료 여행", 78, 42],
    ["월급 안정 직장", "대박 가능 스타트업", 35, 84],
    ["좋아하는 일 적은 돈", "싫은 일 큰돈", 34, 82],
    ["로또 1등인데 익명 불가", "로또 3등인데 완전 익명", 78, 46],
    ["친구에게 100만원 빌려주기", "친구에게 절대 돈 안 빌려주기", 38, 76],
    ["평생 배달음식 무료", "평생 옷 무료", 58, 64],
    ["계좌 공개", "검색기록 공개", 82, 46],
    ["한 달 무소비", "한 달 무휴식", 42, 86],
    ["집 좁고 역세권", "집 넓고 외곽", 57, 52],
    ["돈 많이 버는 무명", "적게 벌지만 유명", 72, 44],
    ["5년 고생 후 부자", "평생 적당히 편함", 84, 38],
    ["매일 도시락", "매일 택시 금지", 48, 62],
    ["친구보다 내가 잘 벌기", "친구들이 다 잘 되기", 76, 36],
    ["1년 해외 못 나가기", "1년 쇼핑 못 하기", 50, 70],
  ],
  love: [
    ["평생 설레지만 불안정", "평생 편하지만 무덤덤", 82, 42],
    ["연애 공개", "연애 완전 비공개", 58, 68],
    ["매일 연락 필수", "3일에 한 번 연락", 74, 38],
    ["나를 더 좋아하는 사람", "내가 더 좋아하는 사람", 46, 82],
    ["전 애인과 같은 회사", "현 애인의 전 애인과 여행", 62, 88],
    ["연애 초반부터 동거", "1년 넘게 거리두기", 76, 36],
    ["질투 많은 애인", "무관심한 애인", 68, 42],
    ["사랑 없는 안정", "안정 없는 사랑", 38, 86],
    ["매번 이벤트", "평생 담백함", 70, 35],
    ["친구 같은 연애", "드라마 같은 연애", 44, 82],
    ["읽씹 1일", "매일 3시간 통화", 50, 76],
    ["첫눈에 반하기", "오래 보고 스며들기", 78, 42],
    ["연인 취향에 맞추기", "내 취향 지키기", 58, 66],
    ["같이 모든 취미", "각자 취미 완전 존중", 62, 40],
    ["이별 후 친구 가능", "이별 후 완전 차단", 70, 58],
    ["외모 이상형", "대화 이상형", 54, 72],
  ],
  social: [
    ["친구 100명 얕게", "친구 1명 깊게", 72, 36],
    ["모임마다 중심", "편한 사람 옆자리", 80, 32],
    ["카톡 답장 빠름", "카톡 알림 꺼둠", 70, 42],
    ["내 얘기 많이 하기", "상대 얘기 듣기", 64, 38],
    ["불편해도 분위기 맞추기", "분위기 깨도 솔직히 말하기", 50, 82],
    ["생일파티 크게", "조용히 밥 한 끼", 76, 34],
    ["친구 부탁 다 들어주기", "거절은 바로 하기", 54, 78],
    ["단톡방 20개", "단톡방 0개", 82, 30],
    ["새 사람 만나는 주말", "혼자 충전하는 주말", 74, 28],
    ["모두에게 좋은 사람", "내 사람에게만 좋은 사람", 58, 42],
    ["싸우면 바로 풀기", "시간 두고 풀기", 64, 46],
    ["친구 고민 밤새 듣기", "30분 듣고 자러 가기", 58, 72],
    ["SNS 활발", "SNS 잠수", 78, 32],
    ["계획 없는 번개", "약속은 최소 1주 전", 72, 36],
    ["어색함 먼저 깨기", "누가 말 걸 때까지 기다리기", 76, 30],
    ["남 평가 신경 씀", "내 기준이 더 중요", 62, 80],
    ["친구의 친구도 친구", "친구의 친구는 남", 72, 35],
  ],
  pride: [
    ["먼저 사과하기", "끝까지 자존심 지키기", 34, 86],
    ["틀린 거 바로 인정", "일단 버티고 보기", 38, 82],
    ["망신 한 번 크게", "작은 창피 매일", 72, 58],
    ["내 약점 공개", "내 실수 숨기기", 40, 78],
    ["지는 게 편함", "이겨야 잠이 옴", 32, 86],
    ["칭찬 못 받아도 괜찮음", "인정 못 받으면 힘듦", 34, 80],
    ["웃긴 사람", "멋있는 사람", 44, 76],
    ["내 흑역사 1개 공개", "남의 흑역사 10개 보기", 68, 42],
    ["좋아하는 사람 앞에서 실수", "싫어하는 사람 앞에서 패배", 70, 88],
    ["내가 먼저 연락", "상대가 먼저 연락", 42, 76],
    ["실패해도 공개 도전", "안전하게 비공개 준비", 70, 44],
    ["조언 듣고 수정", "내 방식 끝까지", 38, 84],
    ["웃음거리 되기", "아무도 기억 못 하기", 72, 46],
    ["작게 성공 자주", "크게 성공 한 번", 46, 80],
    ["내가 손해 보고 평화", "싸워서라도 정산", 34, 78],
    ["모르는 척 배우기", "아는 척 버티기", 36, 82],
    ["결과보다 과정", "과정보다 결과", 42, 78],
  ],
  risk: [
    ["안전한 길", "재밌는 길", 30, 82],
    ["계획대로 살기", "갑자기 떠나기", 34, 84],
    ["낯선 도시 혼자", "익숙한 동네 계속", 82, 28],
    ["확률 낮은 대박", "확실한 중간", 86, 36],
    ["공포영화 주인공", "로맨스 조연", 78, 38],
    ["새벽 즉흥 여행", "주말 집콕", 84, 28],
    ["고백하고 후회", "말 안 하고 후회", 80, 44],
    ["실패 가능 도전", "실패 없는 반복", 84, 30],
    ["모르는 사람 많은 파티", "아는 사람 둘과 카페", 78, 35],
    ["투자 크게", "저축만 하기", 86, 30],
    ["비 오는 날 캠핑", "맑은 날 쇼핑몰", 76, 28],
    ["새 메뉴만 먹기", "평생 검증된 메뉴", 74, 26],
    ["무대 위 3분", "관객석 평생", 82, 34],
    ["노잼 안정", "꿀잼 불안", 32, 88],
    ["운전해서 낯선 길", "대중교통 정해진 길", 74, 38],
    ["될 때까지 밀어붙임", "위험하면 바로 철수", 82, 32],
    ["하루 만에 결정", "한 달 고민", 78, 36],
  ],
  comfort: [
    ["매일 운동 1시간", "매일 낮잠 1시간", 35, 82],
    ["아침형 인간", "새벽형 인간", 46, 68],
    ["깨끗한 방 필수", "어질러져도 편함", 58, 76],
    ["집밥 루틴", "외식 루틴", 72, 46],
    ["계획 꽉 찬 하루", "비워둔 하루", 36, 84],
    ["혼자 쉬기", "사람 만나 충전", 86, 42],
    ["좋은 침대", "좋은 옷장", 84, 44],
    ["휴대폰 없이 하루", "잠 없이 하루", 50, 88],
    ["카페에서 멍때리기", "핫플 줄서기", 82, 38],
    ["느린 여행", "빡센 여행", 86, 34],
    ["잠옷으로 하루", "풀세팅으로 하루", 84, 42],
    ["집 근처 산책", "먼 곳 원정", 78, 44],
    ["편한 사람만 만나기", "새 자극 계속 받기", 80, 36],
    ["주말엔 아무것도 안 함", "주말엔 뭐라도 해야 함", 88, 34],
    ["미리 예약", "가서 정하기", 74, 42],
    ["같은 노래 반복", "새 노래 탐색", 76, 40],
    ["평생 안락함", "평생 새로움", 86, 34],
  ],
};

function normalizeBalanceLevel(value: unknown): BalanceLevel {
  const numeric = Number(value);
  return numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5 ? numeric : 3;
}

function getLevelHeatBonus(level: BalanceLevel) {
  return (level - 1) * 5;
}

function tuneScore(score: number, level: BalanceLevel) {
  const shift = (level - 3) * 4;
  return Math.max(8, Math.min(96, score + shift));
}

function makeQuestions(level: BalanceLevel) {
  let offset = 0;
  return (Object.entries(questionGroups) as Array<[BalanceDimension, Array<[string, string, number, number]>]>)
    .flatMap(([dimension, pairs]) =>
      pairs.map(([left, right, leftScore, rightScore], index) => {
        const questionNumber = offset + index + 1;
        return {
          id: `l${level}_q${String(questionNumber).padStart(3, "0")}`,
          level,
          dimension,
          left,
          right,
          leftScore: tuneScore(leftScore, level),
          rightScore: tuneScore(rightScore, level),
          heat: 56 + getLevelHeatBonus(level) + ((questionNumber * 7) % 38),
        };
      }).map((question, index, arr) => {
        if (index === arr.length - 1) offset += arr.length;
        return question;
      })
    );
}

export { normalizeBalanceLevel };

export const BALANCE_QUESTION_SETS: Record<BalanceLevel, BalanceQuestion[]> = {
  1: makeQuestions(1),
  2: makeQuestions(2),
  3: makeQuestions(3),
  4: makeQuestions(4),
  5: makeQuestions(5),
};

export const BALANCE_QUESTIONS: BalanceQuestion[] = BALANCE_QUESTION_SETS[3];
export const BALANCE_TOTAL_QUESTIONS = BALANCE_QUESTIONS.length;
export const BALANCE_DIMENSION_LABELS = DIMENSION_LABELS;

export function getBalanceQuestions(level: BalanceLevel = 3) {
  return BALANCE_QUESTION_SETS[normalizeBalanceLevel(level)];
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
