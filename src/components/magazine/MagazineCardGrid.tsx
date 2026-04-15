import Link from "next/link";
import { ALL_STYLES } from "@/lib/styles";

interface MagazineCardGridProps {
  styleIds: string[];
  accent: string;
  primaryStyleId: string;
  ctaLabel: string;
}

function truncateDesc(desc: string, maxLength: number = 30): string {
  if (desc.length <= maxLength) return desc;
  return desc.slice(0, maxLength) + "...";
}

export function MagazineCardGrid({
  styleIds,
  accent,
  primaryStyleId,
  ctaLabel,
}: MagazineCardGridProps) {
  const styles = styleIds
    .map((id) => ALL_STYLES.find((s) => s.id === id))
    .filter((s): s is typeof ALL_STYLES[0] => s !== undefined);

  if (styles.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {styles.map((style) => (
        <div
          key={style.id}
          className="group relative flex flex-col rounded-[16px] overflow-hidden bg-white/[0.05] hover:bg-white/[0.10] transition-colors border border-white/[0.08]"
        >
          <article className="flex flex-col h-full">
            {/* 이미지 - relative로 CTA 배치 위한 컨테이너 */}
            <div className="relative w-full h-[240px] overflow-hidden bg-white/[0.05]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={style.afterImg}
                alt={style.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* CTA 버튼 - 오버레이 */}
              <Link
                href={`/studio?style=${encodeURIComponent(primaryStyleId)}`}
                className="absolute bottom-3 right-3 px-3.5 py-2 rounded-full text-[12px] font-bold text-black transition-all hover:scale-110 active:scale-95 whitespace-nowrap"
                style={{ backgroundColor: accent }}
              >
                만들어보기
              </Link>
            </div>

            {/* 본문 - 제목만 */}
            <div className="px-4 py-3 flex-1 flex items-center">
              <h3 className="text-[13px] font-bold text-white leading-[1.4]">
                {style.name} — {truncateDesc(style.desc, 25)}
              </h3>
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
