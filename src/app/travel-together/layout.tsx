import type { Metadata, ResolvingMetadata } from "next";

const TRAVEL_SHARE_TITLE = "StyleDrop — AI와 함께하는 놀이터";
const TRAVEL_DESCRIPTION =
  "둘이 각자 답하고 여행 궁합 티어, 충돌 포인트, 추천 여행지까지 바로 확인해보세요.";

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const resolvedParent = await parent;

  return {
    title: "여행을 같이 간다면",
    description: TRAVEL_DESCRIPTION,
    openGraph: {
      ...resolvedParent.openGraph,
      title: TRAVEL_SHARE_TITLE,
      description: TRAVEL_DESCRIPTION,
      images: [
        {
          url: "/travel-together/opengraph-image",
          width: 1200,
          height: 630,
          alt: "여행을 같이 간다면 | StyleDrop",
        },
      ],
    },
    twitter: {
      ...resolvedParent.twitter,
      title: TRAVEL_SHARE_TITLE,
      description: TRAVEL_DESCRIPTION,
      images: ["/travel-together/opengraph-image"],
    },
    alternates: {
      canonical: "/travel-together",
    },
  };
}

export default function TravelTogetherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
