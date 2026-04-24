export const MAX_THREADS_IMAGE_COUNT = 20;

function normalizeUrlList(urls: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of urls) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (normalized.length >= MAX_THREADS_IMAGE_COUNT) break;
  }

  return normalized;
}

export function parseThreadsImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeUrlList(value.filter((item): item is string => typeof item === "string"));
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeUrlList(parsed.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      // Fallback to treating the raw string as a single URL.
    }
  }

  return normalizeUrlList([trimmed]);
}

export function serializeThreadsImageUrls(value: unknown): string | null {
  const urls = parseThreadsImageUrls(value);
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}
