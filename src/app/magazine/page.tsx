import type { Metadata } from "next";
import Link from "next/link";
import { MagazineCommunityBoard } from "@/components/magazine/MagazineCommunityBoard";
import { MagazineCardGrid } from "@/components/magazine/MagazineCardGrid";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { MAGAZINE_ARTICLES, getMagazineStyle } from "@/lib/magazine";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";

export const metadata: Metadata = {
  title: "매거진",
  description:
    "스타일 카드의 배경 이야기와 재미있는 사실, 공개 동의 결과물을 함께 읽는 StyleDrop 매거진.",
};

export default function MagazinePage() {
  const visibleArticles = MAGAZINE_ARTICLES.filter(
    (article) => article.slug === "mongol-steppe-warrior",
  );

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto w-full max-w-2xl px-5 sm:px-6">

        {/* 뒤로 가기 */}
        <div className="pt-7 pb-6">
          <Link href="/studio" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">
            ← StyleDrop
          </Link>
        </div>

        {visibleArticles.map((article) => {
          const style = getMagazineStyle(article.primaryStyleId);
          if (!style) return null;

          return (
            <article key={article.slug}>
              {/* 히어로 이미지 */}
              <div className="-mx-5 sm:-mx-6 mb-10">
                <MagazineCardGrid
                  styleIds={article.relatedStyleIds}
                  accent={article.accent}
                  primaryStyleId={article.primaryStyleId}
                  ctaLabel={article.ctaLabel}
                  title={article.title}
                />
              </div>

              {/* 커뮤니티 보드 — 핵심 인터랙션 */}
              <MagazineCommunityBoard
                styleId={article.primaryStyleId}
                label={article.communityLabel}
                question={article.communityQuestion}
                accent={article.accent}
              />


            </article>
          );
        })}

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
