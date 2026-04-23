import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { StyleDropHeader } from "@/components/layout/StyleDropHeader";
import { MagazineArticleView } from "@/components/magazine/MagazineArticleView";
import {
  MAGAZINE_ARTICLES,
  getMagazineArticle,
  getMagazineHeroImage,
} from "@/lib/magazine";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";

const SITE_URL = "https://www.styledrop.cloud";

type MagazineDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function toAbsoluteUrl(path: string | null) {
  if (!path) return `${SITE_URL}/og-image.png`;
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function generateStaticParams() {
  return MAGAZINE_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: MagazineDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getMagazineArticle(slug);

  if (!article) {
    return {
      title: "매거진",
    };
  }

  const url = `${SITE_URL}/magazine/${article.slug}`;
  const image = toAbsoluteUrl(getMagazineHeroImage(article));

  return {
    title: article.title,
    description: article.summary,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${article.title} | StyleDrop 매거진`,
      description: article.summary,
      url,
      siteName: "StyleDrop",
      locale: "ko_KR",
      type: "article",
      images: [
        {
          url: image,
          width: 1200,
          height: 900,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | StyleDrop 매거진`,
      description: article.summary,
      images: [image],
    },
  };
}

export default async function MagazineDetailPage({ params }: MagazineDetailPageProps) {
  const { slug } = await params;
  const article = getMagazineArticle(slug);
  if (!article) notFound();

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <StyleDropHeader />
      <div className="mx-auto w-full max-w-2xl px-5 sm:px-6">
        <MagazineArticleView article={article} />

        <div className="mb-8 mt-10">
          <GoogleAd
            slot={ADSENSE_PAGE_SLOTS.magazine}
            className="w-full"
          />
        </div>

        <footer className="border-t border-gray-100 py-6 text-[12px] text-gray-400">
          <p className="flex flex-wrap gap-3">
            <Link href="/faq" className="transition-colors hover:text-gray-900">FAQ</Link>
            <Link href="/terms" className="transition-colors hover:text-gray-900">이용약관</Link>
            <Link href="/privacy" className="transition-colors hover:text-gray-900">개인정보처리방침</Link>
            <a href="mailto:support@styledrop.cloud" className="transition-colors hover:text-gray-900">문의</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
