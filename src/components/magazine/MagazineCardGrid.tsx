import Link from "next/link";
import { ALL_STYLES } from "@/lib/styles";

interface MagazineCardGridProps {
  styleIds: string[];
  accent: string;
  primaryStyleId: string;
  ctaLabel: string;
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

  if (styles.length === 0) return null;

  const primary = styles.find((s) => s.id === primaryStyleId) ?? styles[0];

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={primary.afterImg}
        alt={primary.name}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* 하단 그라디언트 */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

      {/* 하단 정보 + CTA */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-5">
        <p className="text-[13px] font-semibold text-white/80 leading-snug max-w-[60%]">
          {primary.name}
        </p>
        <Link
          href={`/studio?style=${encodeURIComponent(primaryStyleId)}`}
          className="inline-flex items-center h-10 px-4 rounded-lg text-[13px] font-bold text-black transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ backgroundColor: accent }}
        >
          나도 만들기 →
        </Link>
      </div>
    </div>
  );
}
