import Link from "next/link";
import { ALL_STYLES } from "@/lib/styles";

interface MagazineCardGridProps {
  styleIds: string[];
  accent: string;
  primaryStyleId: string;
  ctaLabel: string;
}

function truncateDesc(desc: string, maxLength: number = 28): string {
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

  const primary = styles.find((s) => s.id === primaryStyleId) ?? styles[0];

  return (
    <div className="group relative -mx-3 sm:-mx-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+3rem)] aspect-[4/3] rounded-none overflow-hidden">
      {/* 배경 이미지 - 정규 카드와 동일 구조 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={primary.afterImg}
        alt={primary.name}
        className="absolute inset-0 h-full w-full scale-[1.12] object-cover transition-transform duration-300 group-hover:scale-[1.16]"
        draggable={false}
      />

      {/* 하단 그라디언트 */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* CTA 버튼 */}
      <Link
        href={`/studio?style=${encodeURIComponent(primaryStyleId)}`}
        aria-label={ctaLabel}
        className="absolute bottom-4 right-4 px-4 py-2.5 rounded-full text-[13px] font-bold text-black transition-all hover:scale-110 active:scale-95 whitespace-nowrap shadow-lg"
        style={{ backgroundColor: accent }}
      >
        만들어보기
      </Link>

      {/* 제목 */}
      <div className="absolute bottom-0 left-0 p-4">
        <h3 className="text-[13px] font-bold text-white leading-[1.5] break-words">
          {primary.name} — {truncateDesc(primary.desc)}
        </h3>
      </div>
    </div>
  );
}
