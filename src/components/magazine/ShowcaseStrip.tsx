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
    <div className="overflow-hidden py-2">
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div
          className="flex w-max gap-4"
          style={{ animation: "magazine-marquee 32s linear infinite" }}
        >
          {loopItems.map((item, index) => (
            <article
              key={`${item.userId}-${index}`}
              className="h-[220px] w-[150px] shrink-0 overflow-hidden rounded-[24px] bg-[#0C0C0C]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={displayName(item)} className="h-[180px] w-full object-cover" />
              <div className="flex h-[40px] flex-col justify-center px-3">
                <p className="truncate text-[11px] font-semibold text-white">{displayName(item)}</p>
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
            transform: translateX(calc(-50% - 8px));
          }
        }

        article {
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2), 0 0 0 1px ${accent}08;
        }
      `}</style>
    </div>
  );
}
