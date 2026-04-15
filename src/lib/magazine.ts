import { ALL_STYLES } from "@/lib/styles";

export type MagazineFactCard = {
  eyebrow: string;
  title: string;
  body: string;
};

// Mock 사용자 데이터
export type MockUser = {
  userId: string;
  nickname: string;
  profileImage: string | null;
  imageUrl: string;
  comment: string;
  instagramHandle: string | null;
  likeCount: number;
  createdAt: string;
};

// 테스트 댓글 생성 함수
function generateMockComments(styleId: string, count: number): MockUser[] {
  const comments: { [key: string]: string[] } = {
    "mongolian-warrior": [
      "전사였을 것 같아요 🗡️",
      "나는 초원의 사냥꾼이었을 거 같네",
      "기마병이 되고 싶었을 것 같아요",
      "정말 멋진 전사 같습니다",
      "초원의 기사가 될 수 있을 것 같네",
      "강한 전사의 느낌이 확 들어요",
      "몽골 부족의 수장이 되고 싶었을 것 같아요",
      "이 정도면 진짜 몽골 전사 맞음",
      "화려한 복장이 너무 멋있어요",
      "역사 속의 전사 같은 느낌",
    ],
    "astronaut": [
      "달 탐사 임무를 하고 싶어요 🌙",
      "화성 탐사선 조종사가 되고 싶음",
      "우주 정거장 건설 임무를 원해요",
      "우주 유영을 직접 하고 싶네요",
      "새로운 행성을 발견하는 것이 꿈입니다",
      "우주 망원경 관측 임무를 원해요",
      "소행성 채굴 탐사를 해보고 싶어요",
      "국제 우주 정거장 과학자가 되고 싶음",
      "우주 생물 연구를 하고 싶어요",
      "황금비율로 멋진 우주비행사네요",
    ],
    "western-gunslinger": [
      "정의의 보안관이 되고 싶어요 🤠",
      "악당을 무찌르는 영웅이 되겠습니다",
      "서부의 전설이 되고 싶네요",
      "정의감 가득한 모습이 정말 좋아요",
      "황야의 영웅 같은 느낌입니다",
      "나쁜 악당들을 혼내주고 싶어요",
      "서부 마을을 지키는 보안관이 될래요",
      "멋진 총잡이 같은 기운이 느껴져요",
      "진짜 서부 영화의 주인공 같아",
      "이 정도면 레전드 건슬링거 맞음",
    ],
    "boxing-counterpunch": [
      "스피드 복싱으로 이기고 싶어요 💪",
      "파워 펀처가 되는 게 꿈입니다",
      "정확한 펀치로 승리하고 싶네요",
      "링에서 최강의 파이터가 되고 싶어요",
      "카운터 펀치 마스터가 되겠습니다",
      "챔피언 벨트를 차고 싶어요",
      "복싱의 예술을 극대화하고 싶음",
      "이 정도 피지컬이면 챔피언 가능해요",
      "기술과 파워가 완벽하게 조화됨",
      "링의 전사 같은 멋있는 모습이네요",
    ],
  };

  const baseComments = comments[styleId] || comments["mongolian-warrior"];
  const users = [];

  for (let i = 0; i < count; i++) {
    const seed = (Math.random() * 10000).toString();
    users.push({
      userId: `user-${String(i + 1).padStart(3, "0")}`,
      nickname: `사용자${i + 1}`,
      profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`,
      imageUrl: `https://images.unsplash.com/photo-${1552783753 + i}?w=400&h=400&fit=crop`,
      comment: baseComments[i % baseComments.length],
      instagramHandle: Math.random() > 0.5 ? `user_${i + 1}` : null,
      likeCount: Math.floor(Math.random() * 50) + 1,
      createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return users.sort((a, b) => b.likeCount - a.likeCount);
}

// 각 매거진 기사별 Mock 댓글
export const MOCK_BOARD_DATA: Record<string, MockUser[]> = {
  "mongolian-warrior": generateMockComments("mongolian-warrior", 30),
  astronaut: generateMockComments("astronaut", 30),
  "western-gunslinger": generateMockComments("western-gunslinger", 30),
  "boxing-counterpunch": generateMockComments("boxing-counterpunch", 30),
};

export type MagazineArticle = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  communityLabel: string;
  communityHeadline: string;
  communityFact: string; // 재미있는 사실 한 줄
  communityQuestion: string; // 참여 유도 질문 (AI 자동 생성)
  primaryStyleId: string;
  relatedStyleIds: string[];
  ctaLabel: string;
  accent: string;
  panel: string;
  storyCards: MagazineFactCard[];
  quickFacts: string[];
};

export const MAGAZINE_ARTICLES: MagazineArticle[] = [
  {
    slug: "mongol-steppe-warrior",
    eyebrow: "MONGOL NOTE",
    title: "몽골 부족은 멈춘 적보다 움직이는 적일 때 더 강했습니다",
    summary: "넓은 초원에서는 오래 버티는 힘보다 빠르게 흩어지고 다시 모이는 움직임이 더 위협적이었습니다.",
    communityLabel: "몽골 전사",
    communityHeadline: "이번주 인기있는 몽골 부족",
    communityFact: "몽골 부족은 말을 타면서도 활을 정확하게 쏠 수 있는 훈련을 받았습니다.",
    communityQuestion: "당신은 몽골 부족에서 어떤 역할을 했을까요?",
    primaryStyleId: "mongolian-warrior",
    relatedStyleIds: ["mongolian-warrior"],
    ctaLabel: "몽골의 전사 카드 나도 만들어보기",
    accent: "#CFA35A",
    panel: "#14100B",
    storyCards: [
      {
        eyebrow: "01",
        title: "길보다 방향 감각이 중요했습니다",
        body: "정해진 도로보다 지형을 읽고 유연하게 움직이는 능력이 더 중요했습니다.",
      },
      {
        eyebrow: "02",
        title: "말은 탈것이 아니라 전술 장비였습니다",
        body: "빠른 이동과 거리 운영이 모두 말과 함께 이뤄졌습니다.",
      },
      {
        eyebrow: "03",
        title: "복식도 움직이기 위해 설계됐습니다",
        body: "보온은 유지하면서도 말을 타고 무기를 쓰기 편해야 했습니다.",
      },
    ],
    quickFacts: [
      "바람 맞은 피부 질감이 잘 어울립니다.",
      "전신 구도라 풍경까지 같이 읽힙니다.",
      "옵션 버전까지 있어 변주가 쉽습니다.",
    ],
  },
  {
    slug: "astronaut-editorial",
    eyebrow: "SPACE FILE",
    title: "우주비행사 컷은 얼굴보다 장비가 분위기를 만듭니다",
    summary: "헬멧, 반사광, 검은 배경이 먼저 맞아야 우주 사진처럼 보입니다.",
    communityLabel: "우주 비행사",
    communityHeadline: "이번주 인기있는 우주 비행사",
    communityFact: "우주비행사는 우주복 하나에 14개의 레이어가 있어 생존할 수 있습니다.",
    communityQuestion: "당신은 우주에서 어떤 임무를 수행하고 싶나요?",
    primaryStyleId: "astronaut",
    relatedStyleIds: ["astronaut"],
    ctaLabel: "우주 비행사 카드 나도 만들어보기",
    accent: "#8BB7FF",
    panel: "#0B1220",
    storyCards: [
      {
        eyebrow: "01",
        title: "우주복은 옷보다 장비에 가깝습니다",
        body: "겉으로 보이는 하얀 표면 뒤에 생존용 층이 많아 구조적으로 보입니다.",
      },
      {
        eyebrow: "02",
        title: "바이저는 얼굴을 조금 가려야 자연스럽습니다",
        body: "반사광과 틴트가 있어야 현실감이 생기고, 너무 선명하면 합성처럼 보입니다.",
      },
      {
        eyebrow: "03",
        title: "검은 배경일수록 별 디테일이 중요합니다",
        body: "별 간격과 밝기 차이가 자연스러워야 전체 컷이 살아납니다.",
      },
    ],
    quickFacts: [
      "정면 중간 구도가 가장 안정적입니다.",
      "국기와 마킹이 정체성을 만듭니다.",
      "차가운 림라이트가 핵심입니다.",
    ],
  },
  {
    slug: "western-gunslinger",
    eyebrow: "WESTERN CUT",
    title: "서부 총잡이 무드는 총보다 긴장감에서 나옵니다",
    summary: "모자 그림자, 먼지, 시선 처리만 맞아도 영화 스틸 같은 분위기가 생깁니다.",
    communityLabel: "서부 총잡이",
    communityHeadline: "이번주 인기있는 서부 총잡이",
    communityFact: "西部의 총잡이들은 빠른 손 움직임뿐 아니라 상대의 미세한 신체 언어까지 읽을 수 있었습니다.",
    communityQuestion: "당신은 서부 도시에서 어떤 이야기를 만들고 싶나요?",
    primaryStyleId: "western-gunslinger",
    relatedStyleIds: ["western-gunslinger"],
    ctaLabel: "서부 총잡이 카드 나도 만들어보기",
    accent: "#D18A4A",
    panel: "#17100B",
    storyCards: [
      {
        eyebrow: "01",
        title: "액션보다 침묵이 먼저 옵니다",
        body: "빈 거리와 시선이 먼저 쌓여야 총이 나와도 영화처럼 읽힙니다.",
      },
      {
        eyebrow: "02",
        title: "모자 아래 그림자가 캐릭터를 만듭니다",
        body: "얼굴을 일부만 가리는 편이 더 긴장감 있고 영화적입니다.",
      },
      {
        eyebrow: "03",
        title: "먼지와 목재 질감이 중요합니다",
        body: "배경이 너무 깨끗하면 바로 세트처럼 보입니다.",
      },
    ],
    quickFacts: [
      "낮은 아침빛이 가장 잘 맞습니다.",
      "오프축 시선이 훨씬 영화적입니다.",
      "과장된 포즈보다 약간 틀어진 자세가 자연스럽습니다.",
    ],
  },
  {
    slug: "boxing-counterpunch",
    eyebrow: "RING STUDY",
    title: "카운터펀치 컷은 타이밍이 전부입니다",
    summary: "복싱 사진은 크게 휘두르는 장면보다 짧고 날카로운 순간이 더 강하게 보입니다.",
    communityLabel: "카운터펀치",
    communityHeadline: "이번주 인기있는 카운터펀치",
    communityFact: "복싱의 카운터펀치는 상대의 공격 이후 1/10초 안에 반격하는 기술입니다.",
    communityQuestion: "당신은 링 위에서 어떤 복싱 스타일을 표현하고 싶나요?",
    primaryStyleId: "boxing-counterpunch",
    relatedStyleIds: ["boxing-counterpunch"],
    ctaLabel: "카운터펀치 카드 나도 만들어보기",
    accent: "#FF815E",
    panel: "#120C0B",
    storyCards: [
      {
        eyebrow: "01",
        title: "먼저 치는 것보다 먼저 읽는 게 중요합니다",
        body: "상대가 비는 순간을 읽어야 카운터가 살아납니다.",
      },
      {
        eyebrow: "02",
        title: "가까운 사진일수록 속이기 어렵습니다",
        body: "얼굴, 장갑, 땀, 상대 실루엣이 같이 자연스러워야 합니다.",
      },
      {
        eyebrow: "03",
        title: "링 조명은 땀과 결을 드러내야 합니다",
        body: "빛이 너무 부드러우면 긴장감이 약해집니다.",
      },
    ],
    quickFacts: [
      "초근접 구도라 표정이 바로 읽힙니다.",
      "배경이 흐릴수록 펀치가 더 살아납니다.",
      "거친 피부 디테일이 중요합니다.",
    ],
  },
];

export const MAGAZINE_ARTICLE_BY_SLUG = Object.fromEntries(
  MAGAZINE_ARTICLES.map((article) => [article.slug, article]),
) as Record<string, MagazineArticle>;

export function getMagazineArticle(slug: string) {
  return MAGAZINE_ARTICLE_BY_SLUG[slug] ?? null;
}

export function getMagazineStyle(styleId: string) {
  return ALL_STYLES.find((style) => style.id === styleId) ?? null;
}
