import type { Metadata, ResolvingMetadata } from "next";

const PREDICT_DESCRIPTION =
  "상대가 어떤 행동을 할지 먼저 예측하고, 실제 답변과 비교해 관계 싱크로율을 확인해보세요.";

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const resolvedParent = await parent;

  return {
    title: "너라면 그럴 줄 알았어",
    description: PREDICT_DESCRIPTION,
    alternates: {
      canonical: "/nabo-predict",
    },
    openGraph: {
      ...resolvedParent.openGraph,
      title: "너라면 그럴 줄 알았어 | StyleDrop",
      description: PREDICT_DESCRIPTION,
    },
    twitter: {
      ...resolvedParent.twitter,
      title: "너라면 그럴 줄 알았어 | StyleDrop",
      description: PREDICT_DESCRIPTION,
    },
  };
}

export default function NaboPredictLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
