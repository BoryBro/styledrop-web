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
