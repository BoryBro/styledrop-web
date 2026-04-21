function normalizeAdsenseClient(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.startsWith("ca-pub-") ? normalized : null;
}

export function normalizeAdsenseSlot(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return /^\d+$/.test(normalized) ? normalized : null;
}

export const ADSENSE_CLIENT = normalizeAdsenseClient(
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT,
);

export const ADSENSE_SLOTS = {
  public: normalizeAdsenseSlot(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_PUBLIC),
  home: normalizeAdsenseSlot(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME),
  faq: normalizeAdsenseSlot(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_FAQ),
  magazine: normalizeAdsenseSlot(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_MAGAZINE),
  legal: normalizeAdsenseSlot(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL),
} as const;

export const ADSENSE_PAGE_SLOTS = {
  home: ADSENSE_SLOTS.home ?? ADSENSE_SLOTS.public,
  faq: ADSENSE_SLOTS.faq ?? ADSENSE_SLOTS.public,
  magazine: ADSENSE_SLOTS.magazine ?? ADSENSE_SLOTS.public,
  legal: ADSENSE_SLOTS.legal ?? ADSENSE_SLOTS.public,
} as const;

export const HAS_ADSENSE = Boolean(ADSENSE_CLIENT);
