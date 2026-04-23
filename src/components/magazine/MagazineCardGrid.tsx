import Link from "next/link";
import { ALL_STYLES } from "@/lib/styles";

interface MagazineCardGridProps {
  styleIds: string[];
  accent: string;
  primaryStyleId: string;
  ctaLabel: string;
  title?: string;
  titleLines?: string[];
}

export function MagazineCardGrid({
  styleIds,
  accent,
  primaryStyleId,
  ctaLabel,
  title,
  titleLines,
}: MagazineCardGridProps) {
  const styles = styleIds
    .map((id) => ALL_STYLES.find((s) => s.id === id))
    .filter((s): s is typeof ALL_STYLES[0] => s !== undefined);

  if (styles.length === 0) return null;

  const primary = styles.find((s) => s.id === primaryStyleId) ?? styles[0];

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={primary.afterImg}
          alt={primary.name}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* 하단 텍스트 가독성용 딤 */}
        <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black/88 via-black/50 to-transparent" />

        {/* 카드뉴스형 하단 텍스트 */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-left sm:p-7">
          {(titleLines?.length || title) && (
            <h1 className="max-w-[560px] text-[24px] font-extrabold leading-[1.16] tracking-[-0.045em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] sm:text-[34px]">
              {titleLines?.length ? (
                titleLines.map((line, index) => (
                  <span key={`${line}-${index}`}>
                    {index > 0 && <br />}
                    {line}
                  </span>
                ))
              ) : (
                title
              )}
            </h1>
          )}
        </div>
      </div>

      <Link
        href={`/studio?style=${encodeURIComponent(primaryStyleId)}#style-${encodeURIComponent(primaryStyleId)}`}
        className="mt-3 flex h-14 w-full items-center justify-center text-[15px] font-black text-black transition-opacity hover:opacity-90"
        style={{ backgroundColor: accent }}
        aria-label={ctaLabel}
      >
        나도 만들기 →
      </Link>
    </div>
  );
}
