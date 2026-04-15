"use client";

import { useEffect, useMemo, useState } from "react";

type ShowcaseStripItem = {
  userId: string;
  nickname: string;
  imageUrl: string;
  styleId: string | null;
  instagramHandle?: string | null;
  createdAt: string;
};

function displayName(item: ShowcaseStripItem) {
  if (item.instagramHandle) return `@${item.instagramHandle}`;
  return item.nickname || "스타일드롭 유저";
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

export function ShowcaseStrip({
  styleIds,
  accent = "#C9571A",
}: {
  styleIds: string[];
  accent?: string;
}) {
  const [items, setItems] = useState<ShowcaseStripItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      styleIds: styleIds.join(","),
      limit: "18",
    });

    setIsLoading(true);
    fetch(`/api/public-showcase?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [styleIds]);

  const loopItems = useMemo(() => (items.length > 0 ? [...items, ...items] : []), [items]);

  if (isLoading) {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden py-1">
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div
          className="flex w-max gap-3"
          style={{ animation: "magazine-marquee 26s linear infinite" }}
        >
          {loopItems.map((item, index) => (
            <article
              key={`${item.userId}-${index}`}
              className="h-[156px] w-[108px] shrink-0 overflow-hidden rounded-[20px] bg-[#0C0C0C]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={displayName(item)} className="h-[120px] w-full object-cover" />
              <div className="flex h-[36px] flex-col justify-center px-2.5">
                <p className="truncate text-[10px] font-semibold text-white/78">{displayName(item)}</p>
                <p className="text-[10px] text-white/30">{relativeTime(item.createdAt)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes magazine-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-50% - 6px));
          }
        }

        article {
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2), 0 0 0 1px ${accent}08;
        }
      `}</style>
    </div>
  );
}
