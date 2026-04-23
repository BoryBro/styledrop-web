import type { Metadata } from "next";

import { ShareClient } from "./ShareClient";

type SharePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const SHARE_TITLE = "StyleDrop 공유 결과";
const SHARE_DESCRIPTION = "친구가 공유한 AI 변환 결과를 확인해보세요.";

function normalizeShareId(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const id = rawValue?.trim();

  if (!id || !/^[A-Za-z0-9_-]{4,80}$/.test(id)) {
    return null;
  }

  return id;
}

function getSharedImageUrl(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/shared-images/shared/${id}-after.jpg`;
}

export async function generateMetadata({
  searchParams,
}: SharePageProps): Promise<Metadata> {
  const id = normalizeShareId((await searchParams).id);
  const sharedImageUrl = id ? getSharedImageUrl(id) : null;

  return {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    alternates: {
      canonical: id ? `/share?id=${encodeURIComponent(id)}` : "/share",
    },
    openGraph: {
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      images: sharedImageUrl
        ? [
            {
              url: sharedImageUrl,
              alt: "StyleDrop AI 변환 결과",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      images: sharedImageUrl ? [sharedImageUrl] : undefined,
    },
  };
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const id = normalizeShareId((await searchParams).id);

  return <ShareClient id={id} />;
}
