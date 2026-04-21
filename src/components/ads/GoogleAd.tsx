"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, HAS_ADSENSE, normalizeAdsenseSlot } from "@/lib/adsense";

type GoogleAdProps = {
  slot?: string | null;
  className?: string;
  theme?: "dark" | "light";
  minHeight?: number;
};

type AdsenseWindow = Window & {
  adsbygoogle?: Array<Record<string, never>>;
};

export function GoogleAd({
  slot,
  className = "",
  theme = "dark",
  minHeight = 120,
}: GoogleAdProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const adSlot = normalizeAdsenseSlot(slot);
  const isEnabled = HAS_ADSENSE && Boolean(adSlot);

  useEffect(() => {
    if (!isEnabled || !adRef.current || typeof window === "undefined") {
      return;
    }

    if (adRef.current.getAttribute("data-adsbygoogle-status")) {
      return;
    }

    try {
      const adsenseWindow = window as AdsenseWindow;
      adsenseWindow.adsbygoogle = adsenseWindow.adsbygoogle || [];
      adsenseWindow.adsbygoogle.push({});
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Google AdSense push skipped:", error);
      }
    }
  }, [adSlot, isEnabled]);

  if (!isEnabled || !ADSENSE_CLIENT || !adSlot) {
    return null;
  }

  const shellClassName =
    theme === "light"
      ? "rounded-[24px] border border-[#E7ECF3] bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.07)]"
      : "rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm";
  const labelClassName = theme === "light" ? "text-[#8B93A7]" : "text-white/35";

  return (
    <section
      aria-label="광고"
      className={[shellClassName, className].filter(Boolean).join(" ")}
    >
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${labelClassName}`}>
        광고
      </p>
      <ins
        ref={adRef}
        className="adsbygoogle block w-full overflow-hidden"
        style={{ display: "block", minHeight }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        data-adtest={process.env.NODE_ENV === "production" ? undefined : "on"}
      />
    </section>
  );
}
