import type { Metadata } from "next";
import Link from "next/link";
import { MagazineCommunityBoard } from "@/components/magazine/MagazineCommunityBoard";
import { ShowcaseStrip } from "@/components/magazine/ShowcaseStrip";
import { MAGAZINE_ARTICLES, getMagazineStyle } from "@/lib/magazine";

export const metadata: Metadata = {
  title: "매거진",
  description:
    "스타일 카드의 배경 이야기와 재미있는 사실, 공개 동의 결과물을 함께 읽는 StyleDrop 매거진.",
};

export default function MagazinePage() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
        {/* 뒤로 가기 */}
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-white/60 hover:text-white transition-colors">
          ← 뒤로 가기
        </Link>

        <div className="grid gap-12">
          {MAGAZINE_ARTICLES.map((article) => {
            const style = getMagazineStyle(article.primaryStyleId);
            if (!style) return null;

            return (
              <section
                key={article.slug}
                id={article.slug}
                className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-start"
              >
                <div className="flex flex-col gap-4">
                  <div className="overflow-hidden rounded-[28px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={style.afterImg} alt={style.name} className="h-[280px] w-full object-cover sm:h-[360px]" />
                  </div>

                  <ShowcaseStrip styleIds={article.relatedStyleIds} accent={article.accent} />
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: article.accent }}>
                      {article.eyebrow}
                    </p>
                    <h2 className="mt-1.5 text-[14px] font-bold tracking-[-0.01em] text-white sm:text-[16px]">
                      {article.title}
                    </h2>
                    <p className="mt-2 max-w-xl text-[12px] leading-5 text-white/50 line-clamp-2">{article.summary}</p>
                  </div>

                  <Link
                    href={`/studio?style=${encodeURIComponent(article.primaryStyleId)}`}
                    className="inline-flex h-11 w-fit items-center justify-center rounded-full px-5 text-[14px] font-bold text-black transition-transform hover:scale-[1.01]"
                    style={{ backgroundColor: article.accent }}
                  >
                    {article.ctaLabel}
                  </Link>

                  <MagazineCommunityBoard
                    styleId={article.primaryStyleId}
                    label={article.communityLabel}
                    fact={article.communityFact}
                    question={article.communityQuestion}
                    accent={article.accent}
                  />
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
