import { MagazineCardGrid } from "@/components/magazine/MagazineCardGrid";
import { MagazineCommunityBoard } from "@/components/magazine/MagazineCommunityBoard";
import { getMagazineStyle, type MagazineArticle } from "@/lib/magazine";

export function MagazineArticleView({ article }: { article: MagazineArticle }) {
  if (article.type === "editorial") {
    return (
      <article className="pb-12">
        <div className="-mx-5 mb-8 sm:-mx-6">
          <div className="relative overflow-hidden bg-gray-950" style={{ aspectRatio: "4/3" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.heroImage}
              alt={article.title}
              className="absolute inset-0 h-full w-full object-cover opacity-85"
              draggable={false}
            />
            <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/86 via-black/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">
                {article.eyebrow}
              </p>
              <h1 className="max-w-[560px] text-[25px] font-black leading-[1.12] tracking-[-0.045em] sm:text-[36px]">
                {article.title}
              </h1>
              <p className="mt-4 max-w-[520px] text-[14px] font-medium leading-[1.75] text-white/78">
                {article.summary}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {article.storyCards.map((card) => (
            <section key={card.eyebrow} className="border-t border-gray-200 pt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                {card.eyebrow}
              </p>
              <h2 className="mt-2 text-[22px] font-black leading-[1.2] tracking-[-0.03em] text-gray-950">
                {card.title}
              </h2>
              <p className="mt-3 text-[14px] leading-[1.8] text-gray-600">
                {card.body}
              </p>
            </section>
          ))}
        </div>
      </article>
    );
  }

  const style = getMagazineStyle(article.primaryStyleId);
  if (!style) return null;

  return (
    <article>
      <div className="-mx-5 mb-10 sm:-mx-6">
        <MagazineCardGrid
          styleIds={article.relatedStyleIds}
          accent={article.accent}
          primaryStyleId={article.primaryStyleId}
          ctaLabel={article.ctaLabel}
          title={article.title}
          titleLines={article.heroTitleLines}
        />
      </div>

      <MagazineCommunityBoard
        styleId={article.primaryStyleId}
        label={article.communityLabel}
        question={article.communityQuestion}
        accent={article.accent}
        placeholder={article.participationPlaceholder}
        instagramPrompt={article.instagramPrompt}
      />
    </article>
  );
}
