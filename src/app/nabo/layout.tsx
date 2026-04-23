import type { Metadata, ResolvingMetadata } from "next";

const NABO_SHARE_TITLE = "StyleDrop — AI와 함께하는 놀이터";
const NABO_SHARE_DESCRIPTION =
  "친구들이 익명으로 답한 내 인상과 관계 이미지를 확인해보세요.";

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const resolvedParent = await parent;

  return {
    title: "내가 보는 너",
    description: NABO_SHARE_DESCRIPTION,
    alternates: {
      canonical: "/nabo",
    },
    openGraph: {
      ...resolvedParent.openGraph,
      title: NABO_SHARE_TITLE,
      description: NABO_SHARE_DESCRIPTION,
      images: [
        {
          url: "/nabo/opengraph-image",
          width: 1200,
          height: 630,
          alt: "내가 보는 너 | StyleDrop",
        },
      ],
    },
    twitter: {
      ...resolvedParent.twitter,
      title: NABO_SHARE_TITLE,
      description: NABO_SHARE_DESCRIPTION,
      images: ["/nabo/opengraph-image"],
    },
  };
}

export default function NaboLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
