import { ALL_STYLES } from "@/lib/styles";

export type MagazineFactCard = {
  eyebrow: string;
  title: string;
  body: string;
};

type MagazineBaseArticle = {
  slug: string;
  type: "card-linked" | "editorial";
  eyebrow: string;
  title: string;
  heroTitleLines?: string[];
  summary: string;
  accent: string;
  panel: string;
  storyCards: MagazineFactCard[];
  quickFacts: string[];
};

export type CardLinkedMagazineArticle = MagazineBaseArticle & {
  type: "card-linked";
  primaryStyleId: string;
  relatedStyleIds: string[];
  ctaLabel: string;
  communityLabel: string;
  communityHeadline: string;
  communityQuestion: string;
  participationPlaceholder?: string;
  instagramPrompt?: string;
};

export type EditorialMagazineArticle = MagazineBaseArticle & {
  type: "editorial";
  heroImage: string;
  relatedStyleIds?: string[];
};

export type MagazineArticle = CardLinkedMagazineArticle | EditorialMagazineArticle;

export const MAGAZINE_ARTICLES: MagazineArticle[] = [
  {
    slug: "mongol-steppe-warrior",
    type: "card-linked",
    eyebrow: "MONGOL NOTE",
    title: "몽골 부족은 멈춘 적보다 움직이는 적일 때 더 강했습니다",
    heroTitleLines: [
      "몽골 부족은 멈춘 적보다",
      "움직이는 적일 때 더 강했습니다",
    ],
    summary: "넓은 초원에서는 오래 버티는 힘보다 빠르게 흩어지고 다시 모이는 움직임이 더 위협적이었습니다.",
    communityLabel: "공개 쇼케이스",
    communityHeadline: "인기 공개 멤버",
    communityQuestion: "당신은 몽골 부족에서 어떤 역할을 했을까요?",
    participationPlaceholder: "나를 한 줄로 PR해보세요...",
    instagramPrompt: "인스타 공개하고 나를 알리기",
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

export function getMagazineHeroImage(article: MagazineArticle) {
  if (article.type === "editorial") return article.heroImage;
  return getMagazineStyle(article.primaryStyleId)?.afterImg ?? null;
}
