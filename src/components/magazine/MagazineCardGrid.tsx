import { getMagazineStyle } from "@/lib/magazine";
import { ALL_STYLES } from "@/lib/styles";

interface MagazineCardGridProps {
  styleIds: string[];
  accent: string;
}

export function MagazineCardGrid({ styleIds, accent }: MagazineCardGridProps) {
  const styles = styleIds
    .map((id) => ALL_STYLES.find((s) => s.id === id))
    .filter((s): s is typeof ALL_STYLES[0] => s !== undefined);

  if (styles.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {styles.map((style) => (
        <a
          key={style.id}
          href={`/studio?style=${encodeURIComponent(style.id)}`}
          className="group flex flex-col rounded-[16px] overflow-hidden bg-white/[0.05] hover:bg-white/[0.10] transition-colors border border-white/[0.08]"
        >
          <article className="flex flex-col h-full">
            {/* 이미지 */}
            <div className="w-full h-[200px] overflow-hidden bg-white/[0.05]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={style.afterImg}
                alt={style.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* 본문 */}
            <div className="flex flex-col gap-2 px-4 py-3.5 flex-1">
              <h3 className="text-[14px] font-bold text-white line-clamp-1">
                {style.name}
              </h3>
              <p className="text-[12px] text-white/70 leading-[1.4] line-clamp-2">
                {style.desc}
              </p>
            </div>

            {/* 라벨 */}
            <div
              className="px-4 py-2.5 border-t border-white/[0.08] text-[11px] font-semibold"
              style={{ color: accent }}
            >
              {style.tag}
            </div>
          </article>
        </a>
      ))}
    </div>
  );
}
