import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { StyleDropHeader } from "@/components/layout/StyleDropHeader";
import { MagazineArticleView } from "@/components/magazine/MagazineArticleView";
import { MAGAZINE_ARTICLES } from "@/lib/magazine";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";
import { loadMagazineFeatureControl } from "@/lib/style-controls.server";

export const metadata: Metadata = {
  title: "매거진",
  description:
    "스타일 카드의 배경 이야기와 재미있는 사실, 공개 동의 결과물을 함께 읽는 StyleDrop 매거진.",
};

export default async function MagazinePage() {
  await connection();

  const magazineControl = await loadMagazineFeatureControl();
  if (!magazineControl.is_visible || !magazineControl.is_enabled) notFound();

  const visibleArticles = MAGAZINE_ARTICLES;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <StyleDropHeader />
      <div className="mx-auto w-full max-w-2xl px-5 sm:px-6">
        {visibleArticles.map((article) => (
          <MagazineArticleView key={article.slug} article={article} />
        ))}

        <div className="mt-10 mb-8">
          <GoogleAd
            slot={ADSENSE_PAGE_SLOTS.magazine}
            className="w-full"
          />
        </div>

        <footer className="border-t border-gray-100 py-6 text-[12px] text-gray-400">
          <p className="flex flex-wrap gap-3">
            <Link href="/faq" className="hover:text-gray-900 transition-colors">FAQ</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">개인정보처리방침</Link>
            <a href="mailto:support@styledrop.cloud" className="hover:text-gray-900 transition-colors">문의</a>
          </p>
        </footer>

      </div>
    </main>
  );
}
